# Joy's Food — Build Plan

**Version:** 1.0 · **Date:** 2026-08-06
**Platform:** Responsive web app (PWA) · **Market:** India · **Built by:** Claude Code

---

## 1. Short answer: how difficult is this?

**The code is easy. The operations are the hard part.**

| Part | Difficulty | Why |
|---|---|---|
| Menu display | Easy | Static-ish data, a grid of cards |
| Menu/price admin | Easy | CRUD forms over a database |
| Cart + checkout | Easy–Medium | Well-trodden; state management is the only fiddly bit |
| Payment collection | Medium | Code is ~200 lines. **KYC onboarding takes 2–7 days and is out of your control.** |
| **Future-date ordering** | **Medium–Hard** | This is the genuinely tricky feature — see §6 |
| Kitchen/order dashboard | Easy–Medium | A filtered list with status buttons |
| Notifications (SMS/WhatsApp) | Medium | Costs money, needs template approval |

**Realistic estimate with Claude Code writing the code:** a working MVP in **2–3 weeks of part-time evenings**, or **4–6 focused days**. Add 1–2 weeks of calendar time waiting on Razorpay KYC and real-world testing before you take a paying customer.

**The thing people underestimate:** ordering for *future dates* is not "add a date field." It means capacity limits per slot, cutoff times, menu availability that varies by day, cancellation windows, and refunds. That single requirement is roughly 40% of the total build.

### Honest note on "free payment gateway"

No payment gateway in India is free per transaction. What "free" means in practice:

- **Zero setup fee, zero annual fee, zero monthly fee** — true for Razorpay, Cashfree, PhonePe.
- **Per-transaction fee ~2% + 18% GST** on cards/netbanking. UPI is typically cheaper or promotional-zero on some plans.
- Rates change; confirm the current rate on the pricing page at signup rather than trusting any number written here.

If you want *actually* 0%: collect via a static UPI QR / UPI ID and mark orders paid manually in the admin panel. That is free but requires you to reconcile payments by hand and it does not scale past ~20 orders/day. **This plan includes it as a Phase 0 fallback so you can launch before KYC clears.**

---

## 2. Scope

### In scope (MVP)

**Customer side**
- Browse menu by category, with photos, description, price, veg/non-veg marker
- Item unavailable / sold-out state
- Cart with quantity adjustment
- **Pick a delivery/pickup date and time slot** (the core differentiator)
- Login via phone or Google
- Pay online, or choose Pay-on-delivery
- Order confirmation + order history + order status tracking

**Admin/kitchen side**
- Login-protected admin area
- Add/edit/delete menu items and categories; change prices; toggle availability
- Upload item photos
- Configure time slots, per-slot capacity, order cutoff time, holidays
- Order queue: today's orders, upcoming orders, filter by date/slot
- Move order through statuses: Pending → Confirmed → Preparing → Ready → Completed / Cancelled
- Daily prep sheet: "for Aug 12, 1pm slot — 14 biryani, 6 paneer tikka"

### Explicitly out of scope (v1)

Delivery-partner assignment and live GPS tracking · multi-restaurant marketplace · loyalty points · coupons/discount engine · table reservations · inventory depletion by ingredient · native iOS/Android apps · multi-language.

Add these only after real orders are flowing. Each one is easy to bolt on later; none of them earn you anything on day one.

---

## 3. Tech stack

Chosen for: free tiers, India-friendly payments, and being the stack Claude Code writes most reliably.

