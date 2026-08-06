import { cn } from "@/lib/utils";

/**
 * The standard Indian veg / non-veg marker: a squared outline with a filled
 * dot. Green for vegetarian, red for non-vegetarian.
 */
export function VegBadge({
  isVeg,
  className,
}: {
  isVeg: boolean;
  className?: string;
}) {
  const label = isVeg ? "Vegetarian" : "Non-vegetarian";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border-[1.5px]",
        isVeg ? "border-veg" : "border-nonveg",
        className,
      )}
    >
      <span
        className={cn(
          "block size-2 rounded-full",
          isVeg ? "bg-veg" : "bg-nonveg",
        )}
      />
    </span>
  );
}
