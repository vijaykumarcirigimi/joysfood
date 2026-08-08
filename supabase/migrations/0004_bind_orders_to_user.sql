-- Phase 4 — bind placed orders to the signed-in user.
--
-- 0002/0003 accepted the owner as a plain argument (`p_user_id`) and wrote it
-- straight into orders.user_id. place_order() is SECURITY DEFINER and granted
-- to `anon`, so anyone holding the (public, by design) anon key could call the
-- RPC directly and pass someone else's uuid — parking junk orders in a
-- stranger's history. The app only ever sent null, so nothing was exploitable
-- in practice, but populating the column from the app is exactly the change
-- that would have made it live.
--
-- The owner is now derived from the JWT instead of trusted from the caller:
--
--   authenticated  →  auth.uid(), always. p_user_id is ignored.
--   service_role   →  p_user_id, so the kitchen/admin can order on behalf of
--                     a customer later without a second code path.
--   anon           →  null. Guest checkout stays fully supported.
--
-- Signature is unchanged, so the existing GRANT still applies.

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
  v_user_id       uuid;
begin
  -- The caller's identity, never the caller's claim about it.
  v_user_id := coalesce(
    auth.uid(),
    case
      when coalesce(auth.jwt() ->> 'role', '') = 'service_role' then p_user_id
    end
  );

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
    v_user_id, btrim(p_customer_name), btrim(p_customer_phone),
    p_fulfilment_date, p_slot_id, p_fulfilment_type,
    nullif(btrim(coalesce(p_delivery_address, '')), ''),
    nullif(btrim(coalesce(p_delivery_notes, '')), ''),
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

grant execute on function public.place_order(
  text, text, date, uuid, public.fulfilment_type, public.payment_method,
  jsonb, text, text, uuid, integer
) to anon, authenticated;
