"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cancelOrder } from "@/app/actions/cancel-order";
import { notifyOrder } from "@/lib/email";
import { isKitchenAuthed, signInKitchen, signOutKitchen } from "@/lib/kitchen-auth";
import { KITCHEN_STATUSES } from "@/lib/kitchen";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function kitchenLogin(
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const password = String(formData.get("password") ?? "");
  const ok = await signInKitchen(password);
  if (!ok) return { error: "Incorrect password." };

  // Only ever redirect to our own paths — an open redirect here would let a
  // crafted link bounce staff to an attacker's login lookalike.
  const next = String(formData.get("next") ?? "/kitchen");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/kitchen");
}

export async function kitchenLogout() {
  await signOutKitchen();
  redirect("/kitchen");
}

const StatusSchema = z.object({
  orderId: z.uuid(),
  status: z.enum(KITCHEN_STATUSES),
});

export async function updateOrderStatus(
  formData: FormData,
): Promise<void> {
  // Re-check on every write. The page rendering is not authorisation.
  if (!(await isKitchenAuthed())) {
    throw new Error("Not authorised.");
  }

  const parsed = StatusSchema.safeParse({
    orderId: formData.get("orderId"),
    status: formData.get("status"),
  });
  if (!parsed.success) throw new Error("Invalid status change.");

  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Service role key is not configured.");

  // Cancelling is not just a status change when the customer has paid: this
  // used to set status = 'cancelled' and quietly keep their money. Delegate to
  // cancelOrder(), which cancels and then refunds through the gateway.
  if (parsed.data.status === "cancelled") {
    const { data: order, error: lookupError } = await supabase
      .from("orders")
      .select("public_token")
      .eq("id", parsed.data.orderId)
      .maybeSingle();

    if (lookupError || !order?.public_token) {
      console.error("[kitchen] cancel lookup failed:", lookupError);
      throw new Error("Could not cancel that order.");
    }

    const outcome = await cancelOrder(order.public_token, "kitchen");
    if (!outcome.ok) throw new Error(outcome.error);

    // A refund the gateway did not complete must not look like success on a
    // screen the kitchen glances at during a shift.
    if (outcome.refundPending) {
      console.error(
        "[kitchen] REFUND OUTSTANDING on cancelled order:",
        outcome.orderNumber,
      );
    }

    revalidatePath("/kitchen");
    return;
  }

  const patch: Record<string, unknown> = { status: parsed.data.status };

  // Moving an order out of pending_payment means the seat is no longer a
  // timed hold — clear the expiry so the sweeper cannot cancel it later.
  if (parsed.data.status !== "pending_payment") {
    patch.reserved_until = null;
  }

  const { error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", parsed.data.orderId);

  if (error) {
    console.error("[kitchen] status update failed:", error);
    throw new Error("Could not update that order.");
  }

  revalidatePath("/kitchen");
}

/**
 * Accept an order the customer is waiting on.
 *
 * This is the moment the kitchen's promise becomes real, so it is also the
 * moment the customer hears "confirmed" — not at checkout.
 */
export async function acceptOrder(formData: FormData): Promise<void> {
  if (!(await isKitchenAuthed())) throw new Error("Not authorised.");

  const token = z.uuid().safeParse(formData.get("publicToken"));
  if (!token.success) throw new Error("Invalid order.");

  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Service role key is not configured.");

  const { data, error } = await supabase.rpc("accept_order", {
    p_public_token: token.data,
  });
  if (error) {
    console.error("[kitchen] accept failed:", error);
    throw new Error("Could not accept that order.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.order_exists) throw new Error("Could not find that order.");
  if (row.refused) throw new Error(row.refused as string);

  // Only on the actual transition — `already` means someone accepted it a
  // moment ago and the customer has been told once already.
  if (row.accepted) {
    notifyOrder(token.data, "accepted", { audience: "customer" });
  }

  revalidatePath("/kitchen");
  revalidatePath(`/order/${token.data}`);
  revalidatePath("/orders");
}

/**
 * Reject an order the kitchen cannot take.
 *
 * Cancels, then refunds through the same path as any other cancellation —
 * cancelOrder() is the single place that moves money back, so a rejection
 * cannot quietly keep a customer's payment.
 */
export async function rejectOrder(formData: FormData): Promise<void> {
  if (!(await isKitchenAuthed())) throw new Error("Not authorised.");

  const parsed = z
    .object({
      publicToken: z.uuid(),
      reason: z.string().trim().max(200).optional(),
    })
    .safeParse({
      publicToken: formData.get("publicToken"),
      reason: formData.get("reason"),
    });
  if (!parsed.success) throw new Error("Invalid rejection.");

  const outcome = await cancelOrder(
    parsed.data.publicToken,
    "kitchen",
    parsed.data.reason?.trim()
      ? `The kitchen could not take this order — ${parsed.data.reason.trim()}`
      : "The kitchen could not take this order",
  );
  if (!outcome.ok) throw new Error(outcome.error);

  if (outcome.refundPending) {
    console.error(
      "[kitchen] REJECTED but refund outstanding:",
      outcome.orderNumber,
    );
  }

  revalidatePath("/kitchen");
}

/**
 * Retry a refund that failed the first time.
 *
 * No new logic: cancel_order() keeps reporting refund_due for a cancelled order
 * whose money is still held, so calling cancelOrder() again picks up exactly
 * where the failed attempt left off. The idempotency key means a retry after a
 * timeout returns the original refund rather than issuing a second one.
 */
export async function retryRefund(formData: FormData): Promise<void> {
  if (!(await isKitchenAuthed())) throw new Error("Not authorised.");

  const token = z.uuid().safeParse(formData.get("publicToken"));
  if (!token.success) throw new Error("Invalid order.");

  const outcome = await cancelOrder(token.data, "kitchen");
  if (!outcome.ok) throw new Error(outcome.error);

  if (outcome.refundPending) {
    // Still owed. The row stays in the panel, which is the point.
    console.error("[kitchen] refund retry did not settle:", outcome.orderNumber);
  }

  revalidatePath("/kitchen");
}

/**
 * Record a refund the kitchen sent by hand.
 *
 * The escape hatch for manual UPI, where there is no gateway to call, and for
 * a gateway refund that had to be done from the Razorpay dashboard. The
 * reference is whatever identifies the transfer — a UTR, usually — so the
 * payment can be traced later.
 */
export async function markRefundedManually(formData: FormData): Promise<void> {
  if (!(await isKitchenAuthed())) throw new Error("Not authorised.");

  const parsed = z
    .object({
      publicToken: z.uuid(),
      reference: z.string().trim().max(80).optional(),
    })
    .safeParse({
      publicToken: formData.get("publicToken"),
      reference: formData.get("reference"),
    });
  if (!parsed.success) throw new Error("Invalid refund reference.");

  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Service role key is not configured.");

  const { data: order } = await supabase
    .from("orders")
    .select("order_number, total_paise")
    .eq("public_token", parsed.data.publicToken)
    .maybeSingle();

  if (!order) throw new Error("Could not find that order.");

  // Prefixed so a hand-entered reference can never be mistaken for a gateway
  // refund id during reconciliation.
  const reference = parsed.data.reference?.trim()
    ? `manual:${parsed.data.reference.trim()}`
    : `manual:${order.order_number}`;

  const { error } = await supabase.rpc("mark_order_refunded", {
    p_public_token: parsed.data.publicToken,
    p_refund_id: reference,
    p_amount_paise: order.total_paise,
  });

  if (error) {
    console.error("[kitchen] manual refund record failed:", error);
    throw new Error("Could not record that refund.");
  }

  revalidatePath("/kitchen");
}

export async function markPaid(formData: FormData): Promise<void> {
  if (!(await isKitchenAuthed())) throw new Error("Not authorised.");

  const orderId = z.uuid().safeParse(formData.get("orderId"));
  if (!orderId.success) throw new Error("Invalid order.");

  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Service role key is not configured.");

  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      status: "confirmed",
      reserved_until: null,
    })
    .eq("id", orderId.data)
    .eq("payment_status", "unpaid");

  if (error) {
    console.error("[kitchen] mark paid failed:", error);
    throw new Error("Could not mark that order paid.");
  }

  revalidatePath("/kitchen");
}
