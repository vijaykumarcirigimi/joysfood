import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, SearchX } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Page not found" };

/**
 * Reached by any unmatched URL and by every notFound() call — a mistyped
 * category, a menu item that has been removed, and most importantly an order
 * token that does not resolve. That last one is why this page talks about
 * orders rather than just saying 404: someone who has paid and followed a
 * broken link needs a way to reach us, not a dead end.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <SearchX className="size-12 text-muted" aria-hidden />

        <h1 className="mt-5 font-display text-3xl font-bold tracking-tight">
          We couldn&rsquo;t find that page
        </h1>
        <p className="mt-3 text-muted">
          The link may be out of date, or a dish may have come off the menu.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/#menu"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-hover"
          >
            Browse the menu
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold transition-colors hover:border-border-strong"
          >
            Your orders
          </Link>
        </div>

        <p className="mt-8 text-sm text-muted">
          Looking for an order you placed? The link from your confirmation page
          is the one that works.{" "}
          <Link href="/contact" className="font-medium text-primary hover:underline">
            Contact us
          </Link>{" "}
          with your order number and we&rsquo;ll find it.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
