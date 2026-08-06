import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, MapPin, Phone } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatDayLabel, formatTime } from "@/lib/dates";
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
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
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

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="text-center">
          <CheckCircle2
            className="mx-auto size-14 text-veg"
            aria-hidden
          />
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
            Order confirmed
          </h1>
          <p className="mt-2 text-muted">
            Thanks {order.customer_name.split(" ")[0]} — we&rsquo;ve got it.
          </p>
          <p className="mt-4 inline-block rounded-full bg-surface-alt px-4 py-1.5 font-mono text-sm">
            {order.order_number}
          </p>
        </div>

        <div className="mt-8 space-y-4">
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
                : "We'll confirm your UPI transfer and update this page."}
            </p>
          </div>
        </div>

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
