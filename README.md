# Joy's Food

Pre-order web app for a home-style kitchen. Customers browse the menu, pick a
future date and time slot, and pay online.

Full roadmap and architecture rationale: **[plan.md](./plan.md)**

## Status

Live at **https://joysfood.vercel.app** (Razorpay test mode).

| Phase | Scope | State |
|---|---|---|
| 0 | Project shell, theme, PWA manifest | ✅ Done |
| 1 | Menu schema, seed data, public menu page | ✅ Done |
| 3 | Cart + date/slot picker | ✅ Done |
| 4 | Accounts, order placement, order history | ✅ Done |
| 6 | Kitchen dashboard + prep sheet | ✅ Done |
| 2 | Admin panel (menu, categories, slots) | ✅ Done |
| 5 | Razorpay payments, cancellations, refunds | ✅ Done |
| 7 | Order + kitchen email, error boundaries, loading states | ✅ Done |
| 8 | Go live | 🟡 Deployed; awaiting KYC and live keys |

Phases 3, 4 and 6 were built before 2 — ordering is the product, menu CRUD is
convenience.

**Outstanding before real customers:** Razorpay KYC (which gates live keys, UPI
and therefore real refunds), the business details in `src/lib/business.ts` that
still render as `[placeholders]` on the policy pages, and clearing test orders
from the database.

## Routes

| Route | Purpose |
|---|---|
| `/` | Menu, 3 dishes per category |
| `/menu/[slug]` | Full category listing |
| `/cart` | Cart, date + slot picker, checkout |
| `/order/[token]` | Order confirmation, pay, cancel — addressed by random token |
| `/signin` | Google OAuth + email one-time code |
| `/orders` | Signed-in customer's own order history |
| `/privacy` `/terms` `/refunds` `/contact` | Policy pages Razorpay requires before approval |
| `/api/webhooks/razorpay` | Payment webhook (signature-verified, idempotent) |
| `/kitchen` | Password-gated order queue, prep sheet, refunds owed |
| `/admin/menu` | Dishes: prices, photos, sold-out, archive |
| `/admin/categories` | Categories and their order |
| `/admin/slots` | Slot times, capacity, cutoffs, date closures |

`/admin` and `/kitchen` share one password (`KITCHEN_PASSWORD`) because a home
kitchen is one or two people. Splitting price editing from order-status changes
is the natural next step when staff accounts arrive.

Dish photos upload to the public `dish-photos` Supabase Storage bucket. A photo
set there wins over any file in `public/dishes/`.

## Stack

Next.js 15 (App Router) · React 19 · Tailwind CSS v4 · Supabase (Postgres, Auth,
Storage) · Razorpay Standard Checkout · Google Apps Script for email · Playwright
· deployed on Vercel

## Commands

```bash
npm run dev               # local dev server
npm run build             # production build
npm run test:e2e          # Playwright: order flow, 5 specs
npm run test:e2e:clean    # delete orders the suite created
npm run test:concurrency  # fire capacity+10 orders at one slot; asserts no oversell
npm run walkthrough       # headed browser walkthrough, screenshots, leaves orders in place
```

`test:e2e` and `test:concurrency` place **real orders in whatever Supabase
project `.env.local` points at** and consume real slot capacity. Both clean up
after themselves; `walkthrough` deliberately does not.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

**It works with no configuration.** Without Supabase env vars the app serves the
built-in sample menu from `src/lib/seed-menu.ts` and shows a banner saying so.

## Connecting Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. Copy `.env.example` to `.env.local` and fill in the URL and anon key from
   **Project Settings → API**.
3. In the Supabase **SQL Editor**, run the migrations in numerical order:
   - `0001_menu.sql` — menu tables, indexes, RLS
   - `0002_orders.sql` — slots, orders, `place_order()`
   - `0003_*.sql` — only if you applied `0002` before 2026-08-07; patches an
     enum cast that `0002` now already contains
   - `0004_bind_orders_to_user.sql` — order owner from the JWT
   - `0005_razorpay_payments.sql` — payment events, idempotent mark-paid
   - `0006_expire_reservations_cron.sql` — the seat sweeper (needs `pg_cron`)
   - `0007_cancellations_and_refunds.sql` — cancel window, refund recording
   - `0008_customer_email.sql` — `customer_email` on the order

   Then `supabase/seed.sql` for the sample dishes (safe to re-run).
4. Set `KITCHEN_PASSWORD` in `.env.local`.
5. Restart `npm run dev`. The banner disappears once real rows load.

## The ordering rules

All of them live in `place_order()` in `0002_orders.sql`, not in React, because
a rule enforced in the browser is not enforced at all:

- **Slot capacity under concurrency** — a `pg_advisory_xact_lock` on
  `(slot, date)` serialises simultaneous attempts. Measured: 30 orders fired
  together at a 20-seat slot, exactly 20 won, 10 were refused as fully booked,
  and all 20 order numbers were unique. Re-run with `npm run test:concurrency`.
- **Cutoffs and lead times in IST**, never the server's zone.
- **Per-dish lead time** — a 24h dish cannot enter a 3h-away slot.
- **Prices read from the database.** The client sends ids and quantities only.
- **The order's owner comes from the JWT**, not from an argument — `place_order`
  is granted to `anon`, so a caller-supplied `user_id` would let anyone file
  orders into a stranger's history (`0004`).
- **Unpaid orders release their seat**, swept every minute by pg_cron
  (`0006`). The window is per-method: 15 minutes for a gateway payment, 10
  hours for a manual UPI transfer a human has to confirm. Derived from
  `created_at`, never from the caller-supplied hold length.

The banner tells you which step is outstanding — missing keys, missing tables,
or an empty database.

## Conventions worth knowing

- **Money is integer paise, never a float.** `₹280.00` is stored as `28000`.
  Format only at the edge with `formatPaise()` from `src/lib/utils.ts`.
- **Never hard-delete a menu item.** Set `is_active = false`. Future-dated
  orders reference these rows. `is_available` is the separate day-to-day
  sold-out toggle.
- **`SUPABASE_SERVICE_ROLE_KEY` is server-only.** It bypasses RLS. It must never
  be prefixed `NEXT_PUBLIC_` or imported into a client component.
- **Real values live in `.env.local` only.** `.env.example` is committed and
  must stay free of secrets.

## Layout

```
src/
  app/
    page.tsx           Public menu page (static, ISR 60s)
    layout.tsx         Fonts, metadata, theme colour
    manifest.ts        PWA manifest
  components/          Menu UI (cards, veg badge, category rail)
  lib/
    menu.ts            Menu repository — Supabase read with seed fallback
    seed-menu.ts       Built-in sample menu
    types.ts           Shared domain types
    utils.ts           cn(), formatPaise()
    supabase/          Public, server and env clients
supabase/
  migrations/          Schema, run in order
  seed.sql             Sample dishes
```
