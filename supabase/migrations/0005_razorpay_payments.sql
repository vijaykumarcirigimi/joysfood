-- Phase 5 — Razorpay payments.
--
-- The columns already exist (0002): razorpay_order_id, razorpay_payment_id
-- (unique), payment_status, reserved_until. What is missing is the *safe* way
-- to move money state, and that belongs in the database rather than in the
-- route handler, for two reasons:
--
--   1. Two independent callers race to confirm the same payment — the browser
--      returning from Checkout, and the webhook arriving from Razorpay. Both
--      must be able to run, and exactly one must take effect.
--   2. Razorpay retries webhooks. A replay must be a no-op, not a second
--      confirmation.
--
-- Both properties come from a conditional UPDATE inside one statement, so
-- Postgres row locking does the arbitration. No advisory locks needed.

-- ---------------------------------------------------------------------------
-- Webhook audit + exact-once processing
-- ---------------------------------------------------------------------------
create table if not exists public.payment_events (
  id          bigserial primary key,
  provider    text        not null default 'razorpay',

  -- Razorpay sends this as the x-razorpay-event-id header. Unique per event,
  -- stable across retries of that event: the idempotency key.
  event_id    text        not null,
  event_type  text        not null,

  order_id    uuid        references public.orders (id) on delete set null,

  -- Kept for reconciliation. Payment gateways are the one integration where
  -- "why did this order say paid" gets asked months later.
  payload     jsonb,

  received_at timestamptz not null default now(),

  constraint payment_events_provider_event_uniq unique (provider, event_id)
);

create index if not exists payment_events_order_idx
  on public.payment_events (order_id, received_at desc);

-- Service role only. No policies are defined and none should be: customers
-- have no business reading raw gateway payloads.
alter table public.payment_events enable row level security;

-- ---------------------------------------------------------------------------
-- Attach a freshly created Razorpay order to one of ours
-- ---------------------------------------------------------------------------
create or replace function public.attach_razorpay_order(
  p_public_token uuid,
  p_rzp_order_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
     set razorpay_order_id = p_rzp_order_id
   where public_token = p_public_token
     and payment_status = 'unpaid'
     -- Never re-point an order that already has a gateway order attached;
     -- that would orphan the first one and make reconciliation ambiguous.
     and razorpay_order_id is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mark paid. Idempotent, and safe to call from two places at once.
-- ---------------------------------------------------------------------------
create or replace function public.mark_order_paid_by_razorpay(
  p_rzp_order_id  text,
  p_rzp_payment_id text
)
returns table (
  order_number  text,
  public_token  uuid,
  found         boolean,
  already_paid  boolean,
  needs_refund  boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_was_cancelled boolean;
begin
  select * into v_order
    from public.orders
   where razorpay_order_id = p_rzp_order_id
   for update;

  if not found then
    -- A payment for an order we do not have. Never silently swallow this.
    return query select null::text, null::uuid, false, false, false;
    return;
  end if;

  if v_order.payment_status = 'paid' then
    return query
      select v_order.order_number, v_order.public_token, true, true, false;
    return;
  end if;

  -- The nasty case from plan.md §6.3: the 15-minute hold expired and the
  -- sweeper cancelled the order, then the money arrived anyway. Record the
  -- payment truthfully — it really was received — but do not resurrect the
  -- order, because its seat has already gone to someone else. It needs a
  -- refund, and saying so in the row is how anyone finds out.
  v_was_cancelled := v_order.status = 'cancelled';

  update public.orders
     set payment_status       = 'paid',
         razorpay_payment_id  = p_rzp_payment_id,
         reserved_until       = null,
         status               = case
                                  when status = 'cancelled' then status
                                  else 'confirmed'::public.order_status
                                end,
         cancellation_reason  = case
                                  when status = 'cancelled'
                                    then coalesce(cancellation_reason, '') ||
                                         ' — payment received after expiry, REFUND DUE'
                                  else cancellation_reason
                                end
   where id = v_order.id
     -- The guard that makes a concurrent second caller a no-op.
     and payment_status = 'unpaid';

  return query
    select v_order.order_number, v_order.public_token, true, false, v_was_cancelled;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
-- Postgres grants EXECUTE to PUBLIC by default, which on Supabase means anon
-- can call anything reachable. These move money state and must be revoked,
-- then left ungranted: only the service role (which bypasses grants) may call
-- them, and it is the only thing that ever should.
revoke all on function public.attach_razorpay_order(uuid, text)
  from public, anon, authenticated;
revoke all on function public.mark_order_paid_by_razorpay(text, text)
  from public, anon, authenticated;
