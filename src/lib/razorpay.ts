import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay, called over plain fetch rather than the SDK.
 *
 * The three things we need — create an order, verify a checkout signature,
 * verify a webhook signature — are one POST and two HMACs. The SDK would add a
 * dependency for that.
 */

const API_BASE = "https://api.razorpay.com/v1";

export const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

export const hasRazorpayConfig = Boolean(RAZORPAY_KEY_ID && KEY_SECRET);
export const hasWebhookSecret = Boolean(WEBHOOK_SECRET);

/** Test keys are prefixed rzp_test_. Worth surfacing so nobody ships them. */
export const isRazorpayTestMode = RAZORPAY_KEY_ID.startsWith("rzp_test_");

type CreateOrderResult =
  | { ok: true; id: string; amount: number }
  | { ok: false; error: string };

export async function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<CreateOrderResult> {
  if (!hasRazorpayConfig) return { ok: false, error: "Razorpay is not configured." };

  // Razorpay rejects anything under ₹1. Better to say so than to surface
  // "amount must be atleast INR 1.00" to a customer.
  if (!Number.isInteger(input.amountPaise) || input.amountPaise < 100) {
    return { ok: false, error: "Order total is too small to pay online." };
  }

  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${KEY_SECRET}`).toString("base64");

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: "INR",
        receipt: input.receipt,
        notes: input.notes ?? {},
      }),
      cache: "no-store",
    });
  } catch (cause) {
    console.error("[razorpay] create order network failure:", cause);
    return { ok: false, error: "Could not reach the payment provider." };
  }

  const body = (await response.json().catch(() => null)) as
    | { id?: string; amount?: number; error?: { description?: string } }
    | null;

  if (!response.ok || !body?.id) {
    console.error("[razorpay] create order failed:", response.status, body);
    return { ok: false, error: "Could not start the payment. Please try again." };
  }

  return { ok: true, id: body.id, amount: body.amount ?? input.amountPaise };
}

type RefundResult =
  | { ok: true; id: string; amount: number; status: string }
  | { ok: false; error: string; alreadyRefunded?: boolean };

/**
 * Refunds a captured payment in full.
 *
 * `speed: "normal"` puts it through the standard settlement cycle — customers
 * see it in 5–7 working days, which is what /refunds promises. "optimum" is
 * faster and costs a fee, so it is not the default for a home kitchen.
 *
 * Razorpay accepts an idempotency-style guard of its own: refunding an already
 * fully-refunded payment fails rather than double-paying, and that case is
 * reported back distinctly so the caller can treat it as success.
 */
export async function refundPayment(input: {
  paymentId: string;
  amountPaise: number;
  notes?: Record<string, string>;
}): Promise<RefundResult> {
  if (!hasRazorpayConfig) return { ok: false, error: "Razorpay is not configured." };

  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${KEY_SECRET}`).toString("base64");

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/payments/${input.paymentId}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        speed: "normal",
        notes: input.notes ?? {},
      }),
      cache: "no-store",
    });
  } catch (cause) {
    console.error("[razorpay] refund network failure:", cause);
    return { ok: false, error: "Could not reach the payment provider." };
  }

  const body = (await response.json().catch(() => null)) as
    | {
        id?: string;
        amount?: number;
        status?: string;
        error?: { description?: string; reason?: string };
      }
    | null;

  if (!response.ok || !body?.id) {
    const description = body?.error?.description ?? "";
    console.error("[razorpay] refund failed:", response.status, body);

    // Refunding twice is not a failure worth surfacing as one — the customer
    // has their money either way.
    if (/already.*refund|fully refunded/i.test(description)) {
      return { ok: false, error: description, alreadyRefunded: true };
    }
    return {
      ok: false,
      error: description || "The refund could not be processed.",
    };
  }

  return {
    ok: true,
    id: body.id,
    amount: body.amount ?? input.amountPaise,
    status: body.status ?? "processed",
  };
}

/** Constant-time compare of two hex digests of possibly differing length. */
function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verifies the signature Checkout hands back to the browser.
 *
 * Signed payload is `<razorpay_order_id>|<razorpay_payment_id>` under the API
 * key secret. Without this check, a customer could post any payment id they
 * liked and have us mark the order paid.
 */
export function verifyCheckoutSignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  if (!hasRazorpayConfig) return false;
  const expected = createHmac("sha256", KEY_SECRET)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest("hex");
  return safeEqualHex(expected, input.signature);
}

/**
 * Verifies a webhook.
 *
 * Signed payload is the **raw request body**, under the webhook secret — which
 * is a different secret from the API key. Re-serialising parsed JSON changes
 * whitespace and key order and the signature stops matching, so the caller must
 * pass the exact bytes it received.
 */
export function verifyWebhookSignature(input: {
  rawBody: string;
  signature: string;
}): boolean {
  if (!hasWebhookSecret) return false;
  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(input.rawBody)
    .digest("hex");
  return safeEqualHex(expected, input.signature);
}
