import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarClock, MapPin, ReceiptText } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { formatDayLabel, formatTime } from "@/lib/dates";
import { ORDER_STATUS_COPY, getMyOrders } from "@/lib/orders";
import { cn, formatPaise } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Your orders",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Cancelled reads as a problem; everything else is progress. */
function statusTone(status: string): string {
  if (status === "cancelled") return "bg-nonveg/10 text-nonveg";
  if (status === "completed") return "bg-veg/15 text-veg";
  if (status === "pending_payment") return "bg-accent/20 text-text";
  return "bg-primary-soft text-primary";
}

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=%2Forders");

  const orders = await getMyOrders();

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Your orders
        </h1>
        <p className="mt-2 text-sm text-muted">
          Signed in as {user.email}
        </p>

        {orders.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border bg-surface py-16 text-center">
            <ReceiptText className="mx-auto size-10 text-muted" aria-hidden />
            <p className="mt-4 text-lg font-semibold">No orders yet</p>
            <p className="mt-1 text-sm text-muted">
              Orders you place while signed in will show up here.
            </p>
            <Link
              href="/#menu"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-hover"
            >
              Browse the menu
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {orders.map((order) => (
              <li
                key={order.id}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm text-muted">
                      {order.orderNumber}
                    </p>
                    <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold">
                      <CalendarClock
                        className="size-4 shrink-0 text-primary"
                        aria-hidden
                      />
                      {formatDayLabel(order.fulfilmentDate)}
                      {order.slotStart && order.slotEnd ? (
                        <>
                          , {formatTime(order.slotStart)} –{" "}
                          {formatTime(order.slotEnd)}
                        </>
                      ) : null}
                    </p>
                    <p className="mt-1.5 flex items-center gap-2 text-sm text-muted">
                      <MapPin className="size-4 shrink-0" aria-hidden />
                      {order.fulfilmentType === "delivery"
                        ? order.deliveryAddress ?? "Delivery"
                        : "Pickup from the kitchen"}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      statusTone(order.status),
                    )}
                  >
                    {ORDER_STATUS_COPY[order.status] ?? order.status}
                  </span>
                </div>

                <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
                  {order.items.map((item) => (
                    <li
                      key={`${order.id}-${item.name}`}
                      className="flex justify-between gap-4"
                    >
                      <span>
                        {item.name}
                        <span className="text-muted"> × {item.quantity}</span>
                      </span>
                      <span className="tabular-nums text-muted">
                        {formatPaise(item.unitPricePaise * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="font-semibold tabular-nums">
                    {formatPaise(order.totalPaise)}
                    {order.paymentStatus !== "paid" &&
                    order.paymentMethod === "cod" ? (
                      <span className="ml-2 text-xs font-normal text-muted">
                        pay on collection
                      </span>
                    ) : null}
                  </span>
                  <Link
                    href={`/order/${order.publicToken}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    View details
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
