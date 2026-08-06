"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabasePublicClient } from "@/lib/supabase/public";

/**
 * Note what is NOT in this schema: prices, totals, or dish names. The client
 * sends ids and quantities only — place_order() reads the money from the
 * database. Accepting a price from the browser is how food apps get robbed.
 */
const PlaceOrderSchema = z
  .object({
    customerName: z.string().trim().min(2, "Enter your name").max(80),
    customerPhone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"),
    fulfilmentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    slotId: z.uuid("Pick a time slot"),
    fulfilmentType: z.enum(["pickup", "delivery"]),
    paymentMethod: z.enum(["cod", "upi_manual"]),
    deliveryAddress: z.string().trim().max(400).optional().or(z.literal("")),
    deliveryNotes: z.string().trim().max(300).optional().or(z.literal("")),
    items: z
      .array(
        z.object({
          menuItemId: z.uuid(),
          quantity: z.number().int().min(1).max(20),
        }),
      )
      .min(1, "Your cart is empty")
      .max(40),
  })
  .refine(
    (value) =>
      value.fulfilmentType !== "delivery" ||
      (value.deliveryAddress ?? "").trim().length >= 10,
    { message: "Enter a delivery address", path: ["deliveryAddress"] },
  );

export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; publicToken: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const parsed = PlaceOrderSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] ??= issue.message;
    }
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors,
    };
  }

  const supabase = createSupabasePublicClient();
  if (!supabase) {
    return { ok: false, error: "Ordering is not configured yet." };
  }

  const value = parsed.data;

  const { data, error } = await supabase.rpc("place_order", {
    p_customer_name: value.customerName,
    p_customer_phone: value.customerPhone,
    p_fulfilment_date: value.fulfilmentDate,
    p_slot_id: value.slotId,
    p_fulfilment_type: value.fulfilmentType,
    p_payment_method: value.paymentMethod,
    p_items: value.items.map((item) => ({
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
    })),
    p_delivery_address: value.deliveryAddress || null,
    p_delivery_notes: value.deliveryNotes || null,
    p_user_id: null,
  });

  if (error) {
    // place_order() raises rules as plain sentences meant for the customer
    // ("The Lunch slot on 2026-08-09 is fully booked."). Anything else is a
    // genuine fault and should not be echoed back.
    const isBusinessRule = error.code === "23514" || error.code === "P0001";
    console.error("[place-order] rpc failed:", error);
    return {
      ok: false,
      error: isBusinessRule
        ? error.message
        : "We couldn't place that order. Please try again.",
    };
  }

  const order = Array.isArray(data) ? data[0] : data;
  if (!order?.order_number || !order?.public_token) {
    return { ok: false, error: "We couldn't place that order. Please try again." };
  }

  revalidatePath("/cart");
  return {
    ok: true,
    orderNumber: order.order_number as string,
    publicToken: order.public_token as string,
  };
}
