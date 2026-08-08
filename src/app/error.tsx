"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

/**
 * Catches render and data-fetch errors in any page below the root layout.
 *
 * Deliberately does not render SiteHeader: if the header itself is what threw,
 * rendering it again throws again and the boundary loops. A brand mark and a
 * way out is all this needs to do.
 *
 * The message shown is fixed. Real error text can carry connection strings and
 * internal ids, so the customer gets the digest — an id they can quote to us —
 * and the detail goes to the server log where it belongs.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-[1140px] px-4 py-3">
          <Link href="/" aria-label="Joy's Food home">
            <BrandMark />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <AlertTriangle className="size-12 text-accent" aria-hidden />

        <h1 className="mt-5 font-display text-3xl font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-3 text-muted">
          That&rsquo;s on us, not you. Trying again usually works — the kitchen
          is fine.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-hover"
          >
            <RotateCcw className="size-4" aria-hidden />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold transition-colors hover:border-border-strong"
          >
            Back to the menu
          </Link>
        </div>

        <p className="mt-8 text-sm text-muted">
          If your order is time-sensitive, please{" "}
          <Link href="/contact" className="font-medium text-primary hover:underline">
            call us
          </Link>{" "}
          rather than waiting on the site.
        </p>

        {error.digest ? (
          <p className="mt-6 font-mono text-xs text-muted">
            Reference: {error.digest}
          </p>
        ) : null}
      </main>
    </div>
  );
}
