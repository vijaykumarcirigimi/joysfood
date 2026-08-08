"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notifyOrder } from "@/lib/email";
import { refundPayment } from "@/lib/razorpay";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Cancelling an order, and refunding it if money changed hands.
 *
 * Two steps that must not be collapsed into one: the cancellation commits
 * first, then the gateway is called. If the refund call fails or times out the
 * order is still cancelled and the seat is still free — and cancel_order()
 * keeps reporting refund_due, so running this again finishes the job. The
 * reverse order would risk refunding an order that stayed open.
 */

const TokenSchema = z.uuid();

export type CancelResult =
  | {
      ok: true;
      orderNumber: string;
      /** Money actually sent back to the customer. */
      refunded: boolean;
      /** Cancelled, refund owed, but the gateway did not complete it. */
      refundPending: boolean;
      message: string;
    }
  | { ok: false; error: string };

type Actor = "customer" | "kitchen";

export async function cancelOrder(
  publicToken: string,
  by: Actor = "customer",
  reason?: string,
): Promise<CancelResult> {
  const token = TokenSchema.safeParse(publicToken);
  if (!token.success) return { ok: false, error: "Invalid order." };

  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "Cancellations are not configured yet." };

  const { data, error } = await supabase.rpc("cancel_order", {
    p_public_token: token.data,
    p_by: by,
    p_reason: reason ?? null,
  });

  if (error) {
    console.error("[cancel] rpc failed:", error);
    return { ok: false, error: "We couldn't cancel that order. Please try again." };
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row?.order_exists) {
    return { ok: false, error: "We couldn't find that order." };
  }

  // The window has closed, or the order is already completed. cancel_order()
  // phrases these for the customer.
  if (row.refused_reason) return { ok: false, error: row.refused_reason };

  const orderNumber = row.order_number as string;

  if (!row.refund_due) {
    // Already cancelled means they were emailed the first time round; a repeat
    // call (a retry, a double-click) must not send it again.
    revalidateOrder(token.data, !row.already_cancelled);
    return {
      ok: true,
      orderNumber,
      refunded: false,
      refundPending: false,
      message: row.already_cancelled
        ? "This order was already cancelled."
        : "Your order has been cancelled.",
    };
  }

  // Money is owed back.
  if (row.method !== "razorpay" || !row.payment_id) {
    // A manual UPI transfer has to go back by hand — there is no gateway to
    // ask. Say so plainly rather than implying an automatic refund.
    console.warn(
      "[cancel] MANUAL REFUND DUE:",
      orderNumber,
      row.method,
      row.refund_paise,
    );
    revalidateOrder(token.data);
    return {
      ok: true,
      orderNumber,
      refunded: false,
      refundPending: true,
      message:
        "Your order has been cancelled. We'll transfer your refund back manually and confirm it.",
    };
  }

  const refund = await refundPayment({
    paymentId: row.payment_id as string,
    amountPaise: row.refund_paise as number,
    notes: { order_number: orderNumber, cancelled_by: by },
    // Derived from the order and payment, so every retry of this cancellation
    // sends the same key and Razorpay returns the original refund rather than
    // issuing a second one.
    idempotencyKey: `${orderNumber}:${row.payment_id}`,
  });

  if (!refund.ok && !refund.alreadyRefunded) {
    console.error("[cancel] REFUND FAILED, money still held:", orderNumber, refund.error);
    revalidateOrder(token.data);
    return {
      ok: true,
      orderNumber,
      refunded: false,
      refundPending: true,
      message:
        "Your order has been cancelled. The refund didn't go through automatically — we'll sort it out and confirm.",
    };
  }

  if (refund.ok) {
    const { error: markError } = await supabase.rpc("mark_order_refunded", {
      p_public_token: token.data,
      p_refund_id: refund.id,
      p_amount_paise: refund.amount,
    });
    if (markError) {
      // The customer has their money; our record is behind. Loud, not fatal.
      console.error(
        "[cancel] refund issued but not recorded:",
        orderNumber,
        refund.id,
        markError,
      );
    }
  }

  revalidateOrder(token.data);
  return {
    ok: true,
    orderNumber,
    refunded: true,
    refundPending: false,
    message:
      "Your order has been cancelled and the refund is on its way — it usually reaches your account in 5–7 working days.",
  };
}

/**
 * Revalidate, and tell the customer.
 *
 * Called on every exit path after the cancellation has committed — including
 * the ones where the refund failed, because "cancelled, refund coming" is
 * exactly the message someone needs then. The email reads the order fresh, so
 * whatever payment_status ended up in the row is what it describes.
 */
function revalidateOrder(token: string, notify = true) {
  revalidatePath(`/order/${token}`);
  revalidatePath("/orders");
  revalidatePath("/kitchen");
  if (notify) notifyOrder(token, "cancelled", { audience: "customer" });
}
