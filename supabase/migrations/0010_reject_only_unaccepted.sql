-- reject_order() was too permissive.
--
-- 0009 guarded against 'preparing', 'ready' and 'completed' but let a
-- 'confirmed' order through, so the function would happily cancel an order the
-- kitchen had already accepted. No money was at risk — it routes through
-- cancelOrder(), which refunds — and the Reject button only renders for an
-- unaccepted order, so the path was unreachable from the UI. But a function
-- that cancels orders should not be reachable by accident, and its contract
-- should match its name: reject is the answer to "will you take this?", asked
-- once, before acceptance.
--
-- Cancelling an accepted order is a different act with different customer
-- wording, and cancel_order() already does it.

create or replace function public.reject_order(
  p_public_token uuid,
  p_reason       text default null
)
returns table (
  order_exists boolean,
  order_number text,
  rejected     boolean,
  refund_due   boolean,
  payment_id   text,
  refund_paise integer,
  method       public.payment_method,
  refused      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_refund_due boolean;
begin
  select * into v_order from public.orders
   where public_token = p_public_token for update;

  if v_order.id is null then
    return query select false, null::text, false, false, null::text, null::integer,
                        null::public.payment_method, 'not found'::text;
    return;
  end if;

  v_refund_due := v_order.payment_status = 'paid'
                  and v_order.razorpay_refund_id is null;

  -- Already rejected or cancelled: report the outstanding refund so a retry can
  -- still finish paying the customer back, but change nothing.
  if v_order.status = 'cancelled' then
    return query select true, v_order.order_number, false, v_refund_due,
                        v_order.razorpay_payment_id, v_order.total_paise,
                        v_order.payment_method, null::text;
    return;
  end if;

  -- The whitelist, rather than 0009's blacklist. Anything that is not awaiting
  -- a decision is refused, including 'confirmed' — which the blacklist missed.
  if v_order.status <> 'awaiting_acceptance' then
    return query select true, v_order.order_number, false, false, null::text,
                        null::integer, v_order.payment_method,
                        case
                          when v_order.status = 'pending_payment'
                            then 'That order has not been paid for yet.'
                          else 'That order was already accepted — cancel it instead.'
                        end::text;
    return;
  end if;

  update public.orders
     set status              = 'cancelled'::public.order_status,
         cancelled_at        = now(),
         cancellation_reason = coalesce(
           nullif(btrim(coalesce(p_reason, '')), ''),
           'The kitchen could not take this order'
         ),
         reserved_until      = null
   where id = v_order.id;

  return query select true, v_order.order_number, true, v_refund_due,
                      v_order.razorpay_payment_id, v_order.total_paise,
                      v_order.payment_method, null::text;
end;
$$;

revoke all on function public.reject_order(uuid, text) from public, anon, authenticated;
