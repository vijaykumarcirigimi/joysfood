import "server-only";

import { formatDayLabel, formatTime } from "@/lib/dates";
import { pushToCustomer, pushToStaff } from "@/lib/push";
import { emailsFor } from "@/lib/recipients";
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
  status: string;
  slot: { start_time: string; end_time: string } | null;
  items:
    | { item_name_snapshot: string; quantity: number; unit_price_paise_snapshot: number }[]
    | null;
};

const SELECT = `
  order_number, public_token, customer_name, customer_phone, customer_email,
  fulfilment_date, fulfilment_type, delivery_address, delivery_notes,
  total_paise, payment_method, payment_status, status,
  slot:time_slots ( start_time, end_time ),
  items:order_items ( item_name_snapshot, quantity, unit_price_paise_snapshot )
`;

/** What the customer needs to know about money, in one sentence. */
function paymentLine(order: OrderRow, kind: EmailKind): string {
  if (kind === "received" && order.status === "awaiting_acceptance") {
    const paid =
      order.payment_status === "paid"
        ? "Your payment has gone through. "
        : order.payment_method === "cod"
          ? "Nothing to pay yet. "
          : "";
    return `${paid}The kitchen will confirm your order shortly — we'll email you the moment it does.`;
  }

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

/**
 * "received" is not the same as "accepted", and conflating them is how a
 * customer ends up told their order is confirmed before the kitchen has seen
 * it. received = we have it and are looking; accepted = we are cooking it.
 */
export type EmailKind = "received" | "accepted" | "cancelled";

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

/**
 * Email and push together, for the events that warrant both.
 *
 * A new order has to reach the kitchen even if they are not looking at the
 * screen, and email alone does not buzz a phone. Each channel fails
 * independently — a dead push subscription must not stop the email.
 */
export function notifyOrder(
  publicToken: string,
  kind: EmailKind,
  // The customer's user_id is looked up here rather than passed in: every
  // caller would otherwise have to fetch it, and one forgetting to would
  // silently stop notifying that customer's other devices.
  push?: { audience: "staff" } | { audience: "customer" },
): void {
  sendOrderEmail(publicToken, kind);
  if (!push) return;

  void (async () => {
    const summary = await orderSummary(publicToken);
    if (!summary) return;

    if (push.audience === "staff") {
      pushToStaff({
        title: `New order — ${summary.orderNumber}`,
        body: `${summary.when} · ${summary.total} · ${summary.items}`,
        url: "/kitchen",
        tag: `order-${summary.orderNumber}`,
        // The kitchen must not miss this one; it stays until acknowledged.
        requireInteraction: true,
      });
      return;
    }

    const copy = CUSTOMER_PUSH[kind];
    pushToCustomer(publicToken, summary.userId, {
      title: `${copy.title} — ${summary.orderNumber}`,
      body: copy.body(summary.when),
      url: `/order/${publicToken}`,
      tag: `order-${summary.orderNumber}`,
    });
  })().catch((error) => console.error("[notify] push failed:", error));
}

const CUSTOMER_PUSH: Record<
  EmailKind,
  { title: string; body: (when: string) => string }
> = {
  received: {
    title: "Order received",
    body: (when) => `We've got it. The kitchen will confirm shortly — for ${when}.`,
  },
  accepted: {
    title: "Order confirmed",
    body: (when) => `The kitchen has confirmed your order for ${when}.`,
  },
  cancelled: {
    title: "Order cancelled",
    body: () => "Your order has been cancelled. Tap for the details.",
  },
};

/** The few fields a notification needs, without loading the whole order. */
async function orderSummary(publicToken: string): Promise<{
  orderNumber: string;
  when: string;
  total: string;
  items: string;
  userId: string | null;
} | null> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("orders")
    .select(
      "order_number, fulfilment_date, total_paise, user_id, slot:time_slots(start_time), items:order_items(item_name_snapshot, quantity)",
    )
    .eq("public_token", publicToken)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as {
    order_number: string;
    fulfilment_date: string;
    total_paise: number;
    user_id: string | null;
    slot: { start_time: string } | null;
    items: { item_name_snapshot: string; quantity: number }[] | null;
  };

  const items = (row.items ?? [])
    .map((i) => `${i.quantity}× ${i.item_name_snapshot}`)
    .join(", ");

  return {
    orderNumber: row.order_number,
    when: `${formatDayLabel(row.fulfilment_date)}${row.slot ? `, ${formatTime(row.slot.start_time)}` : ""}`,
    total: formatPaise(row.total_paise),
    items: items.length > 90 ? `${items.slice(0, 90)}…` : items,
    userId: row.user_id,
  };
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

  // Whom to alert now comes from the admin-editable list. An empty result is
  // not an error: the relay falls back to its own KITCHEN_EMAIL, so emptying
  // the list by accident makes the kitchen quieter, never silent.
  const staffEmails = await emailsFor(
    kind === "cancelled" ? "cancellation" : "new_order",
  );

  const payload = {
    secret: RELAY_SECRET,
    kind,
    staffEmails,
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
