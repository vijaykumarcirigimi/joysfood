# Joy's Food

Pre-order web app for a home-style kitchen. Customers browse the menu, pick a
future date and time slot, and pay online.

Full roadmap and architecture rationale: **[plan.md](./plan.md)**

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | Project shell, theme, PWA manifest | ✅ Done |
| 1 | Menu schema, seed data, public menu page | ✅ Done |
| 3 | Cart + date/slot picker | ✅ Done |
| 4 | Guest order placement (capacity-safe) | ✅ Done |
| 6 | Kitchen dashboard + prep sheet | ✅ Done |
| 2 | Admin panel (menu, categories, slots) | ✅ Done |
| 5 | Razorpay payments | ⬜ Next |
| 7 | Notifications + polish | ⬜ |
| 8 | Go live | ⬜ |

Phases 3, 4 and 6 were built before 2 — ordering is the product, menu CRUD is
convenience. Accounts and order history are still outstanding from Phase 4;
checkout is currently guest-only, identified by phone number.

## Routes

| Route | Purpose |
|---|---|
| `/` | Menu, 3 dishes per category |
| `/menu/[slug]` | Full category listing |
| `/cart` | Cart, date + slot picker, guest checkout |
| `/order/[token]` | Order confirmation, addressed by random token |
| `/kitchen` | Password-gated order queue and prep sheet |
| `/admin/menu` | Dishes: prices, photos, sold-out, archive |
| `/admin/categories` | Categories and their order |
| `/admin/slots` | Slot times, capacity, cutoffs, date closures |

`/admin` and `/kitchen` share one password (`KITCHEN_PASSWORD`) because a home
kitchen is one or two people. Splitting price editing from order-status changes
is the natural next step when staff accounts arrive.

Dish photos upload to the public `dish-photos` Supabase Storage bucket. A photo
set there wins over any file in `public/dishes/`.

## Stack

Next.js 15 (App Router) · React 19 · Tailwind CSS v4 · Supabase (Postgres) ·
Razorpay (Phase 5) · deployed on Vercel

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
3. In the Supabase **SQL Editor**, run these in order:
   - `supabase/migrations/0001_menu.sql` — menu tables, indexes, RLS
   - `supabase/migrations/0002_orders.sql` — slots, orders, `place_order()`
   - `supabase/seed.sql` — the sample dishes (safe to re-run)

   `0003_*.sql` is only needed if you applied `0002` before 2026-08-07; it
   patches an enum cast that `0002` now already contains.
4. Set `KITCHEN_PASSWORD` in `.env.local`.
5. Restart `npm run dev`. The banner disappears once real rows load.

## The ordering rules

All of them live in `place_order()` in `0002_orders.sql`, not in React, because
a rule enforced in the browser is not enforced at all:

- **Slot capacity under concurrency** — a `pg_advisory_xact_lock` on
  `(slot, date)` serialises simultaneous attempts. Verified: 10 concurrent
  orders against a 1-seat slot, exactly 1 wins.
- **Cutoffs and lead times in IST**, never the server's zone.
- **Per-dish lead time** — a 24h dish cannot enter a 3h-away slot.
- **Prices read from the database.** The client sends ids and quantities only.
- **Unpaid orders hold a seat for 15 minutes**, then
  `expire_stale_reservations()` releases it. Schedule that with pg_cron or a
  Vercel cron route before going live — nothing calls it automatically yet.

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
