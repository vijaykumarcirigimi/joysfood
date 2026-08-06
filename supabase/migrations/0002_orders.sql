-- Joy's Food — Phase 3/4 schema: time slots, orders, and the capacity-safe
-- order placement function.
--
-- Everything that can be got wrong under concurrency lives in here rather than
-- in application code. See plan.md §6.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.order_status as enum
    ('pending_payment','confirmed','preparing','ready','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('unpaid','paid','refunded','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fulfilment_type as enum ('pickup','delivery');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('razorpay','upi_manual','cod');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- time_slots — the recurring templates ("Lunch 12:00–13:00")
-- ---------------------------------------------------------------------------
create table if not exists public.time_slots (
  id                  uuid primary key default gen_random_uuid(),
  label               text not null,
  start_time          time not null,
  end_time            time not null,

  -- Hard capacity for this slot on any given day.
  max_orders          integer not null check (max_orders > 0),

  -- How far ahead an order must be placed, in hours.
  cutoff_hours_before integer not null default 12 check (cutoff_hours_before >= 0),

  is_active           boolean not null default true,
  display_order       integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists time_slots_set_updated_at on public.time_slots;
create trigger time_slots_set_updated_at
  before update on public.time_slots
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- slot_overrides — per-date closures and capacity changes.
-- Kept separate so closing one festival day never edits the permanent template.
-- ---------------------------------------------------------------------------
create table if not exists public.slot_overrides (
  id                  uuid primary key default gen_random_uuid(),
  slot_id             uuid not null references public.time_slots (id) on delete cascade,
  date                date not null,
  max_orders_override integer check (max_orders_override >= 0),
  is_closed           boolean not null default false,
  note                text,
  created_at          timestamptz not null default now(),
  unique (slot_id, date)
);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create sequence if not exists public.order_number_seq;

create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number       text not null unique,

  -- Order numbers are sequential and therefore guessable. Anything customer
  -- facing is addressed by this random token instead, so nobody can walk
  -- JF-2608-0001, -0002, -0003 and read other people's orders.
  public_token       uuid not null unique default gen_random_uuid(),

  user_id            uuid references auth.users (id) on delete set null,

  customer_name      text not null,
  customer_phone     text not null,

  fulfilment_date    date not null,
  slot_id            uuid not null references public.time_slots (id) on delete restrict,
  fulfilment_type    public.fulfilment_type not null default 'pickup',
  delivery_address   text,
  delivery_notes     text,

  status             public.order_status not null default 'pending_payment',

  subtotal_paise     integer not null check (subtotal_paise >= 0),
  delivery_fee_paise integer not null default 0 check (delivery_fee_paise >= 0),
  tax_paise          integer not null default 0 check (tax_paise >= 0),
  total_paise        integer not null check (total_paise >= 0),

  payment_method     public.payment_method not null,
  payment_status     public.payment_status not null default 'unpaid',
  razorpay_order_id  text,
  razorpay_payment_id text unique,

  -- An unpaid order holds its seat only until this moment. See plan.md §6.3.
  reserved_until     timestamptz,

  cancelled_at       timestamptz,
  cancellation_reason text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint delivery_needs_address check (
    fulfilment_type <> 'delivery' or nullif(btrim(coalesce(delivery_address,'')),'') is not null
  )
);

create index if not exists orders_slot_date_idx on public.orders (slot_id, fulfilment_date);
create index if not exists orders_user_idx      on public.orders (user_id, created_at desc);
create index if not exists orders_kitchen_idx   on public.orders (fulfilment_date, slot_id, status);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- order_items — a SNAPSHOT, never a live join to menu_items.
-- Raising a price next month must not rewrite last month's invoices.
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null references public.orders (id) on delete cascade,
  menu_item_id              uuid references public.menu_items (id) on delete restrict,
  item_name_snapshot        text not null,
  unit_price_paise_snapshot integer not null check (unit_price_paise_snapshot >= 0),
  quantity                  integer not null check (quantity > 0)
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Capacity accounting
--
-- An order occupies a seat unless it is cancelled, or it is an unpaid
-- reservation whose hold has lapsed.
-- ---------------------------------------------------------------------------
create or replace function public.slot_seats_taken(p_slot_id uuid, p_date date)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.orders o
  where o.slot_id = p_slot_id
    and o.fulfilment_date = p_date
    and o.status <> 'cancelled'
    and (o.status <> 'pending_payment' or o.reserved_until > now());
$$;

create or replace function public.slot_capacity(p_slot_id uuid, p_date date)
returns integer
language sql
stable
as $$
  select case
    when coalesce(ov.is_closed, false) then 0
    else coalesce(ov.max_orders_override, ts.max_orders)
  end
  from public.time_slots ts
  left join public.slot_overrides ov
    on ov.slot_id = ts.id and ov.date = p_date
  where ts.id = p_slot_id;
$$;

-- ---------------------------------------------------------------------------
-- place_order — the only supported way to create an order.
--
-- SECURITY DEFINER so it can enforce every rule regardless of the caller's
-- RLS. Prices are read from the database; the client never supplies money.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_customer_name    text,
  p_customer_phone   text,
  p_fulfilment_date  date,
  p_slot_id          uuid,
  p_fulfilment_type  public.fulfilment_type,
  p_payment_method   public.payment_method,
  p_items            jsonb,
  p_delivery_address text default null,
  p_delivery_notes   text default null,
  p_user_id          uuid default null,
  p_hold_minutes     integer default 15
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz            constant text := 'Asia/Kolkata';
  v_slot          public.time_slots%rowtype;
  v_slot_start    timestamptz;
  v_capacity      integer;
  v_taken         integer;
  v_subtotal      integer := 0;
  v_order         public.orders%rowtype;
  v_item          record;
  v_now           timestamptz := now();
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.' using errcode = 'check_violation';
  end if;

  -- Serialise every concurrent attempt on this exact (slot, date). Without
  -- this, two customers both read "1 seat left" and both succeed.
  perform pg_advisory_xact_lock(
    hashtextextended(p_slot_id::text || ':' || p_fulfilment_date::text, 0)
  );

  select * into v_slot from public.time_slots where id = p_slot_id;
  if not found or not v_slot.is_active then
    raise exception 'That time slot is no longer available.' using errcode = 'check_violation';
  end if;

  -- Interpret the wall-clock slot time as IST, never as the server's zone.
  v_slot_start := (p_fulfilment_date + v_slot.start_time) at time zone v_tz;

  if v_slot_start <= v_now then
    raise exception 'That time slot is in the past.' using errcode = 'check_violation';
  end if;

  if v_now > v_slot_start - make_interval(hours => v_slot.cutoff_hours_before) then
    raise exception 'Ordering for the % slot on % has closed. It needs % hours notice.',
      v_slot.label, p_fulfilment_date, v_slot.cutoff_hours_before
      using errcode = 'check_violation';
  end if;

  v_capacity := public.slot_capacity(p_slot_id, p_fulfilment_date);
  if coalesce(v_capacity, 0) = 0 then
    raise exception 'The kitchen is closed for the % slot on %.',
      v_slot.label, p_fulfilment_date using errcode = 'check_violation';
  end if;

  v_taken := public.slot_seats_taken(p_slot_id, p_fulfilment_date);
  if v_taken >= v_capacity then
    raise exception 'The % slot on % is fully booked.',
      v_slot.label, p_fulfilment_date using errcode = 'check_violation';
  end if;

  -- Validate every line and total it up from database prices.
  for v_item in
    select
      (line->>'menu_item_id')::uuid as menu_item_id,
      (line->>'quantity')::integer  as quantity
    from jsonb_array_elements(p_items) as line
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Invalid quantity.' using errcode = 'check_violation';
    end if;

    declare
      v_menu public.menu_items%rowtype;
    begin
      select * into v_menu from public.menu_items where id = v_item.menu_item_id;

      if not found or not v_menu.is_active then
        raise exception 'A dish in your cart is no longer on the menu.'
          using errcode = 'check_violation';
      end if;

      if not v_menu.is_available then
        raise exception '% is sold out.', v_menu.name using errcode = 'check_violation';
      end if;

      -- Per-dish lead time: a 24h biryani cannot go into a slot 3 hours away.
      if v_now > v_slot_start - make_interval(hours => v_menu.prep_lead_time_hours) then
        raise exception '% needs % hours notice and cannot be cooked for that slot.',
          v_menu.name, v_menu.prep_lead_time_hours using errcode = 'check_violation';
      end if;

      v_subtotal := v_subtotal + (v_menu.price_paise * v_item.quantity);
    end;
  end loop;

  insert into public.orders (
    order_number, user_id, customer_name, customer_phone,
    fulfilment_date, slot_id, fulfilment_type, delivery_address, delivery_notes,
    status, subtotal_paise, total_paise, payment_method, payment_status,
    reserved_until
  ) values (
    'JF-' || to_char(v_now at time zone v_tz, 'YYMM') || '-' ||
      lpad(nextval('public.order_number_seq')::text, 4, '0'),
    p_user_id, btrim(p_customer_name), btrim(p_customer_phone),
    p_fulfilment_date, p_slot_id, p_fulfilment_type,
    nullif(btrim(coalesce(p_delivery_address, '')), ''),
    nullif(btrim(coalesce(p_delivery_notes, '')), ''),
    -- Both branches need the explicit cast: a CASE resolves its own result
    -- type from the branch literals (text) before it is ever matched against
    -- the column, so an uncast literal fails with 42804.
    case
      when p_payment_method = 'cod' then 'confirmed'::public.order_status
      else 'pending_payment'::public.order_status
    end,
    v_subtotal, v_subtotal, p_payment_method,
    'unpaid'::public.payment_status,
    case when p_payment_method = 'cod'
      then null
      else v_now + make_interval(mins => p_hold_minutes)
    end
  )
  returning * into v_order;

  insert into public.order_items
    (order_id, menu_item_id, item_name_snapshot, unit_price_paise_snapshot, quantity)
  select
    v_order.id,
    m.id,
    m.name,
    m.price_paise,
    (line->>'quantity')::integer
  from jsonb_array_elements(p_items) as line
  join public.menu_items m on m.id = (line->>'menu_item_id')::uuid;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- slot_availability — what the date/slot picker renders.
--
-- SECURITY DEFINER because seat counts require reading other customers'
-- orders, which RLS rightly forbids. Only aggregate counts leak out, never
-- order contents. The range is clamped so a hostile caller cannot ask for
-- ten years of days.
-- ---------------------------------------------------------------------------
create or replace function public.slot_availability(p_from date, p_to date)
returns table (
  slot_id             uuid,
  label               text,
  start_time          time,
  end_time            time,
  cutoff_hours_before integer,
  display_order       integer,
  service_date        date,
  capacity            integer,
  seats_taken         integer,
  seats_left          integer,
  is_closed           boolean,
  cutoff_at           timestamptz,
  starts_at           timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    ts.id,
    ts.label,
    ts.start_time,
    ts.end_time,
    ts.cutoff_hours_before,
    ts.display_order,
    d::date,
    public.slot_capacity(ts.id, d::date),
    public.slot_seats_taken(ts.id, d::date),
    greatest(
      0,
      public.slot_capacity(ts.id, d::date) - public.slot_seats_taken(ts.id, d::date)
    ),
    coalesce(ov.is_closed, false),
    ((d::date + ts.start_time) at time zone 'Asia/Kolkata')
      - make_interval(hours => ts.cutoff_hours_before),
    (d::date + ts.start_time) at time zone 'Asia/Kolkata'
  from public.time_slots ts
  cross join generate_series(
    p_from,
    least(p_to, p_from + 60),
    interval '1 day'
  ) as d
  left join public.slot_overrides ov
    on ov.slot_id = ts.id and ov.date = d::date
  where ts.is_active
  order by d::date, ts.display_order;
$$;

grant execute on function public.slot_availability(date, date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_order_by_token — the guest-facing order view.
--
-- Definer rights, addressed only by the unguessable token, and it returns the
-- order with its lines as a single json document.
-- ---------------------------------------------------------------------------
create or replace function public.get_order_by_token(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'order_number',    o.order_number,
    'status',          o.status,
    'payment_status',  o.payment_status,
    'payment_method',  o.payment_method,
    'customer_name',   o.customer_name,
    'customer_phone',  o.customer_phone,
    'fulfilment_date', o.fulfilment_date,
    'fulfilment_type', o.fulfilment_type,
    'delivery_address', o.delivery_address,
    'delivery_notes',  o.delivery_notes,
    'subtotal_paise',  o.subtotal_paise,
    'total_paise',     o.total_paise,
    'reserved_until',  o.reserved_until,
    'created_at',      o.created_at,
    'slot_label',      ts.label,
    'slot_start',      ts.start_time,
    'slot_end',        ts.end_time,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name',     oi.item_name_snapshot,
        'quantity', oi.quantity,
        'unit_price_paise', oi.unit_price_paise_snapshot
      ) order by oi.item_name_snapshot)
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  join public.time_slots ts on ts.id = o.slot_id
  where o.public_token = p_token;
$$;

grant execute on function public.get_order_by_token(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Housekeeping: release seats held by abandoned checkouts.
-- Schedule with pg_cron, or call from a Vercel cron route.
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_reservations()
returns integer
language sql
security definer
set search_path = public
as $$
  with expired as (
    update public.orders
       set status = 'cancelled',
           cancelled_at = now(),
           cancellation_reason = 'Payment not completed in time'
     where status = 'pending_payment'
       and reserved_until is not null
       and reserved_until < now()
    returning 1
  )
  select count(*)::integer from expired;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.time_slots    enable row level security;
alter table public.slot_overrides enable row level security;
alter table public.orders        enable row level security;
alter table public.order_items   enable row level security;

drop policy if exists "slots are publicly readable" on public.time_slots;
create policy "slots are publicly readable"
  on public.time_slots for select to anon, authenticated using (is_active);

drop policy if exists "slot overrides are publicly readable" on public.slot_overrides;
create policy "slot overrides are publicly readable"
  on public.slot_overrides for select to anon, authenticated using (true);

-- Customers may read their own orders and nothing else. All writes go through
-- place_order() or the service role, so no insert/update policy exists.
drop policy if exists "customers read own orders" on public.orders;
create policy "customers read own orders"
  on public.orders for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "customers read own order items" on public.order_items;
create policy "customers read own order items"
  on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.user_id = auth.uid()
  ));

-- place_order runs as definer, but must still be callable.
grant execute on function public.place_order(
  text, text, date, uuid, public.fulfilment_type, public.payment_method,
  jsonb, text, text, uuid, integer
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Default slots
-- ---------------------------------------------------------------------------
insert into public.time_slots (label, start_time, end_time, max_orders, cutoff_hours_before, display_order)
select * from (values
  ('Lunch · 12:00 – 13:00',  time '12:00', time '13:00', 20, 12, 1),
  ('Lunch · 13:00 – 14:00',  time '13:00', time '14:00', 20, 12, 2),
  ('Dinner · 19:30 – 20:30', time '19:30', time '20:30', 25, 12, 3),
  ('Dinner · 20:30 – 21:30', time '20:30', time '21:30', 25, 12, 4)
) as v(label, start_time, end_time, max_orders, cutoff_hours_before, display_order)
where not exists (select 1 from public.time_slots);
