"use client";

import Link from "next/link";
import { BadgePercent, ChevronDown, MapPin, Search, ShoppingBag } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { BrandMark } from "@/components/brand-mark";
import { useCart } from "@/lib/cart";

export function SiteHeader() {
  const { totalQty, ready } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1140px] items-center gap-3 px-4 py-3 sm:gap-4">
        <Link href="/" aria-label="Joy's Food home" className="shrink-0">
          <BrandMark />
        </Link>

        {/* Location picker — wired to a real address book once there is one. */}
        <button
          type="button"
          className="hidden shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text transition-colors hover:border-border-strong lg:flex"
        >
          <MapPin className="size-4 text-primary" aria-hidden />
          Bangalore, KA
          <ChevronDown className="size-4 text-muted" aria-hidden />
        </button>

        <div className="relative min-w-0 flex-1">
          <label htmlFor="dish-search" className="sr-only">
            Search for dishes
          </label>
          <input
            id="dish-search"
            type="search"
            placeholder="Search for dishes, cuisines..."
            className="w-full rounded-full border border-border bg-surface py-2.5 pr-11 pl-5 text-sm text-text placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
          />
          <Search
            className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
        </div>

        <button
          type="button"
          className="hidden shrink-0 items-center gap-2 text-sm font-medium text-text transition-colors hover:text-primary md:flex"
        >
          <BadgePercent className="size-5 text-primary" aria-hidden />
          Offers
        </button>

        <Link
          href="/cart"
          className="relative flex shrink-0 items-center gap-2 text-sm font-medium text-text transition-colors hover:text-primary"
        >
          <span className="relative">
            <ShoppingBag className="size-5" aria-hidden />
            {ready && totalQty > 0 ? (
              <span className="absolute -top-2 -right-2 flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-fg">
                {totalQty}
              </span>
            ) : null}
          </span>
          <span className="hidden sm:inline">Cart</span>
        </Link>

        <AccountMenu />
      </div>
    </header>
  );
}
