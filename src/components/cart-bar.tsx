"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown, MapPin, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatPaise } from "@/lib/utils";

/**
 * Sticky summary bar. Hidden until the cart has something in it, and until
 * localStorage has been read — otherwise it would flash in on every load.
 */
export function CartBar() {
  const { totalQty, totalPaise, ready } = useCart();

  if (!ready || totalQty === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:pb-6">
      <div className="pointer-events-auto mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-border bg-surface px-5 py-4 shadow-float">
        <ShoppingBag className="size-5 shrink-0 text-text" aria-hidden />

        <p className="text-sm font-semibold text-text">
          {totalQty} {totalQty === 1 ? "item" : "items"}
        </p>
        <p className="text-sm font-semibold tabular-nums text-text">
          {formatPaise(totalPaise)}
        </p>

        <Link
          href="/cart"
          className="text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          View Cart
        </Link>

        <span
          aria-hidden
          className="hidden h-8 w-px shrink-0 bg-border sm:block"
        />

        <button
          type="button"
          className="hidden items-center gap-2 text-left md:flex"
        >
          <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="block text-[11px] leading-tight text-muted">
              Delivering to
            </span>
            <span className="flex items-center gap-1 text-sm leading-tight font-medium text-text">
              Koramangala, Bangalore
              <ChevronDown className="size-3.5 text-muted" aria-hidden />
            </span>
          </span>
        </button>

        <Link
          href="/cart"
          className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-hover"
        >
          Checkout
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
