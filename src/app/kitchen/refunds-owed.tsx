import { BadgeIndianRupee, RotateCcw } from "lucide-react";
import type { RefundOwed } from "@/lib/kitchen";
import { formatPaise } from "@/lib/utils";
import { markRefundedManually, retryRefund } from "./actions";

/**
 * Money the kitchen still owes customers.
 *
 * Renders nothing when the list is empty — an always-present "0 refunds owed"
 * box trains people to ignore the space, and this is the one thing on the
 * screen that must be noticed when it appears.
 */
export function RefundsOwed({ orders }: { orders: RefundOwed[] }) {
  if (orders.length === 0) return null;

  const total = orders.reduce((sum, order) => sum + order.total_paise, 0);

  return (
    <section className="mb-8 rounded-2xl border border-nonveg/50 bg-nonveg/5 p-5">
      <h2 className="flex flex-wrap items-center gap-2 font-semibold">
        <BadgeIndianRupee className="size-4 text-nonveg" aria-hidden />
        Refunds owed
        <span className="rounded-full bg-nonveg/15 px-2.5 py-0.5 text-xs font-medium text-nonveg">
          {orders.length} · {formatPaise(total)}
        </span>
      </h2>
      <p className="mt-1 text-xs text-muted">
        These orders were cancelled but the customer&rsquo;s money has not gone
        back. Clear every one of them.
      </p>

      <ul className="mt-4 space-y-3">
        {orders.map((order) => (
          <li
            key={order.id}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm">{order.order_number}</p>
                <p className="mt-0.5 text-sm">
                  {order.customer_name}{" "}
                  <span className="text-muted">· {order.customer_phone}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {order.payment_method === "razorpay"
                    ? "Paid online — refundable through the gateway"
                    : "Paid by manual transfer — send it back by hand"}
                  {order.cancellation_reason
                    ? ` · ${order.cancellation_reason}`
                    : ""}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">
                {formatPaise(order.total_paise)}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Only offer the gateway retry where there is a gateway. */}
              {order.payment_method === "razorpay" &&
              order.razorpay_payment_id ? (
                <form action={retryRefund}>
                  <input
                    type="hidden"
                    name="publicToken"
                    value={order.public_token}
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-hover"
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    Retry refund
                  </button>
                </form>
              ) : null}

              <form
                action={markRefundedManually}
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  type="hidden"
                  name="publicToken"
                  value={order.public_token}
                />
                <label className="sr-only" htmlFor={`ref-${order.id}`}>
                  Refund reference for {order.order_number}
                </label>
                <input
                  id={`ref-${order.id}`}
                  name="reference"
                  type="text"
                  placeholder="UTR / reference"
                  maxLength={80}
                  className="w-40 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold transition-colors hover:border-border-strong"
                >
                  Mark refunded
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
