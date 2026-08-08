import { cn } from "@/lib/utils";

/**
 * Placeholder block for loading states.
 *
 * Skeletons should trace the shape of what is coming — a card-sized skeleton
 * where a card will land, not a generic spinner — so the layout does not jump
 * when real content replaces it.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-lg bg-surface-alt", className)}
    />
  );
}

/**
 * Wraps a skeleton screen so assistive tech announces the wait instead of
 * reading out a tree of empty boxes.
 */
export function LoadingRegion({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