| Layer | Choice | Cost | Why |
|---|---|---|---|
| Frontend + backend | **Next.js 15 (App Router)** | Free | One codebase, server actions mean no separate API to maintain |
| Hosting | **Vercel** (Hobby) | Free | Zero-config Next.js deploys, preview URLs per change |
| Database | **Supabase** (Postgres) | Free tier | Real SQL, Row Level Security, generous free tier |
| Auth | **Supabase Auth** | Free (Google/email); SMS costs extra | Phone OTP needs an SMS provider — see §8 |
| File storage | **Supabase Storage** | Free tier | Menu item photos |
| Payments | **Razorpay Standard Checkout** | No fixed fee, ~2%+GST per txn | Best India coverage: UPI, cards, netbanking, wallets |
| UI | **Tailwind CSS + shadcn/ui** | Free | Fast, looks good by default, accessible components |
| Forms/validation | **React Hook Form + Zod** | Free | Same Zod schemas validate on client and server |
| PWA | `next-pwa` or a hand-rolled manifest | Free | "Add to Home Screen", offline menu cache |

**Why not Firebase?** Its NoSQL model fights you the moment you need "count all orders in this slot on this date" — which is exactly the query this app lives on. Postgres is the right tool here.

**Why not a separate Node/Express backend?** It doubles the deployment surface for zero benefit at this scale. Next.js server actions and route handlers *are* your backend.

---

## 4. Data model

```
categories
  id, name, display_order, is_active

menu_items
  id, category_id → categories
  name, description, price_paise (INTEGER — never store money as float)
  image_url, is_veg, is_available
  prep_lead_time_hours    -- e.g. biryani needs 24h notice
  display_order, created_at

availability_rules              -- which items are orderable on which days
  id, menu_item_id → menu_items
  day_of_week (0-6, NULL = every day)
  specific_date (NULL = recurring)
  is_available

time_slots                      -- the templates: "Lunch 12:00–13:00"
  id, label, start_time, end_time
  max_orders                    -- capacity guard
  cutoff_hours_before           -- e.g. must order 12h ahead
  is_active

slot_overrides                  -- closures, festival capacity changes
  id, slot_id → time_slots, date
  max_orders_override, is_closed, note

orders
  id, order_number (human-readable: JF-2608-0042)
  user_id → auth.users
  customer_name, customer_phone
  fulfilment_date, slot_id → time_slots
  fulfilment_type ('pickup' | 'delivery')
  delivery_address, delivery_notes
  status ('pending_payment'|'confirmed'|'preparing'|'ready'|'completed'|'cancelled')
  subtotal_paise, delivery_fee_paise, tax_paise, total_paise
  payment_method ('razorpay'|'upi_manual'|'cod')
  payment_status ('unpaid'|'paid'|'refunded'|'failed')
  razorpay_order_id, razorpay_payment_id
  created_at, updated_at

order_items                     -- snapshot, NOT a live join
  id, order_id → orders, menu_item_id → menu_items
  item_name_snapshot, unit_price_paise_snapshot, quantity
```

### Three non-obvious decisions baked in above

1. **Money is `INTEGER` paise, never `FLOAT`.** Floating-point rupees will eventually produce a ₹0.01 mismatch with Razorpay and you will lose an evening to it.
2. **`order_items` snapshots the name and price.** If you raise the biryani price next month, last month's orders and invoices must not silently change. Joining live to `menu_items` for price is the single most common bug in food-app schemas.
3. **`slot_overrides` is separate from `time_slots`.** Closing for one festival day should not mean editing your permanent slot template.

---

## 5. Build phases

Each phase ends with something you can actually open and click. Do not skip ahead.

### Phase 0 — Skeleton (½ day)
Next.js app scaffolded, Tailwind + shadcn/ui installed, Supabase project created, env vars wired, deployed to Vercel with a live URL. **Exit test:** the URL loads "Joy's Food" from your phone.

### Phase 1 — Menu, read-only (1 day)
Schema migrations for `categories` + `menu_items`. Seed 10–15 real dishes with real prices and real photos. Public menu page: category tabs, item cards, veg marker, sold-out state. **Exit test:** the menu on your phone looks like something you'd order from.

### Phase 2 — Admin panel (1 day)
Password-protected `/admin`. CRUD for categories and items. Image upload to Supabase Storage. Availability toggle. **Exit test:** you change a price in admin and see it live on the menu without touching code.

