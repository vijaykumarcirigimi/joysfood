"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  RAZORPAY_KEY_ID,
  createRazorpayOrder,
  hasRazorpayConfig,
  verifyCheckoutSignature,
} from "@/lib/razorpay";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * The order's public token is the capability for these actions. That is
 * deliberate and safe: the only thing it lets a holder do is *pay* for an
 * order, and the amount is read from our database rather than taken from the
 * request. Nobody is attacked by having their bill settled.
 */
const TokenSchema = z.uuid();

export type StartPaymentResult =
  | {
      ok: true;
      keyId: string;
      razorpayOrderId: string;
      amountPaise: number;
      orderNumber: string;
      customerName: string;
      /** E.164, because Checkout rejects a bare 10-digit number. */
      customerContact: string;
      /** Only for signed-in customers; guests have no address on file. */
      customerEmail: string | null;
    }
  | { ok: false; error: string };

export async function startPayment(
  publicToken: string,
): Promise<StartPaymentResult> {
  const token = TokenSchema.safeParse(publicToken);
  if (!token.success) return { ok: false, error: "Invalid order." };
  if (!hasRazorpayConfig) {
    return { ok: false, error: "Online payment is not configured yet." };
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "Payments are not configured yet." };

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, public_token, status, payment_status, payment_method, total_paise, customer_name, customer_phone, razorpay_order_id, reserved_until",
    )
    .eq("public_token", token.data)
    .maybeSingle();

  if (error) {
    console.error("[razorpay] order lookup failed:", error);
    return { ok: false, error: "Could not start the payment. Please try again." };
  }
  if (!order) return { ok: false, error: "We couldn't find that order." };

  if (order.payment_status === "paid") {
    return { ok: false, error: "This order is already paid." };
  }
  if (order.status === "cancelled") {
    return {
      ok: false,
      error: "This order was cancelled, so it can no longer be paid.",
    };
  }
  if (order.payment_method !== "razorpay") {
    return { ok: false, error: "This order is not set up for online payment." };
  }

  // The seat is only held until reserved_until. Taking money after that has
  // lapsed is how you end up owing a refund for a slot you already resold.
  if (order.reserved_until && Date.parse(order.reserved_until) < Date.now()) {
    return {
      ok: false,
      error:
        "The hold on your slot has expired. Please place the order again — the slot may still be free.",
    };
  }

  // Reuse an existing gateway order rather than creating a second one for the
  // same bill: retrying after a dismissed modal must not fragment the payment
  // trail across two order ids.
  let razorpayOrderId = order.razorpay_order_id as string | null;

  if (!razorpayOrderId) {
    const created = await createRazorpayOrder({
      amountPaise: order.total_paise,
      receipt: order.order_number,
      notes: { order_number: order.order_number },
    });
    if (!created.ok) return { ok: false, error: created.error };

    razorpayOrderId = created.id;

    const { error: attachError } = await supabase.rpc("attach_razorpay_order", {
      p_public_token: token.data,
      p_rzp_order_id: razorpayOrderId,
    });
    if (attachError) {
      console.error("[razorpay] attach failed:", attachError);
      return { ok: false, error: "Could not start the payment. Please try again." };
    }
  }

  // E.164 is the format Razorpay documents for prefill.contact; we store a bare
  // 10-digit number because that is what the checkout form validates.
  //
  // Measured, so nobody re-derives it: this does NOT suppress Checkout's
  // "Contact details — enter mobile number to continue" step. That step still
  // appears with a valid E.164 contact AND an email prefilled, so it is an
  // account-level Checkout setting on the Razorpay side, not something the
  // integration controls.
  const phone = order.customer_phone.replace(/\D/g, "");
  const customerContact = phone.length === 10 ? `+91${phone}` : `+${phone}`;

  // Guests have no email; signed-in customers do. Sent when available so
  // Checkout has one less thing to ask for.
  const user = await getCurrentUser();

  return {
    ok: true,
    keyId: RAZORPAY_KEY_ID,
    razorpayOrderId,
    amountPaise: order.total_paise,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerContact,
    customerEmail: user?.email ?? null,
  };
}

const ConfirmSchema = z.object({
  publicToken: z.uuid(),
  razorpayOrderId: z.string().trim().min(6).max(64),
  razorpayPaymentId: z.string().trim().min(6).max(64),
  signature: z.string().trim().regex(/^[a-f0-9]{64}$/i, "Bad signature"),
});

export type ConfirmPaymentResult =
  | { ok: true; alreadyPaid: boolean }
  | { ok: false; error: string };

/**
 * Confirms the payment the browser just completed.
 *
 * This exists for responsiveness, not for correctness: the webhook is the
 * authority and will confirm the same payment independently. Both paths call
 * the same idempotent SQL function, so whichever arrives second is a no-op.
 */
export async function confirmPayment(
  input: unknown,
): Promise<ConfirmPaymentResult> {
  const parsed = ConfirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid payment response." };

  const value = parsed.data;

  if (
    !verifyCheckoutSignature({
      razorpayOrderId: value.razorpayOrderId,
      razorpayPaymentId: value.razorpayPaymentId,
      signature: value.signature,
    })
  ) {
    // Either a forged callback or a key mismatch. Never mark paid on this path.
    console.error(
      "[razorpay] checkout signature rejected for",
      value.razorpayOrderId,
    );
    return { ok: false, error: "We couldn't verify that payment." };
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "Payments are not configured yet." };

  const { data, error } = await supabase.rpc("mark_order_paid_by_razorpay", {
    p_rzp_order_id: value.razorpayOrderId,
    p_rzp_payment_id: value.razorpayPaymentId,
  });

  if (error) {
    console.error("[razorpay] mark paid failed:", error);
    return { ok: false, error: "Payment taken, but we couldn't update the order." };
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row?.found) {
    console.error(
      "[razorpay] verified payment for unknown order",
      value.razorpayOrderId,
    );
    return { ok: false, error: "Payment taken, but we couldn't match the order." };
  }

  if (row.needs_refund) {
    console.error(
      "[razorpay] REFUND DUE — payment after expiry:",
      row.order_number,
      value.razorpayPaymentId,
    );
  }

  revalidatePath(`/order/${value.publicToken}`);
  revalidatePath("/orders");
  revalidatePath("/kitchen");

  return { ok: true, alreadyPaid: Boolean(row.already_paid) };
}
