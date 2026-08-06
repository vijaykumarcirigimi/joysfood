import { ArrowRight } from "lucide-react";

export function PromoBanner() {
  return (
    <section
      id="how-it-works"
      className="my-12 overflow-hidden rounded-2xl bg-surface-warm"
    >
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
            Pre-order your favourite meals up to 14 days in advance.
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
