import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { sendOrderEmail } from "@/lib/email";
import { hasWebhookSecret, verifyWebhookSignature } from "@/lib/razorpay";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Razorpay webhook — the authority on whether an order is paid.
 *
 * The browser callback in actions/razorpay.ts is a convenience so the customer
 * sees "confirmed" immediately. This is what makes it *true*, because it
 * arrives even when the customer closes the tab the instant they pay.
 *
 * Three rules govern everything here:
 *
 *   1. Verify the signature over the RAW body before parsing. Anyone can POST
 *      to this URL.
 *   2. Be idempotent. Razorpay retries for up to 24 hours on any non-2xx, so a
 *      replay must change nothing.
 *   3. Return 2xx for anything we have deliberately decided not to act on. A
 *      500 on an event we simply don't handle earns hours of pointless retries.
 */

// Must stay dynamic: it reads a request body and a header.
export const dynamic = "force-dynamic";

type RazorpayWebhook = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        status?: string;
        error_description?: string;
      };
    };
  };
};

export async function POST(request: Request) {
  if (!hasWebhookSecret) {
    // Refusing is safer than accepting unverifiable payment events.
    console.error("[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const signature = request.headers.get("x-razorpay-signature");
  // Razorpay's own id for this event, stable across its retries.
  const eventId = request.headers.get("x-razorpay-event-id");

  if (!signature || !eventId) {
    return NextResponse.json({ error: "missing headers" }, { status: 400 });
  }

  // The exact bytes, not a re-serialised object — see verifyWebhookSignature.
  const rawBody = await request.text();

  if (!verifyWebhookSignature({ rawBody, signature })) {
    console.error("[razorpay-webhook] signature rejected, event", eventId);
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let body: RazorpayWebhook;
  try {
    body = JSON.parse(rawBody) as RazorpayWebhook;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const eventType = body.event ?? "unknown";
  const payment = body.payload?.payment?.entity;

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    // Retryable: our fault, and we want Razorpay to come back.
    console.error("[razorpay-webhook] service role key missing");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  // Claim the event first. The unique constraint on (provider, event_id) means
  // a replay loses this insert and we can stop, without having touched the
  // order twice. Recording before acting is the safer order: a duplicate
  // confirmation is worse than a missing audit row.
  const { error: claimError } = await supabase.from("payment_events").insert({
    provider: "razorpay",
    event_id: eventId,
    event_type: eventType,
    payload: body as unknown as Record<string, unknown>,
  });

  if (claimError) {
    // 23505 = unique_violation: we have seen this exact event already.
    if (claimError.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[razorpay-webhook] could not record event:", claimError);
    return NextResponse.json({ error: "storage" }, { status: 500 });
  }

  if (eventType === "payment.captured" || eventType === "payment.authorized") {
    if (!payment?.id || !payment.order_id) {
      // Nothing actionable, but the signature was valid — do not make Razorpay
      // retry a payload we will never be able to use.
      console.error("[razorpay-webhook] captured event without ids", eventId);
      return NextResponse.json({ ok: true, ignored: "missing ids" });
    }

    const { data, error } = await supabase.rpc("mark_order_paid_by_razorpay", {
      p_rzp_order_id: payment.order_id,
      p_rzp_payment_id: payment.id,
    });

    if (error) {
      console.error("[razorpay-webhook] mark paid failed:", error);
      // Genuinely retryable — let Razorpay try again.
      return NextResponse.json({ error: "update failed" }, { status: 500 });
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row?.found) {
      // Money for an order we do not know about. Loud, but not retryable:
      // trying again will not conjure the order into existence.
      console.error(
        "[razorpay-webhook] PAYMENT FOR UNKNOWN ORDER:",
        payment.order_id,
        payment.id,
      );
      return NextResponse.json({ ok: true, ignored: "unknown order" });
    }

    if (row.needs_refund) {
      console.error(
        "[razorpay-webhook] REFUND DUE — paid after the hold expired:",
        row.order_number,
        payment.id,
      );
    }

    if (row.public_token) {
      revalidatePath(`/order/${row.public_token}`);
      // Only on the transition. already_paid means the browser callback beat us
      // to it and has already emailed the customer.
      if (!row.already_paid) {
        sendOrderEmail(row.public_token as string, "received");
      }
    }
    revalidatePath("/orders");
    revalidatePath("/kitchen");

    return NextResponse.json({
      ok: true,
      order: row.order_number,
      alreadyPaid: row.already_paid,
      needsRefund: row.needs_refund,
    });
  }

  if (eventType === "payment.failed") {
    // Deliberately does not touch the order. A failed attempt is not a failed
    // order — the customer can try again with another method, and the slot
    // stays held until reserved_until lapses and the sweeper cancels it.
    console.warn(
      "[razorpay-webhook] payment failed for order",
      payment?.order_id,
      payment?.error_description ?? "",
    );
    return NextResponse.json({ ok: true, noted: "payment.failed" });
  }

  // Subscribed to something we do not handle. Recorded above, acknowledged
  // here, so it does not sit in Razorpay's retry queue.
  return NextResponse.json({ ok: true, ignored: eventType });
}

/** A GET is almost always someone checking the URL is live. Tell them. */
export async function GET() {
  return NextResponse.json(
    { ok: true, endpoint: "razorpay webhook", method: "POST only" },
    { status: 200 },
  );
}
