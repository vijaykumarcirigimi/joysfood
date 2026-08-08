import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * A customer's own orders.
 *
 * No ownership filter appears in these queries and none is needed: the
 * "customers read own orders" RLS policy in 0002_orders.sql pins every row to
 * `user_id = auth.uid()`. Filtering here as well would only invite the reader
 * to believe the filter is what enforces it. Guest orders have a null user_id
 * and so belong to nobody — they stay reachable by their public token alone.
 */

export type MyOrderItem = {
  name: string;
  quantity: number;
  unitPricePaise: number;
};

export type MyOrder = {
  id: string;
  orderNumber: string;
  publicToken: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  fulfilmentDate: string;
  fulfilmentType: "pickup" | "delivery";
  deliveryAddress: string | null;
  totalPaise: number;
  createdAt: string;
  slotLabel: string | null;
  slotStart: string | null;
  slotEnd: string | null;
  items: MyOrderItem[];
};

export const ORDER_STATUS_COPY: Record<string, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  preparing: "Being cooked",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

type OrderRow = {
  id: string;
  order_number: string;
  public_token: string;
  status: string;
  payment_status: string;
  payment_method: string;
  fulfilment_date: string;
  fulfilment_type: "pickup" | "delivery";
  delivery_address: string | null;
  total_paise: number;
  created_at: string;
  slot: { label: string; start_time: string; end_time: string } | null;
  order_items:
    | {
        item_name_snapshot: string;
        quantity: number;
        unit_price_paise_snapshot: number;
      }[]
    | null;
};

const ORDER_SELECT = `
  id, order_number, public_token, status, payment_status, payment_method,
  fulfilment_date, fulfilment_type, delivery_address, total_paise, created_at,
  slot:time_slots ( label, start_time, end_time ),
  order_items ( item_name_snapshot, quantity, unit_price_paise_snapshot )
`;

export async function getMyOrders(limit = 50): Promise<MyOrder[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[orders] history query failed:", error);
    return [];
  }

  return ((data ?? []) as unknown as OrderRow[]).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    publicToken: row.public_token,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    fulfilmentDate: row.fulfilment_date,
    fulfilmentType: row.fulfilment_type,
    deliveryAddress: row.delivery_address,
    totalPaise: row.total_paise,
    createdAt: row.created_at,
    // Null when the kitchen has since deactivated the slot — the time_slots
    // policy only exposes active rows, and a past order should still render.
    slotLabel: row.slot?.label ?? null,
    slotStart: row.slot?.start_time ?? null,
    slotEnd: row.slot?.end_time ?? null,
    items: (row.order_items ?? []).map((item) => ({
      name: item.item_name_snapshot,
      quantity: item.quantity,
      unitPricePaise: item.unit_price_paise_snapshot,
    })),
  }));
}

export type SavedContact = {
  name: string;
  phone: string;
  address: string;
};

/**
 * Contact details from the customer's most recent order, used to prefill
 * checkout. Cheaper than a profiles table and always reflects what they last
 * actually typed — which is the value most likely to still be right.
 */
export async function getSavedContact(): Promise<SavedContact | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("orders")
    .select("customer_name, customer_phone, delivery_address")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[orders] saved contact query failed:", error);
    return null;
  }
  if (!data) return null;

  return {
    name: data.customer_name ?? "",
    phone: data.customer_phone ?? "",
    address: data.delivery_address ?? "",
  };
}
