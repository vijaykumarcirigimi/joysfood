import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircle,
  ChefHat,
  ClipboardList,
  IndianRupee,
  LogOut,
  MapPin,
  Phone,
} from "lucide-react";
import { addDays, formatDayLabel, formatTime, istToday } from "@/lib/dates";
import {
  buildPrepSheet,
  getRefundsOwed,
  getKitchenOrders,
  groupBySlot,
  NEXT_STATUS,
  type KitchenOrder,
} from "@/lib/kitchen";
import { isKitchenAuthed, isKitchenConfigured } from "@/lib/kitchen-auth";
import { cn, formatPaise } from "@/lib/utils";
import { kitchenLogout, markPaid, updateOrderStatus } from "./actions";
import { LoginForm } from "./login-form";
import { RefundsOwed } from "./refunds-owed";

export const metadata: Metadata = { title: "Kitchen", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  pending_payment: "bg-accent/20 text-accent-foreground",
  confirmed: "bg-primary-soft text-primary",
  preparing: "bg-accent/20 text-text",
  ready: "bg-veg/15 text-veg",
  completed: "bg-surface-alt text-muted",
  cancelled: "bg-nonveg/10 text-nonveg",
};

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function KitchenPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  if (!isKitchenConfigured()) {
    return (
      <Shell>
        <p className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Set <code className="mx-1 font-mono">KITCHEN_PASSWORD</code> (at least
          8 characters) in <code className="mx-1 font-mono">.env.local</code> and
          restart the server.
        </p>
      </Shell>
    );
  }

  if (!(await isKitchenAuthed())) {
    return (
      <Shell>
        <LoginForm />
      </Shell>
    );
  }

  const { date } = await searchParams;
  const today = istToday();
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? date! : today;

  const [{ orders, error }, refundsOwed] = await Promise.all([
    getKitchenOrders(selected, selected),
    // Not scoped to the selected date — money owed must follow the kitchen
    // around whichever day they are looking at.
    getRefundsOwed(),
  ]);
  const prepSheet = buildPrepSheet(orders);
  const slotGroups = groupBySlot(orders);

  const dates = Array.from({ length: 10 }, (_, i) => addDays(today, i - 1));

  return (
    <Shell wide>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Kitchen
          </h1>
          <p className="text-sm text-muted">
            {formatDayLabel(selected)} · {orders.length}{" "}
            {orders.length === 1 ? "order" : "orders"}
          </p>
        </div>
        <form action={kitchenLogout}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-primary"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </form>
      </div>

      <div className="no-scrollbar mb-8 flex gap-2 overflow-x-auto pb-1">
        {dates.map((d) => (
          <Link
            key={d}
            href={`/kitchen?date=${d}`}
            className={cn(
              "shrink-0 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
              d === selected
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-surface hover:border-primary/40",
            )}
          >
            {formatDayLabel(d)}
          </Link>
        ))}
      </div>

      {error ? (
        <p className="mb-6 flex items-start gap-2 rounded-xl border border-nonveg/40 bg-nonveg/10 p-4 text-sm text-nonveg">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {/* Above the queue on purpose: an unpaid refund outranks today's cooking. */}
      <RefundsOwed orders={refundsOwed} />

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-8">
          {slotGroups.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
              No orders for {formatDayLabel(selected).toLowerCase()}.
            </p>
          ) : (
            slotGroups.map((group) => (
              <section key={group.label}>
                <h2 className="mb-3 flex items-center gap-2 font-semibold">
                  <ChefHat className="size-4 text-primary" aria-hidden />
                  {group.label}
                  <span className="text-sm font-normal text-muted">
                    · {group.orders.length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {group.orders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <ClipboardList className="size-4 text-primary" aria-hidden />
              Prep sheet
            </h2>
            <p className="mt-1 text-xs text-muted">
              {formatDayLabel(selected)} · excludes cancelled and unpaid holds
            </p>

            {prepSheet.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Nothing to cook yet.</p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {prepSheet.map((row) => (
                  <li key={row.name} className="flex justify-between gap-3">
                    <span>{row.name}</span>
                    <span className="shrink-0 font-semibold whitespace-nowrap tabular-nums">
                      × {row.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function OrderCard({ order }: { order: KitchenOrder }) {
  const next = NEXT_STATUS[order.status];

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold">
            {order.order_number}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {order.slot
              ? `${formatTime(order.slot.start_time)} – ${formatTime(order.slot.end_time)}`
              : "No slot"}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            STATUS_STYLES[order.status] ?? "bg-surface-alt text-muted",
          )}
        >
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {order.items.map((item) => (
          <li key={item.item_name_snapshot}>
            <span className="font-semibold tabular-nums">{item.quantity}×</span>{" "}
            {item.item_name_snapshot}
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-1 text-sm text-muted">
        <p className="flex items-center gap-2">
          <Phone className="size-3.5 shrink-0" aria-hidden />
          {order.customer_name} · {order.customer_phone}
        </p>
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {order.fulfilment_type === "delivery"
            ? order.delivery_address
            : "Pickup"}
        </p>
        <p className="flex items-center gap-2">
          <IndianRupee className="size-3.5 shrink-0" aria-hidden />
          {formatPaise(order.total_paise)} ·{" "}
          {order.payment_status === "paid" ? "paid" : "unpaid"} (
          {order.payment_method})
        </p>
        {order.delivery_notes ? (
          <p className="rounded-lg bg-surface-alt px-3 py-2 text-text">
            “{order.delivery_notes}”
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {order.payment_status === "unpaid" && order.status !== "cancelled" ? (
          <form action={markPaid}>
            <input type="hidden" name="orderId" value={order.id} />
            <button
              type="submit"
              className="rounded-lg border border-veg/40 px-3 py-1.5 text-xs font-semibold text-veg hover:bg-veg/10"
            >
              Mark paid
            </button>
          </form>
        ) : null}

        {next ? (
          <form action={updateOrderStatus}>
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="status" value={next} />
            <button
              type="submit"
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:bg-primary-hover"
            >
              Move to {STATUS_LABEL[next]?.toLowerCase()}
            </button>
          </form>
        ) : null}

        {order.status !== "cancelled" && order.status !== "completed" ? (
          <form action={updateOrderStatus}>
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="status" value="cancelled" />
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-nonveg/40 hover:text-nonveg"
            >
              Cancel
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

function Shell({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-bg">
      <div
        className={cn(
          "mx-auto px-4 py-10",
          wide ? "max-w-[1140px]" : "flex max-w-md flex-col items-center",
        )}
      >
        {children}
      </div>
    </div>
  );
}
