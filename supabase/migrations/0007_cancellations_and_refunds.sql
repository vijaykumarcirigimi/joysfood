-- Cancellations and refunds — plan.md §6.4 and the launch checklist at :280.
--
-- Until now an order could only ever move forward. A customer who wanted out
-- had to phone the kitchen, and a paid order cancelled from the kitchen screen
-- silently kept the customer's money: `updateOrderStatus` sets status to
-- 'cancelled' and touches nothing about payment.
--
-- The policy encoded here is the one already published on /refunds:
-- free cancellation until CANCELLATION_CUTOFF_HOURS before the slot starts,
-- which is the same instant ordering closes. Past that the kitchen has shopped
-- and started prep, so the customer cannot self-cancel — but the kitchen still
-- can, and that path always refunds.
--
-- Cancelling frees the seat with no extra work: slot_seats_taken() already
-- excludes cancelled orders.

-- ---------------------------------------------------------------------------
-- Where a refund is recorded
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists razorpay_refund_id  text,
  add column if not exists refunded_at         timestamptz,
  add column if not exists refund_amount_paise integer;

-- One refund per gateway refund id. This is what makes "refund this order"
-- safe to retry after a timeout: the second attempt cannot record a duplicate.
create unique index if not exists orders_razorpay_refund_id_key
  on public.orders (razorpay_refund_id)
  where razorpay_refund_id is not null;

-- ---------------------------------------------------------------------------
-- The policy boundary, in one place
-- ---------------------------------------------------------------------------
-- Must stay equal to CANCELLATION_CUTOFF_HOURS in src/lib/business.ts, which is
-- the number printed on the /refunds page. If they drift, the site promises one
-- thing and the database enforces another.
create or replace function public.cancellation_cutoff_hours()
returns integer
language sql
immutable
as $$ select 12 $$;

-- ---------------------------------------------------------------------------
-- Cancel an order
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order(
  p_public_token uuid,
  p_by           text default 'customer',   -- 'customer' | 'kitchen'
  p_reason       text default null
)
returns table (
  -- Deliberately NOT named `found`: a RETURNS TABLE column becomes an OUT
  -- parameter, and one called `found` shadows plpgsql's built-in FOUND. The
  -- not-found branch would then read a NULL OUT param instead of the result of
  -- the SELECT, never fire, and carry on with an empty order row.
  order_exists      boolean,
  order_number      text,
  cancelled         boolean,
  already_cancelled boolean,
  refund_due        boolean,
  payment_id        text,
  refund_paise      integer,
  method            public.payment_method,
  refused_reason    text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz         constant text := 'Asia/Kolkata';
  v_order      public.orders%rowtype;
  v_slot       public.time_slots%rowtype;
  v_slot_start timestamptz;
  v_refund_due boolean;
begin
  select * into v_order
    from public.orders
   where public_token = p_public_token
   for update;

  -- Explicit null check rather than FOUND, so this stays correct regardless of
  -- what the OUT parameters are called.
  if v_order.id is null then
    return query select false, null::text, false, false, false,
                        null::text, null::integer, null::public.payment_method,
                        'not found'::text;
    return;
  end if;

  -- A paid order that was cancelled but never refunded still owes money, so
  -- report refund_due on the repeat call. That makes the whole operation safe
  -- to retry when the gateway call failed after the cancellation committed.
  v_refund_due := v_order.payment_status = 'paid'
                  and v_order.razorpay_refund_id is null;

  if v_order.status = 'cancelled' then
    return query select true, v_order.order_number, true, true, v_refund_due,
                        v_order.razorpay_payment_id, v_order.total_paise,
                        v_order.payment_method, null::text;
    return;
  end if;

  if v_order.status = 'completed' then
    return query select true, v_order.order_number, false, false, false,
                        null::text, null::integer, v_order.payment_method,
                        'This order has already been completed.'::text;
    return;
  end if;

  -- The customer's window closes when the kitchen commits to buying for the
  -- slot. The kitchen itself is never blocked — it may need to cancel an hour
  -- before service because the cooker died, and that must always refund.
  if p_by = 'customer' then
    select * into v_slot from public.time_slots where id = v_order.slot_id;
    v_slot_start := (v_order.fulfilment_date + v_slot.start_time) at time zone v_tz;

    -- A deleted slot would leave v_slot_start null and make the comparison
    -- below null, silently letting a customer cancel at any time. Refuse and
    -- let a human look at it instead.
    if v_slot_start is null then
      return query select true, v_order.order_number, false, false, false,
                          null::text, null::integer, v_order.payment_method,
                          'We could not check the cancellation window. Please contact us.'::text;
      return;
    end if;

    if now() > v_slot_start - make_interval(hours => public.cancellation_cutoff_hours()) then
      return query select true, v_order.order_number, false, false, false,
                          null::text, null::integer, v_order.payment_method,
                          format(
                            'Free cancellation closed %s hours before the slot. Please contact us.',
                            public.cancellation_cutoff_hours()
                          )::text;
      return;
    end if;
  end if;

  update public.orders
     set status              = 'cancelled',
         cancelled_at        = now(),
         cancellation_reason = coalesce(
           nullif(btrim(coalesce(p_reason, '')), ''),
           case when p_by = 'kitchen'
                then 'Cancelled by the kitchen'
                else 'Cancelled by the customer'
           end
         ),
         -- The seat is free either way; drop the hold so nothing re-reads it.
         reserved_until      = null
   where id = v_order.id;

  return query select true, v_order.order_number, true, false, v_refund_due,
                      v_order.razorpay_payment_id, v_order.total_paise,
                      v_order.payment_method, null::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Record a refund. Idempotent, like mark_order_paid_by_razorpay.
-- ---------------------------------------------------------------------------
create or replace function public.mark_order_refunded(
  p_public_token uuid,
  p_refund_id    text,
  p_amount_paise integer
)
returns table (ok boolean, already_refunded boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  update public.orders
     set payment_status      = 'refunded',
         razorpay_refund_id  = p_refund_id,
         refunded_at         = now(),
         refund_amount_paise = p_amount_paise
   where public_token = p_public_token
     -- Only a paid order can become refunded, so a second call changes nothing.
     and payment_status = 'paid';

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return query
      select exists (
        select 1 from public.orders
         where public_token = p_public_token and payment_status = 'refunded'
      ), true;
  else
    return query select true, false;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
-- Both move money or free capacity, and Postgres grants EXECUTE to PUBLIC by
-- default. Only the service role — behind our server actions, which decide who
-- is asking — may call them.
revoke all on function public.cancel_order(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.mark_order_refunded(uuid, text, integer)
  from public, anon, authenticated;
