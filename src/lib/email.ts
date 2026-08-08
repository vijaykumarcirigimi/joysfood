import "server-only";

import { formatDayLabel, formatTime } from "@/lib/dates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatPaise } from "@/lib/utils";

/**
 * Order email, relayed through a Google Apps Script web app so the mail comes
 * from the kitchen's own Gmail address.
 *
 * Two rules govern every call here:
 *
 *   1. Sending must never break an order. A customer who has paid does not care
 *      that Gmail was slow — the order is placed either way. Every failure is
 *      logged and swallowed, and callers do not await a result they can act on.
 *
 *   2. The relay URL is world-callable. Apps Script requires "Anyone" access
 *      for an unauthenticated server to POST, so the shared secret is the only
 *      thing standing between a leaked URL and someone sending mail from the
 *      kitchen's real address.
 */

const RELAY_URL = process.env.APPS_SCRIPT_EMAIL_URL ?? "";
const RELAY_SECRET = process.env.APPS_SCRIPT_EMAIL_SECRET ?? "";

export const hasEmailRelay = Boolean(RELAY_URL && RELAY_SECRET);

type OrderRow = {
  order_number: string;
  public_token: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  fulfilment_date: string;
  fulfilment_type: "pickup" | "delivery";
  delivery_address: string | null;
  delivery_notes: string | null;
  total_paise: number;
  payment_method: string;
  payment_status: string;
  slot: { start_time: string; end_time: string } | null;
  items:
    | { item_name_snapshot: string; quantity: number; unit_price_paise_snapshot: number }[]
    | null;
};

const SELECT = `
  order_number, public_token, customer_name, customer_phone, customer_email,
  fulfilment_date, fulfilment_type, delivery_address, delivery_notes,
  total_paise, payment_method, payment_status,
  slot:time_slots ( start_time, end_time ),
  items:order_items ( item_name_snapshot, quantity, unit_price_paise_snapshot )
`;

/** What the customer needs to know about money, in one sentence. */
function paymentLine(order: OrderRow, kind: EmailKind): string {
  if (kind === "cancelled") {
    if (order.payment_status === "refunded") {
      return "Your refund has been issued and usually reaches your account in 5–7 working days.";
    }
    if (order.payment_status === "paid") {
      return "We are processing your refund and will confirm once it is on its way.";
    }
    return "Nothing was charged for this order.";
  }

  if (order.payment_method === "cod") {
    return "Pay when you collect or receive the order.";
  }
  if (order.payment_method === "razorpay") {
    return order.payment_status === "paid"
      ? "Paid online — nothing more to do."
      : "Awaiting your online payment.";
  }
  return "Please complete your UPI transfer; we will confirm it by hand.";
}

export type EmailKind = "confirmed" | "cancelled";

/**
 * Fire-and-forget. Deliberately returns void rather than a promise the caller
 * might be tempted to await inside a checkout path.
 */
export function sendOrderEmail(publicToken: string, kind: EmailKind): void {
  if (!hasEmailRelay) return;

  void deliver(publicToken, kind).catch((error) => {
    console.error("[email] unexpected relay failure:", error);
  });
}

async function deliver(publicToken: string, kind: EmailKind): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("orders")
    .select(SELECT)
    .eq("public_token", publicToken)
    .maybeSingle();

  if (error || !data) {
    console.error("[email] could not load order:", publicToken, error);
    return;
  }

  const order = data as unknown as OrderRow;

  // The kitchen alert is worth sending even when the customer left no address,
  // so this is not an early return on a missing customer_email — the relay
  // decides per recipient.
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";

  const payload = {
    secret: RELAY_SECRET,
    kind,
    order: {
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerEmail: order.customer_email,
      day: formatDayLabel(order.fulfilment_date),
      slot: order.slot
        ? `${formatTime(order.slot.start_time)} – ${formatTime(order.slot.end_time)}`
        : "",
      fulfilmentType: order.fulfilment_type,
      deliveryAddress: order.delivery_address,
      notes: order.delivery_notes,
      total: formatPaise(order.total_paise),
      paymentLine: paymentLine(order, kind),
      orderUrl: `${origin}/order/${order.public_token}`,
      items: (order.items ?? []).map((item) => ({
        name: item.item_name_snapshot,
        quantity: item.quantity,
        total: formatPaise(item.unit_price_paise_snapshot * item.quantity),
      })),
    },
  };

  try {
    const response = await fetch(RELAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      // Apps Script is not fast and occasionally stalls. Better to give up than
      // to hold a server action open behind it.
      signal: AbortSignal.timeout(10_000),
    });

    // Apps Script answers 200 with {ok:false} rather than an HTTP error, and it
    // 302s to script.googleusercontent.com on success — so the body is the only
    // reliable signal.
    const body = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string; sent?: string[] }
      | null;

    if (!body?.ok) {
      console.error(
        "[email] relay rejected:",
        order.order_number,
        body?.error ?? `http ${response.status}`,
      );
      return;
    }

    console.log("[email] sent", kind, order.order_number, body.sent ?? []);
  } catch (cause) {
    console.error("[email] relay unreachable:", order.order_number, cause);
  }
}
