import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeIndianRupee,
  CalendarDays,
  Clock,
  MapPin,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BUSINESS, CANCELLATION_CUTOFF_HOURS } from "@/lib/business";
import { formatTime } from "@/lib/dates";
import { BOOKING_WINDOW_DAYS, getOrderingRules } from "@/lib/slots";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Joy's Food cooks to order for a time slot you choose, up to two weeks ahead. Here's how pre-ordering works, why slots close early, and how to collect or get it delivered.",
};

// Reads slot rules from the database; an hour is fresh enough for content.
export const revalidate = 3600;

const STEPS = [
  {
    icon: UtensilsCrossed,
    title: "Pick your dishes",
    body: "Browse the menu and add what you want. Prices include tax, and anything sold out for the day is marked.",
  },
  {
    icon: CalendarDays,
    title: "Choose a day and a time slot",
    body: `Any day in the next ${BOOKING_WINDOW_DAYS}. Each slot takes a limited number of orders, and the picker greys out anything full or closed — so what you can click is what we can genuinely cook.`,
  },
  {
    icon: BadgeIndianRupee,
    title: "Tell us how to reach you, and pay",
    body: "Name and mobile number. Add an email and we'll send a confirmation. Pay online, or on collection.",
  },
  {
    icon: ShoppingBag,
    title: "We cook it for your slot",
    body: "Nothing is made in advance and reheated. Your food is cooked to be ready at the time you chose, and you collect it or we bring it.",
  },
] as const;

