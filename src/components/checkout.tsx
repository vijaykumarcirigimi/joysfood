"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Loader2,
  Minus,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { placeOrder } from "@/app/actions/place-order";
import { useCart } from "@/lib/cart";
import { formatDayLabel, formatDayParts, formatTime } from "@/lib/dates";
import type { DaySlots } from "@/lib/slots";
import { cn, formatPaise } from "@/lib/utils";

/** Live catalogue snapshot, so a stale cart cannot show a stale price. */
export type CatalogEntry = {
  name: string;
  pricePaise: number;
  isAvailable: boolean;
  prepLeadHours: number;
};

/** Contact details carried over from the customer's last order. */
export type Prefill = {
  name: string;
  phone: string;
  address: string;
  email: string;
};

type Props = {
  days: DaySlots[];
  catalog: Record<string, CatalogEntry>;
  slotsConfigured: boolean;
  /** Null when checking out as a guest. */
  signedInEmail?: string | null;
  prefill?: Prefill | null;
  authAvailable?: boolean;
  /** Razorpay keys present. Hides the online option entirely when false. */
  onlinePaymentAvailable?: boolean;
};

const HOUR_MS = 60 * 60 * 1000;

export function Checkout({
  days,
  catalog,
  slotsConfigured,
  signedInEmail = null,
  prefill = null,
  authAvailable = false,
  onlinePaymentAvailable = false,
}: Props) {
  const router = useRouter();
  const { lines, setQty, clear, ready } = useCart();

  const [selectedDate, setSelectedDate] = useState(days[0]?.date ?? "");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [fulfilmentType, setFulfilmentType] = useState<"pickup" | "delivery">(
    "pickup",
  );
  const [paymentMethod, setPaymentMethod] = useState<
    "cod" | "upi_manual" | "razorpay"
  >(onlinePaymentAvailable ? "razorpay" : "cod");
  // Prefilled from the last order rather than a profile table — it is what the
  // customer most recently typed, so it is the value most likely still correct.
  const [form, setForm] = useState({
    customerName: prefill?.name ?? "",
    customerPhone: prefill?.phone ?? "",
    customerEmail: prefill?.email ?? signedInEmail ?? "",
    deliveryAddress: prefill?.address ?? "",
    deliveryNotes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Rendered on the client only — the server has no business guessing the
  // viewer's clock. Server-side validation in place_order() is the authority.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  /** Cart reconciled against the live menu. */
  const resolved = useMemo(
    () =>
      lines.map((line) => {
        const entry = catalog[line.id];
        return {
          ...line,
          known: Boolean(entry),
          name: entry?.name ?? line.name,
          pricePaise: entry?.pricePaise ?? line.pricePaise,
          isAvailable: entry?.isAvailable ?? false,
          prepLeadHours: entry?.prepLeadHours ?? 0,
          priceChanged: Boolean(entry) && entry.pricePaise !== line.pricePaise,
        };
      }),
    [lines, catalog],
  );

  const orderable = resolved.filter((line) => line.known && line.isAvailable);
  const blocked = resolved.filter((line) => !line.known || !line.isAvailable);

  const subtotal = orderable.reduce(
    (sum, line) => sum + line.pricePaise * line.qty,
    0,
  );

  /** The slowest dish in the cart dictates which slots are reachable. */
  const maxLeadHours = orderable.reduce(
    (max, line) => Math.max(max, line.prepLeadHours),
    0,
  );

  const slotsForDay =
    days.find((day) => day.date === selectedDate)?.slots ?? [];

  const slotStates = slotsForDay.map((slot) => {
    let reason: string | null = null;
    if (slot.isClosed) reason = "Kitchen closed";
    else if (slot.seatsLeft <= 0) reason = "Fully booked";
    else if (now !== null && now > Date.parse(slot.cutoffAt))
      reason = "Ordering closed";
    else if (
      now !== null &&
      maxLeadHours > 0 &&
      Date.parse(slot.startsAt) - now < maxLeadHours * HOUR_MS
    )
      reason = `Needs ${maxLeadHours}h notice`;

    return { slot, disabled: reason !== null, reason };
  });

  // Drop a selection that has become invalid (date changed, slot filled up).
  useEffect(() => {
    if (!selectedSlotId) return;
    const state = slotStates.find((s) => s.slot.slotId === selectedSlotId);
    if (!state || state.disabled) setSelectedSlotId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedSlotId, now, maxLeadHours]);

  const canSubmit =
    orderable.length > 0 &&
    blocked.length === 0 &&
    Boolean(selectedSlotId) &&
    !submitting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    const result = await placeOrder({
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      customerEmail: form.customerEmail,
      fulfilmentDate: selectedDate,
      slotId: selectedSlotId,
      fulfilmentType,
      paymentMethod,
      deliveryAddress: form.deliveryAddress,
      deliveryNotes: form.deliveryNotes,
      items: orderable.map((line) => ({
        menuItemId: line.id,
        quantity: line.qty,
      })),
    });

    if (!result.ok) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      setSubmitting(false);
      // A capacity or cutoff rejection means our view of the slots is stale.
      router.refresh();
      return;
    }

    clear();
    // Online orders land on the order page with the payment window already
    // opening. Routing through the order page rather than opening Checkout here
    // means the order has a durable URL before any money moves — so a dismissed
    // modal, a closed tab or a dropped connection all leave somewhere to retry.
    router.push(
      paymentMethod === "razorpay"
        ? `/order/${result.publicToken}?pay=1`
        : `/order/${result.publicToken}`,
    );
  }

  if (!ready) {
    return (
      <p className="py-16 text-center text-sm text-muted">Loading your cart…</p>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-semibold">Your cart is empty</p>
        <p className="mt-1 text-sm text-muted">
          Add a few dishes and pick a slot that suits you.
        </p>
        <Link
          href="/#menu"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg"
        >
          Browse the menu
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-8">
        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="font-display text-xl font-bold">Your order</h2>
          <ul className="mt-4 space-y-3">
            {resolved.map((line) => (
              <li
                key={line.id}
                className={cn(
                  "flex items-center gap-4 rounded-xl border border-border bg-surface p-3",
                  (!line.known || !line.isAvailable) &&
                    "border-nonveg/40 bg-nonveg/5",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{line.name}</p>
                  <p className="text-sm text-muted">
                    {formatPaise(line.pricePaise)}
                    {line.priceChanged ? (
                      <span className="ml-2 text-xs text-primary">
                        price updated
                      </span>
                    ) : null}
                  </p>
                  {!line.known ? (
                    <p className="mt-1 text-xs text-nonveg">
                      No longer on the menu — remove to continue.
                    </p>
                  ) : !line.isAvailable ? (
                    <p className="mt-1 text-xs text-nonveg">
                      Sold out — remove to continue.
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setQty(line.id, line.qty - 1)}
                    aria-label={`Decrease ${line.name}`}
                    className="flex size-8 items-center justify-center text-muted hover:text-primary"
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </button>
                  <span className="w-7 text-center text-sm font-semibold tabular-nums">
                    {line.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(line.id, line.qty + 1)}
                    aria-label={`Increase ${line.name}`}
                    className="flex size-8 items-center justify-center text-muted hover:text-primary"
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setQty(line.id, 0)}
                  aria-label={`Remove ${line.name}`}
                  className="text-muted transition-colors hover:text-nonveg"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="font-display text-xl font-bold">When do you want it?</h2>

          {!slotsConfigured ? (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-muted">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              No time slots are configured yet. Run{" "}
              <code className="font-mono">supabase/migrations/0002_orders.sql</code>{" "}
              to create them.
            </p>
          ) : (
            <>
              <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
                {days.map((day) => {
                  const parts = formatDayParts(day.date);
                  const isActive = day.date === selectedDate;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      data-testid="date-option"
                      data-date={day.date}
                      onClick={() => setSelectedDate(day.date)}
                      aria-pressed={isActive}
                      className={cn(
                        "flex w-16 shrink-0 flex-col items-center rounded-xl border px-2 py-2.5 transition-colors",
                        isActive
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-surface hover:border-primary/40",
                      )}
                    >
                      <span className="text-[11px] font-medium">
                        {parts.weekday}
                      </span>
                      <span className="text-lg leading-tight font-bold tabular-nums">
                        {parts.day}
                      </span>
                      <span className="text-[11px]">{parts.month}</span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 text-sm font-medium text-muted">
                {formatDayLabel(selectedDate)}
                {maxLeadHours > 0 ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs">
                    <Clock className="size-3" aria-hidden />
                    your cart needs {maxLeadHours}h notice
                  </span>
                ) : null}
              </p>

              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {slotStates.length === 0 ? (
                  <p className="text-sm text-muted">
                    No slots on this day.
                  </p>
                ) : (
                  slotStates.map(({ slot, disabled, reason }) => {
                    const isActive = slot.slotId === selectedSlotId;
                    return (
                      <button
                        key={slot.slotId}
                        type="button"
                        data-testid="slot-option"
                        disabled={disabled}
                        onClick={() => setSelectedSlotId(slot.slotId)}
                        aria-pressed={isActive}
                        className={cn(
                          "rounded-xl border px-4 py-3 text-left transition-colors",
                          disabled
                            ? "cursor-not-allowed border-border bg-surface-alt opacity-60"
                            : isActive
                              ? "border-primary bg-primary-soft"
                              : "border-border bg-surface hover:border-primary/40",
                        )}
                      >
                        <span className="block text-sm font-semibold">
                          {formatTime(slot.startTime)} –{" "}
                          {formatTime(slot.endTime)}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block text-xs",
                            disabled ? "text-muted" : "text-veg",
                          )}
                        >
                          {reason ?? `${slot.seatsLeft} left`}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="font-display text-xl font-bold">Your details</h2>

          {signedInEmail ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
              <UserRound className="size-4 shrink-0 text-primary" aria-hidden />
              Signed in as {signedInEmail} — this order is saved to{" "}
              <Link
                href="/orders"
                className="font-medium text-primary hover:underline"
              >
                your orders
              </Link>
              .
            </p>
          ) : authAvailable ? (
            <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
              <UserRound className="size-4 shrink-0 text-primary" aria-hidden />
              <Link
                href="/signin?next=%2Fcart"
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </Link>
              to save this order to your history — or just carry on as a guest.
            </p>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Name"
              error={fieldErrors.customerName}
              value={form.customerName}
              onChange={(v) => setForm((f) => ({ ...f, customerName: v }))}
              autoComplete="name"
            />
            <Field
              label="Mobile number"
              error={fieldErrors.customerPhone}
              value={form.customerPhone}
              onChange={(v) => setForm((f) => ({ ...f, customerPhone: v }))}
              inputMode="numeric"
              autoComplete="tel"
              placeholder="9876543210"
            />
          </div>

          {/* Optional: requiring an email to buy dinner would cost more orders
              than the confirmation is worth. No address simply means no email. */}
          <div className="mt-4">
            <Field
              label="Email for your confirmation (optional)"
              error={fieldErrors.customerEmail}
              value={form.customerEmail}
              onChange={(v) => setForm((f) => ({ ...f, customerEmail: v }))}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-medium">How will you get it?</legend>
            <div className="mt-2 flex gap-2">
              {(["pickup", "delivery"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFulfilmentType(type)}
                  aria-pressed={fulfilmentType === type}
                  className={cn(
                    "rounded-xl border px-4 py-2.5 text-sm font-medium capitalize transition-colors",
                    fulfilmentType === type
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-surface hover:border-primary/40",
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </fieldset>

          {fulfilmentType === "delivery" ? (
            <div className="mt-4">
              <Field
                label="Delivery address"
                error={fieldErrors.deliveryAddress}
                value={form.deliveryAddress}
                onChange={(v) => setForm((f) => ({ ...f, deliveryAddress: v }))}
                multiline
                autoComplete="street-address"
              />
            </div>
          ) : null}

          <div className="mt-4">
            <Field
              label="Notes for the kitchen (optional)"
              value={form.deliveryNotes}
              onChange={(v) => setForm((f) => ({ ...f, deliveryNotes: v }))}
              multiline
              placeholder="Less spicy, no onion…"
            />
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-medium">Payment</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ...(onlinePaymentAvailable
                    ? ([
                        {
                          id: "razorpay",
                          label: "Pay online (UPI, card, netbanking)",
                        },
                      ] as const)
                    : []),
                  { id: "cod", label: "Pay on pickup / delivery" },
                  { id: "upi_manual", label: "UPI transfer (we confirm)" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPaymentMethod(option.id)}
                  aria-pressed={paymentMethod === option.id}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                    paymentMethod === option.id
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-surface hover:border-primary/40",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              {paymentMethod === "razorpay"
                ? "Your slot is held while you pay. You'll be taken to the payment window next."
                : paymentMethod === "upi_manual"
                  ? "Transfer by UPI after ordering — we confirm it by hand, so allow a little time."
                  : "Pay in cash or by UPI when you collect or receive the order."}
            </p>
          </fieldset>
        </section>
      </div>

      {/* ------------------------------------------------------------------ */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-display text-lg font-bold">Summary</h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Items</dt>
              <dd className="font-medium tabular-nums">
                {orderable.reduce((sum, line) => sum + line.qty, 0)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="font-medium tabular-nums">
                {formatPaise(subtotal)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base">
              <dt className="font-semibold">Total</dt>
              <dd className="font-semibold tabular-nums">
                {formatPaise(subtotal)}
              </dd>
            </div>
          </dl>

          {selectedSlotId ? (
            <p className="mt-4 rounded-lg bg-surface-alt px-3 py-2 text-xs text-muted">
              {formatDayLabel(selectedDate)},{" "}
              {(() => {
                const slot = slotsForDay.find(
                  (s) => s.slotId === selectedSlotId,
                );
                return slot
                  ? `${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}`
                  : "";
              })()}
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-nonveg/40 bg-nonveg/10 px-3 py-2.5 text-sm text-nonveg"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-fg transition-colors enabled:hover:bg-primary-hover disabled:opacity-45"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Placing order…
              </>
            ) : (
              <>
                Place order
                <ArrowRight className="size-4" aria-hidden />
              </>
            )}
          </button>

          {!selectedSlotId && slotsConfigured ? (
            <p className="mt-2 text-center text-xs text-muted">
              Pick a time slot to continue.
            </p>
          ) : null}
        </div>
      </aside>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  multiline,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  multiline?: boolean;
  placeholder?: string;
  inputMode?: "numeric";
  autoComplete?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  const className = cn(
    "mt-1.5 w-full rounded-xl border bg-surface px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none",
    error ? "border-nonveg" : "border-border focus:border-primary",
  );

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={2}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={className}
          {...rest}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={className}
          {...rest}
        />
      )}
      {error ? <p className="mt-1 text-xs text-nonveg">{error}</p> : null}
    </div>
  );
}