### Phase 3 — Cart + slot picker (1–1.5 days)
Cart state (React context + localStorage so it survives a refresh). Date picker showing the next 14 days. Slot picker that greys out slots that are full, past cutoff, or closed. Live order summary. **Exit test:** you can build a ₹840 cart for next Tuesday's 1pm slot and the full slot is genuinely unclickable.

### Phase 4 — Auth + order placement (1 day)
Google login + email OTP. Checkout form (name, phone, pickup/delivery, address, notes). Order writes to DB inside a transaction that re-checks slot capacity. Order confirmation page. Order history. **Exit test:** place an order as a real user, see it in the database.

### Phase 5 — Payments (1–1.5 days)
Razorpay account + KYC (**start this on day 1 of the project — it gates this phase**). Create Razorpay order server-side, open Checkout, verify the signature server-side, handle the webhook, mark the order paid. Idempotency on the webhook. Failure and abandoned-payment handling. **Exit test:** a ₹1 test payment in Razorpay test mode flips the order to `paid`, and replaying the webhook does not double-process it.

### Phase 6 — Kitchen dashboard (1 day)
Order queue grouped by date and slot. Status buttons. Daily prep sheet with aggregated item counts. Printable/exportable day view. **Exit test:** someone who has never seen the app can work tomorrow's orders from this screen.

### Phase 7 — Notifications + polish (1–2 days)
Order confirmation email (Resend free tier — 3,000/month). Optional WhatsApp/SMS via MSG91. PWA manifest + install prompt. Loading and empty states. Mobile pass on every screen. Error boundaries.

### Phase 8 — Go live (½ day + waiting)
Razorpay live keys. Custom domain. Real seed data. Privacy policy, terms, refund policy, contact page (**Razorpay requires these pages before approving your account**). Soft launch to 5 friendly customers.

**Total build effort: ~8–11 working days.** Calendar time is longer because of KYC and testing.

---

## 6. The hard part: future-date ordering

Read this section twice. It is where the bugs will be.

### 6.1 Slot capacity is a race condition
Two customers loading the last seat in the 1pm slot at the same time will both see "1 left" and both succeed. Frontend checks are cosmetic.

**Fix:** validate capacity inside the same database transaction that inserts the order, using a Postgres function with `SELECT ... FOR UPDATE` on the slot row (or a unique partial index / a `CHECK` against a counted subquery). Never trust the count you rendered in the UI.

### 6.2 Cutoff times need an explicit timezone
"Order by 8pm the previous day" is ambiguous the moment your server runs in UTC and your customer is in IST.

**Fix:** store timestamps as `timestamptz`, do all cutoff arithmetic in `Asia/Kolkata` explicitly, and never use the browser's local time for a business rule.

### 6.3 Payment taken, slot no longer available
Customer pays, but between checkout opening and the webhook arriving, the slot filled up or you closed that day.

**Fix:** reserve the slot at order creation with status `pending_payment`, and expire unpaid reservations after 15 minutes with a scheduled job. Reserve first, then charge.

### 6.4 Cancellations and refunds
A customer cancelling 3 days out should get a full refund. Cancelling 1 hour before the slot, when the food is already cooked, should not.

**Fix:** a `cancellation_cutoff_hours` setting. Auto-refund via the Razorpay refund API inside the window; outside it, force a manual admin decision. Write the policy on the site *before* launch, not after your first dispute.

### 6.5 Menu drift
The paneer dish gets deleted in admin, but three orders for next week already contain it.

**Fix:** already handled by the `order_items` snapshot in §4. Additionally, soft-delete menu items (`is_active = false`) rather than hard-deleting rows.

---

## 7. Payment integration detail