export default async function HowItWorksPage() {
  const rules = await getOrderingRules();

  const cutoff = rules.cutoffHours;
  const lead = rules.maxLeadHours;
  const leadDishes = rules.longestLeadDishes;

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          How pre-ordering works
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          {BUSINESS.brandName} is a home kitchen, not a restaurant with food
          sitting under a lamp. You tell us what you want and when you want it,
          and we cook it for that moment. That means ordering works a little
          differently from the apps you&rsquo;re used to — this page explains
          how, in about a minute.
        </p>

        {/* ---------------------------------------------------------------- */}
        <ol className="mt-10 space-y-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-2xl border border-border bg-surface p-5"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft">
                <step.icon className="size-5 text-primary" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="font-semibold">
                  <span className="text-primary">{index + 1}.</span> {step.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {/* ---------------------------------------------------------------- */}
        <h2 className="mt-14 font-display text-2xl font-bold tracking-tight">
          The two things that surprise people
        </h2>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-accent/40 bg-accent/10 p-5">
            <p className="flex items-center gap-2 font-semibold">
              <Clock className="size-4 shrink-0 text-primary" aria-hidden />
              You usually can&rsquo;t order for today
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {cutoff
                ? `Ordering for a slot closes ${cutoff} hours before it starts.`
                : "Ordering for each slot closes a set number of hours before it starts."}{" "}
              That isn&rsquo;t us being awkward — it&rsquo;s when we go and buy
              the ingredients for that slot. Order by this evening and tomorrow
              lunch is yours; try at 11am for a 12pm slot and it will be greyed
              out.
            </p>
          </div>

          <div className="rounded-2xl border border-accent/40 bg-accent/10 p-5">
            <p className="flex items-center gap-2 font-semibold">
              <Clock className="size-4 shrink-0 text-primary" aria-hidden />
              Some dishes need more notice than others
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {lead > 0 ? (
                <>
                  A few dishes are slow by nature — marinating, slow-cooking,
                  layering. The longest on our menu needs{" "}
                  <strong>{lead} hours</strong>
                  {leadDishes.length > 0 ? (
                    <> ({leadDishes.join(", ")})</>
                  ) : null}
                  . Each dish shows its notice period on the menu, and adding
                  one to your cart automatically hides the slots it can&rsquo;t
                  make.
                </>
              ) : (
                <>
                  Each dish shows its notice period on the menu, and adding one
                  to your cart automatically hides any slot it cannot make.
                </>
              )}
            </p>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {rules.slots.length > 0 ? (
          <>
            <h2 className="mt-14 font-display text-2xl font-bold tracking-tight">
              Our slots
            </h2>
            <p className="mt-2 text-sm text-muted">
              Every day runs the same slots. The number of orders each one takes
              is fixed, which is why a slot can fill up.
            </p>
            {/* Capacity is deliberately not a column. "Orders taken: 20" reads
                as twenty already gone rather than a ceiling, and the exact
                number changes nothing for a customer — the picker either offers
                the slot or it doesn't. Dropping it also lets the table fit a
                390px screen without its own sideways scroll. */}
            <ul className="mt-5 divide-y divide-border text-sm">
              {rules.slots.map((slot) => (
                <li
                  key={slot.label}
                  className="flex items-baseline justify-between gap-4 py-3"
                >
                  <span className="font-medium">
                    {slot.label.split("·")[0].trim()}
                  </span>
                  <span className="text-muted tabular-nums">
                    {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {/* ---------------------------------------------------------------- */}
        <h2 className="mt-14 font-display text-2xl font-bold tracking-tight">
          Collecting, or delivery
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="flex items-center gap-2 font-semibold">
              <ShoppingBag className="size-4 shrink-0 text-primary" aria-hidden />
              Pickup
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Come to the kitchen during your slot. Please arrive inside the
              window — food held for hours after it was cooked isn&rsquo;t the
              food we want to hand you.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="flex items-center gap-2 font-semibold">
              <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
              Delivery
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              We aim to arrive within your slot. Traffic and weather aren&rsquo;t
              ours to control, so treat it as a target rather than a promise —
              and keep your phone reachable.
            </p>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        <h2 className="mt-14 font-display text-2xl font-bold tracking-tight">
          Paying, and changing your mind
        </h2>
        <dl className="legal-prose mt-5">
          <dt>How can I pay?</dt>
          <dd>
            Online at checkout by card, netbanking or UPI; in cash or by UPI when
            you collect; or by UPI transfer in advance, which we confirm by hand.
            We never see your card number or UPI PIN.
          </dd>

          <dt>Can I cancel?</dt>
          <dd>
            Yes — free until {CANCELLATION_CUTOFF_HOURS} hours before your slot,
            using the <strong>Cancel this order</strong> button on your order
            page. If you paid online the refund starts automatically. After that
            point the shopping is done and cooking may have started, so please{" "}
            <Link href="/contact">talk to us</Link> instead. Full detail is in
            the <Link href="/refunds">refund policy</Link>.
          </dd>

          <dt>What if the slot I want is full?</dt>
          <dd>
            Pick another slot or another day — the picker only lets you choose
            slots we can really cook for. We&rsquo;d rather show you fewer
            options than take an order we can&rsquo;t honour.
          </dd>

          <dt>Do I need an account?</dt>
          <dd>
            No. You can order as a guest with just a name and mobile number.
            Signing in keeps your past orders in one place and fills the form in
            next time.
          </dd>

          <dt>I have a food allergy.</dt>
          <dd>
            Please <strong>call us before ordering</strong> rather than relying
            on the notes box. This is a home kitchen — nuts, dairy, gluten,
            sesame and mustard are all handled in the same space, and we
            can&rsquo;t promise any dish is free of traces. See our{" "}
            <Link href="/terms">terms</Link>.
          </dd>
        </dl>

        {/* ---------------------------------------------------------------- */}
        <div className="mt-14 rounded-2xl border border-border bg-surface-alt p-6 text-center">
          <p className="font-display text-xl font-bold">Ready to order?</p>
          <p className="mt-1 text-sm text-muted">
            Pick a day in the next {BOOKING_WINDOW_DAYS} and we&rsquo;ll cook it
            fresh.
          </p>
          <Link
            href="/#menu"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-hover"
          >
            See the menu
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <p className="mt-4 text-xs text-muted">
            Questions? <Link href="/contact">Contact us</Link> — a real person
            reads everything.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
