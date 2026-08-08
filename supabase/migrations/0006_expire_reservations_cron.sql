-- Phase 5 — actually run the reservation sweeper.
--
-- 0002 defined expire_stale_reservations() and nothing ever called it, so an
-- abandoned checkout held its seat forever. plan.md:198 asks for a scheduled
-- job; this is that job, plus two corrections the naive version would have got
-- wrong.
--
-- CORRECTION 1 — one hold length does not fit both payment methods.
--
-- place_order() stamps reserved_until on every non-cod order using the same
-- 15-minute default. That is right for a gateway payment: the customer is on
-- the payment screen now, and fifteen minutes is generous. It is badly wrong
-- for `upi_manual`, where the customer transfers by UPI and a human at the
-- kitchen marks it received. Sweeping those after fifteen minutes would cancel
-- real, paid-for orders because nobody happened to check their phone in time.
-- So the window is per-method: minutes for the gateway, hours for the human.
--
-- CORRECTION 2 — reserved_until cannot be the authority at all.
--
-- Two reasons it is unusable as the deadline:
--
--   a) place_order() stamps it at 15 minutes for BOTH non-cod methods, so for
--      `upi_manual` it is simply the wrong number. Taking the earlier of
--      (reserved_until, per-method window) would therefore cancel manual-UPI
--      orders after fifteen minutes and the per-method window above would be
--      decorative. Measured before shipping: four real pending upi_manual
--      orders were 31–143 minutes old and all would have been cancelled.
--
--   b) p_hold_minutes is an argument to place_order(), which is granted to
--      `anon`. Anyone with the (public) anon key can call the RPC directly and
--      pass p_hold_minutes = 999999 to hold a seat in a busy slot forever.
--
-- So the deadline is derived entirely from created_at and the payment method.
-- reserved_until stays as the customer-facing hold that startPayment() checks
-- for gateway orders, where the two agree; it is not consulted here.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- How long a seat may be held, by how the customer said they would pay
-- ---------------------------------------------------------------------------
create or replace function public.payment_hold_window(
  p_method public.payment_method
)
returns interval
language sql
immutable
set search_path = public
as $$
  select case p_method
           -- At the payment screen right now.
           when 'razorpay'   then interval '15 minutes'
           -- Waiting on a bank transfer and a human to confirm it. Comfortably
           -- shorter than the 12h slot cutoff, so an unconfirmed order still
           -- frees its seat before the kitchen shops for that slot.
           when 'upi_manual' then interval '10 hours'
           -- 'cod' is confirmed on creation and never holds a reservation.
           else interval '0'
         end;
$$;

-- ---------------------------------------------------------------------------
-- The sweeper
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_reservations()
returns integer
language sql
security definer
set search_path = public
as $$
  with expired as (
    update public.orders o
       set status              = 'cancelled',
           cancelled_at        = now(),
           cancellation_reason = case o.payment_method
             when 'razorpay' then 'Payment not completed in time'
             else 'UPI transfer not received in time'
           end,
           -- Clear the hold so the seat is unambiguously free.
           reserved_until      = null
     where o.status = 'pending_payment'
       and o.payment_method <> 'cod'
       -- Derived, not trusted. See CORRECTION 2 above.
       and now() > o.created_at + public.payment_hold_window(o.payment_method)
    returning 1
  )
  select count(*)::integer from expired;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
-- This cancels orders and runs as its owner. 0002 created it without revoking
-- the default PUBLIC grant, which on Supabase means anon could mass-cancel
-- pending orders with the published anon key.
revoke all on function public.expire_stale_reservations() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schedule it
-- ---------------------------------------------------------------------------
-- Every minute. The work is one indexed UPDATE over a handful of rows, and the
-- thing being protected — a seat in a slot that sells out — is worth releasing
-- promptly rather than up to five minutes late.
do $$
begin
  if exists (
    select 1 from cron.job where jobname = 'expire-stale-order-reservations'
  ) then
    perform cron.unschedule('expire-stale-order-reservations');
  end if;
end
$$;

select cron.schedule(
  'expire-stale-order-reservations',
  '* * * * *',
  $job$ select public.expire_stale_reservations(); $job$
);
