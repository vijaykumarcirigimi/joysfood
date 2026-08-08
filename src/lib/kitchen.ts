import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin";

export const KITCHEN_STATUSES = [
  "pending_payment",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
] as const;

export type KitchenStatus = (typeof KITCHEN_STATUSES)[number];

/** The one-click move the kitchen makes next, per status. */
export const NEXT_STATUS: Partial<Record<KitchenStatus, KitchenStatus>> = {
  confirmed: "preparing",
  preparing: "ready",
  ready: "completed",
};

export type KitchenOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  fulfilment_date: string;
  fulfilment_type: "pickup" | "delivery";
  delivery_address: string | null;
  delivery_notes: string | null;
  status: KitchenStatus;
  payment_status: string;
  payment_method: string;
  total_paise: number;
  created_at: string;
  slot: {
    id: string;
    label: string;
    start_time: string;
    end_time: string;
  } | null;
  items: { item_name_snapshot: string; quantity: number }[];
};

const SELECT = `
  id, order_number, customer_name, customer_phone,
  fulfilment_date, fulfilment_type, delivery_address, delivery_notes,
  status, payment_status, payment_method, total_paise, created_at,
  slot:time_slots ( id, label, start_time, end_time ),
  items:order_items ( item_name_snapshot, quantity )
`;

export async function getKitchenOrders(
  from: string,
  to: string,
): Promise<{ orders: KitchenOrder[]; error: string | null }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { orders: [], error: "SUPABASE_SERVICE_ROLE_KEY is not set." };
  }

  const { data, error } = await supabase
    .from("orders")
    .select(SELECT)
    .gte("fulfilment_date", from)
    .lte("fulfilment_date", to)
    .order("fulfilment_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[kitchen] order fetch failed:", error);
    return { orders: [], error: error.message };
  }

  return { orders: (data ?? []) as unknown as KitchenOrder[], error: null };
}

export type RefundOwed = {
  id: string;
  order_number: string;
  public_token: string;
  customer_name: string;
  customer_phone: string;
  payment_method: string;
  total_paise: number;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  razorpay_payment_id: string | null;
};

/**
 * Orders that were cancelled while their money is still held.
 *
 * A refund can fail for reasons that have nothing to do with us — the gateway
 * is down, the settlement balance is short, the card issuer rejects it — and
 * until now the only trace was a console.error nobody at a home kitchen will
 * ever read. A customer could be owed money for weeks with no one aware.
 *
 * Deliberately not filtered by service date, unlike everything else on this
 * screen: a debt does not stop existing because its slot has passed.
 */
export async function getRefundsOwed(): Promise<RefundOwed[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, public_token, customer_name, customer_phone, payment_method, total_paise, cancelled_at, cancellation_reason, razorpay_payment_id",
    )
    .eq("status", "cancelled")
    // 'paid' and not yet 'refunded' is precisely "we still hold their money".
    .eq("payment_status", "paid")
    .order("cancelled_at", { ascending: true });

  if (error) {
    console.error("[kitchen] refunds owed query failed:", error);
    return [];
  }

  return (data ?? []) as RefundOwed[];
}

/**
 * Aggregated dish counts for a service date — "for Aug 12: 14 biryani, 6
 * paneer tikka". Cancelled orders and lapsed unpaid holds are excluded,
 * because the kitchen must not cook for a seat nobody holds.
 */
export function buildPrepSheet(
  orders: KitchenOrder[],
): { name: string; quantity: number }[] {
  const counts = new Map<string, number>();

  for (const order of orders) {
    if (order.status === "cancelled" || order.status === "pending_payment") {
      continue;
    }
    for (const item of order.items) {
      counts.set(
        item.item_name_snapshot,
        (counts.get(item.item_name_snapshot) ?? 0) + item.quantity,
      );
    }
  }

  return Array.from(counts.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
}

/** Orders bucketed by slot, in service order, for one date. */
export function groupBySlot(orders: KitchenOrder[]) {
  const groups = new Map<string, { label: string; orders: KitchenOrder[] }>();

  for (const order of orders) {
    const key = order.slot?.id ?? "unscheduled";
    const label = order.slot?.label ?? "Unscheduled";
    const group = groups.get(key);
    if (group) group.orders.push(order);
    else groups.set(key, { label, orders: [order] });
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}
