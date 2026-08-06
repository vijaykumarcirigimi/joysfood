"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Clock, Minus, Plus } from "lucide-react";
import { VegBadge } from "@/components/veg-badge";
import { categoryEmoji } from "@/lib/category-meta";
import { useCart } from "@/lib/cart";
import type { MenuItem } from "@/lib/types";
import { cn, formatPaise } from "@/lib/utils";

/** Stable warm hue per dish, so a placeholder keeps its colour across renders. */
function hueFromName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return 10 + (hash % 70);
}

function leadTimeLabel(hours: number): string | null {
  if (hours >= 24) return `${Math.round(hours / 24)} day notice`;
  if (hours >= 12) return `${hours}h notice`;
  return null;
}

export function DishCard({
  item,
  categorySlug,
}: {
  item: MenuItem;
  categorySlug: string;
}) {
  const { add, qtyOf, ready } = useCart();
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const soldOut = !item.is_available;
  const leadTime = leadTimeLabel(item.prep_lead_time_hours);
  const inCart = ready ? qtyOf(item.id) : 0;
  const hue = hueFromName(item.name);

  const handleAdd = () => {
    for (let i = 0; i < qty; i += 1) {
      add({ id: item.id, name: item.name, pricePaise: item.price_paise });
    }
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1400);
  };

  return (
    <article
      className={cn(
        "flex overflow-hidden rounded-2xl border border-border bg-surface shadow-soft transition-shadow",
        soldOut ? "opacity-70" : "hover:shadow-card",
      )}
    >
      <div className="relative w-[38%] shrink-0 self-stretch sm:w-36">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            sizes="(min-width: 640px) 144px, 38vw"
            className={cn("object-cover", soldOut && "grayscale")}
          />
        ) : (
          <div
            aria-hidden
            className={cn(
              "flex size-full min-h-36 items-center justify-center",
              soldOut && "grayscale",
            )}
            style={{
              background: `linear-gradient(150deg, hsl(${hue} 72% 90%), hsl(${hue + 20} 62% 78%))`,
            }}
          >
            <span className="text-5xl">{categoryEmoji(categorySlug)}</span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex items-start gap-2">
          <VegBadge isVeg={item.is_veg} className="mt-1" />
          <h3 className="leading-snug font-semibold text-text">{item.name}</h3>
        </div>

        {item.description ? (
          <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-muted">
            {item.description}
          </p>
        ) : null}

        {leadTime && !soldOut ? (
          <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-surface-alt px-2 py-0.5 text-[11px] font-medium text-muted">
            <Clock className="size-3" aria-hidden />
            {leadTime}
          </span>
        ) : null}

        <div className="mt-auto pt-3">
          <p className="font-semibold tabular-nums text-text">
            {formatPaise(item.price_paise)}
          </p>

          {soldOut ? (
            <p className="mt-2.5 inline-flex rounded-lg bg-surface-alt px-3 py-2 text-xs font-medium text-muted">
              Sold out today
            </p>
          ) : (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setQty((n) => Math.max(1, n - 1))}
                  disabled={qty <= 1}
                  aria-label={`Decrease quantity of ${item.name}`}
                  className="flex size-8 items-center justify-center rounded-l-lg text-muted transition-colors enabled:hover:text-primary disabled:opacity-35"
                >
                  <Minus className="size-3.5" aria-hidden />
                </button>
                <span
                  aria-live="polite"
                  className="w-7 text-center text-sm font-semibold tabular-nums"
                >
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty((n) => Math.min(20, n + 1))}
                  aria-label={`Increase quantity of ${item.name}`}
                  className="flex size-8 items-center justify-center rounded-r-lg text-muted transition-colors hover:text-primary"
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAdd}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-hover"
              >
                {justAdded ? (
                  <>
                    Added
                    <Check className="size-3.5" aria-hidden />
                  </>
                ) : (
                  <>
                    Add
                    <Plus className="size-3.5" aria-hidden />
                  </>
                )}
              </button>

              {inCart > 0 ? (
                <span className="text-xs font-medium text-muted">
                  {inCart} in cart
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
