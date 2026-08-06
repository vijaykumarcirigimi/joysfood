-- Joy's Food — Phase 1 schema: categories + menu items.
-- Run in the Supabase SQL Editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  description   text,
  display_order integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists categories_display_order_idx
  on public.categories (display_order)
  where is_active;

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- menu_items
-- ---------------------------------------------------------------------------
create table if not exists public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.categories (id) on delete restrict,
  name          text not null,
  description   text,

  -- Money is INTEGER PAISE, never float. ₹280.00 is stored as 28000.
  -- Floating-point rupees eventually disagree with Razorpay by ₹0.01.
  price_paise   integer not null check (price_paise >= 0),

  image_url     text,
  is_veg        boolean not null default true,

  -- is_available = temporarily sold out (owner toggles daily).
  -- is_active    = soft delete. Never hard-delete an item: future-dated orders
  --                may reference it. See plan.md §6.5.
  is_available  boolean not null default true,
  is_active     boolean not null default true,

  -- Hours of notice the kitchen needs. Drives slot filtering in Phase 3.
  prep_lead_time_hours integer not null default 4 check (prep_lead_time_hours >= 0),

  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists menu_items_category_idx
  on public.menu_items (category_id, display_order)
  where is_active;

drop trigger if exists menu_items_set_updated_at on public.menu_items;
create trigger menu_items_set_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Anyone (including anonymous visitors) may READ active rows — it's a public
-- menu. Nobody may write through the anon key; Phase 2 admin writes go through
-- the service role on the server, so no write policy is defined here.
-- ---------------------------------------------------------------------------
alter table public.categories  enable row level security;
alter table public.menu_items  enable row level security;

drop policy if exists "categories are publicly readable" on public.categories;
create policy "categories are publicly readable"
  on public.categories for select
  to anon, authenticated
  using (is_active);

drop policy if exists "menu items are publicly readable" on public.menu_items;
create policy "menu items are publicly readable"
  on public.menu_items for select
  to anon, authenticated
  using (is_active);