### Setup checklist (start this first — it has the longest lead time)
- Razorpay signup — free
- KYC documents: PAN, bank account proof, business proof (a sole-proprietor GST or Udyam registration works)
- Live website with **Privacy Policy, Terms & Conditions, Refund/Cancellation Policy, Contact Us** — Razorpay checks these and will reject you without them
- Approval: typically 2–7 working days

### Integration flow
1. Customer clicks Pay → server action creates a Razorpay Order (amount in paise) and returns the `order_id`
2. Client opens Razorpay Checkout with that `order_id`
3. On success, Razorpay returns `payment_id` + `signature`
4. **Server verifies the HMAC-SHA256 signature.** Never trust the client's success callback alone — this is the security-critical step
5. Webhook (`payment.captured`) independently confirms and marks the order paid
6. Webhook handler is **idempotent** — keyed on `razorpay_payment_id`, so a retry cannot double-confirm

### Rules that are not optional
- Secret key lives only in server env vars — never in any `NEXT_PUBLIC_*` variable
- Always compute the amount server-side from the database. Never accept a price from the client.
- Verify the webhook's own signature header too
- Test the ugly paths: user closes the modal, UPI request times out, card declined, network drops after payment but before redirect

### Fallback so you can launch before KYC clears
Ship "Pay on pickup/delivery" and "UPI QR + admin marks paid manually" in Phase 4. Real orders can start immediately; switch to Razorpay when approved.

---

## 8. Costs

**Build:** ₹0 in tooling (all free tiers) + your time.

**Running, at low volume:**

| Item | Cost |
|---|---|
| Vercel Hobby | ₹0 |
| Supabase free tier | ₹0 (up to 500MB DB / 1GB storage) |
| Domain (.com) | ~₹1,000/year |
| Resend email | ₹0 (3,000 emails/month) |
| Razorpay | ~2% + GST per online transaction |
| Phone OTP via MSG91 (optional) | ~₹0.15–0.25 per SMS |
| WhatsApp order updates (optional) | ~₹0.30–0.80 per conversation |

**At ~300 orders/month averaging ₹500:** roughly ₹3,000–3,500/month in payment fees, ~₹85/month domain, everything else ₹0. Infrastructure costs stay ₹0 until you're well past 1,000 orders/month.

---

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Razorpay KYC rejected or delayed | Blocks online payments | Start day 1; ship COD + manual UPI as fallback |
| Slot double-booking | Kitchen overwhelmed, angry customers | DB-level transactional capacity check (§6.1) |
| Timezone bug in cutoffs | Orders accepted after cutoff | `timestamptz` + explicit IST arithmetic, tested |
| No-shows on prepaid future orders | Wasted food | Prepayment required for future dates; clear refund policy |
| Menu photos look amateur | Nobody orders | Budget a half-day for decent photos — this affects conversion more than any code you write |
| Supabase free tier pauses on inactivity | Site appears broken | Known behaviour; upgrade to Pro (~$25/mo) once you have real traffic |
| Scope creep (coupons, loyalty, tracking) | MVP never ships | The out-of-scope list in §2 is a commitment, not a suggestion |

---

## 10. Definition of done for v1

- [ ] A customer on a phone browses the menu, orders for a date 5 days out, pays, and gets a confirmation
- [ ] Full slots are genuinely unselectable, verified under two simultaneous checkouts
- [ ] Kitchen staff can see tomorrow's orders and total item counts on one screen
- [ ] Owner can change a price without a developer
- [ ] A payment webhook replayed twice does not create a duplicate confirmed order
- [ ] Cancelling inside the refund window issues a real Razorpay refund
- [ ] Privacy, Terms, Refund, and Contact pages are live
- [ ] 5 real orders placed by real people, end to end

---

## 11. Recommended first step

Say the word and Phase 0 + Phase 1 get built in one session: scaffolded app, database schema, seeded menu, deployed to a live URL you can open on your phone.

In parallel, start the Razorpay signup today — it is the only thing here that Claude Code cannot do for you, and it is the item on the critical path.
