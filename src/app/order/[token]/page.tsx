import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, Clock, MapPin, Phone } from "lucide-react";
import { CancelOrderButton } from "@/components/cancel-order-button";
import { PayNow } from "@/components/pay-now";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CANCELLATION_CUTOFF_HOURS } from "@/lib/business";
import { formatDayLabel, formatTime, slotStartMs } from "@/lib/dates";
import { isRazorpayTestMode } from "@/lib/razorpay";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Order confirmed" };
export const dynamic = "force-dynamic";

type OrderView = {
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  fulfilment_date: string;
  fulfilment_type: "pickup" | "delivery";
  delivery_address: string | null;
  delivery_notes: string | null;
  subtotal_paise: number;
  total_paise: number;
  slot_label: string;
  slot_start: string;
  slot_end: string;
  items: { name: string; quantity: number; unit_price_paise: number }[];
};

const STATUS_COPY: Record<string, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  preparing: "Being cooked",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ pay?: string }>;
}) {
  const { token } = await params;
  // Checkout sends ?pay=1 so the payment window opens without a second click.
  const { pay } = await searchParams;
  const supabase = createSupabasePublicClient();
  if (!supabase) notFound();

  const { data, error } = await supabase.rpc("get_order_by_token", {
    p_token: token,
  });

  if (error) {
    console.error("[order] lookup failed:", error);
    notFound();
  }
  if (!data) notFound();

  const order = data as OrderView;

  const awaitingOnlinePayment =
    order.payment_method === "razorpay" &&
    order.payment_status !== "paid" &&
    order.status !== "cancelled";

  // Shown only while self-cancellation would actually succeed. cancel_order()
  // re-checks the same boundary server-side and is the authority; this just
  // avoids offering a button that would be refused.
  const cancellableUntil =
    slotStartMs(order.fulfilment_date, order.slot_start) -
    CANCELLATION_CUTOFF_HOURS * 60 * 60 * 1000;

  const canCancel =
    order.status !== "cancelled" &&
    order.status !== "completed" &&
    Date.now() < cancellableUntil;

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="text-center">
          {awaitingOnlinePayment ? (
            <Clock className="mx-auto size-14 text-accent" aria-hidden />
          ) : (
            <CheckCircle2 className="mx-auto size-14 text-veg" aria-hidden />
          )}
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
            {awaitingOnlinePayment ? "Almost there" : "Order confirmed"}
          </h1>
          <p className="mt-2 text-muted">
            {awaitingOnlinePayment
              ? "Your slot is held — complete the payment to confirm it."
              : `Thanks ${order.customer_name.split(" ")[0]} — we've got it.`}
          </p>
          <p className="mt-4 inline-block rounded-full bg-surface-alt px-4 py-1.5 font-mono text-sm">
            {order.order_number}
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {awaitingOnlinePayment ? (
            <PayNow
              publicToken={token}
              amountPaise={order.total_paise}
              autoOpen={pay === "1"}
              testMode={isRazorpayTestMode}
            />
          ) : null}

          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="size-4 text-primary" aria-hidden />
              {formatDayLabel(order.fulfilment_date)},{" "}
              {formatTime(order.slot_start)} – {formatTime(order.slot_end)}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {order.fulfilment_type === "delivery"
                ? order.delivery_address
                : "Pickup from the kitchen"}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              <Phone className="size-4 shrink-0" aria-hidden />
              {order.customer_phone}
            </p>
            {order.delivery_notes ? (
              <p className="mt-3 rounded-lg bg-surface-alt px-3 py-2 text-sm text-muted">
                “{order.delivery_notes}”
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Items</h2>
              <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                {STATUS_COPY[order.status] ?? order.status}
              </span>
            </div>

            <ul className="mt-4 space-y-2.5 text-sm">
              {order.items.map((item) => (
                <li key={item.name} className="flex justify-between gap-4">
                  <span>
                    {item.name}
                    <span className="text-muted"> × {item.quantity}</span>
                  </span>
                  <span className="tabular-nums">
                    {formatPaise(item.unit_price_paise * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex justify-between border-t border-border pt-3 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {formatPaise(order.total_paise)}
              </span>
            </div>

            <p className="mt-3 text-xs text-muted">
              {order.payment_method === "cod"
                ? "Pay when you collect or receive the order."
                : order.payment_method === "razorpay"
                  ? order.payment_status === "paid"
                    ? "Paid online. Nothing more to do."
                    : "Awaiting online payment."
                  : "We'll confirm your UPI transfer and update this page."}
            </p>
          </div>
        </div>

        {canCancel ? (
          <div className="mt-6">
            <CancelOrderButton
              publicToken={token}
              wasPaid={order.payment_status === "paid"}
            />
          </div>
        ) : order.status === "cancelled" ? (
          <p className="mt-6 rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm text-muted">
            This order was cancelled.
            {order.payment_status === "refunded"
              ? " Your refund has been issued and usually reaches your account in 5–7 working days."
              : order.payment_status === "paid"
                ? " A refund is owed on this order and we are processing it."
                : ""}
          </p>
        ) : order.status !== "completed" ? (
          <p className="mt-6 text-sm text-muted">
            Free cancellation closed {CANCELLATION_CUTOFF_HOURS} hours before
            your slot.{" "}
            <Link
              href="/contact"
              className="font-medium text-primary hover:underline"
            >
              Contact us
            </Link>{" "}
            if you need to change this order.
          </p>
        ) : null}

        <p className="mt-8 text-center text-sm text-muted">
          Bookmark this page to check your order status.{" "}
          <Link href="/" className="font-medium text-primary hover:underline">
            Back to the menu
          </Link>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
