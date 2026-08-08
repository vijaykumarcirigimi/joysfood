-- Push subscriptions, and who gets told what.
--
-- Two tables with different jobs:
--
--   push_subscriptions   one row per browser that has granted permission. A
--                        device, not a person: the same person on a phone and a
--                        laptop is two rows, and both should ring.
--
--   notification_recipients  the addresses the kitchen wants alerted. Until now
--                        this was KITCHEN_EMAIL, a single value buried in an
--                        Apps Script property that the owner cannot change
--                        without a developer.

-- ---------------------------------------------------------------------------
-- Push subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),

  -- The push service URL. Unique per browser install and the natural key: a
  -- browser that re-subscribes returns the same endpoint, so upserting on it
  -- avoids piling up dead rows that fail to deliver forever.
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,

  -- 'staff' rings for new orders; 'customer' rings for their own order only.
  audience    text not null check (audience in ('staff','customer')),

  -- Set for a signed-in customer. Guests subscribe against a single order
  -- instead, since they have no account to hang it on.
  user_id     uuid references auth.users (id) on delete cascade,
  order_token uuid,

  label       text,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz,

  -- Consecutive delivery failures. A push service returning 404/410 means the
  -- subscription is dead; rows are removed rather than retried forever.
  failures    integer not null default 0
);

create index if not exists push_subs_audience_idx on public.push_subscriptions (audience);
create index if not exists push_subs_user_idx     on public.push_subscriptions (user_id);
create index if not exists push_subs_order_idx    on public.push_subscriptions (order_token);

-- Service role only. A subscription is a delivery capability: anyone able to
-- read these could push arbitrary notifications to the kitchen's phone, and
-- anyone able to insert could register their own device as staff.
alter table public.push_subscriptions enable row level security;

-- ---------------------------------------------------------------------------
-- Notification recipients
-- ---------------------------------------------------------------------------
create table if not exists public.notification_recipients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,

  -- Which events this recipient cares about. Kept as flags rather than one
  -- "notify me" boolean so the person who wants only refund alerts is not
  -- forced to take every new order too.
  on_new_order      boolean not null default true,
  on_cancellation   boolean not null default true,
  on_refund_owed    boolean not null default true,

  is_active  boolean not null default true,
  created_at timestamptz not null default now(),

  -- Stored lowercase; a duplicate address would mean two copies of every alert.
  constraint notification_recipients_email_lower check (email = lower(email))
);

create unique index if not exists notification_recipients_email_key
  on public.notification_recipients (email)
  where email is not null;

alter table public.notification_recipients enable row level security;

-- ---------------------------------------------------------------------------
-- Seed the existing recipient so nothing goes quiet on deploy
-- ---------------------------------------------------------------------------
-- KITCHEN_EMAIL in the Apps Script keeps working as a fallback, but the owner
-- can now edit this list instead.
insert into public.notification_recipients (name, email)
select 'Kitchen', 'vijaykumarcirigimi@gmail.com'
where not exists (select 1 from public.notification_recipients);
