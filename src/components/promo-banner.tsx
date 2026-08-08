import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BOOKING_WINDOW_DAYS } from "@/lib/slots";

/**
 * Marketing block, mid-page. It used to carry id="how-it-works" and was the
 * target of the hero's "How It Works" button, which meant that button scrolled
 * people to a "Pre-order Now" advert instead of an explanation. The id is gone
 * and the explaining is done by /how-it-works, which this now links to as a
 * second entry point for anyone who scrolled past the hero.
 */
export function PromoBanner() {
  return (
    <section className="my-12 overflow-hidden rounded-2xl bg-surface-warm">
      <div className="flex flex-wrap items-center gap-6 px-6 py-6 sm:px-8">
        <span
          aria-hidden
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-surface/70 text-3xl"
        >
          🗓️
        </span>

        <div className="min-w-[15rem] flex-1">
          <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
            Plan ahead &amp; save time
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Pre-order your favourite meals up to {BOOKING_WINDOW_DAYS} days in
            advance.{" "}
            <Link
              href="/how-it-works"
              className="font-medium text-primary hover:underline"
            >
              How it works
            </Link>
          </p>
        </div>

        <a
          href="#menu"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg shadow-card transition-colors hover:bg-primary-hover"
        >
          Pre-order Now
          <ArrowRight className="size-4" aria-hidden />
        </a>

        <span aria-hidden className="hidden shrink-0 text-5xl lg:block">
          🍲
        </span>
      </div>
    </section>
  );
}
