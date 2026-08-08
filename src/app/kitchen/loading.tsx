import { LoadingRegion, Skeleton } from "@/components/skeleton";

/**
 * Mirrors the wide Shell in kitchen/page.tsx. The kitchen screen is refetched
 * constantly during a shift (force-dynamic, no cache), so this is the loading
 * state staff see most often in the app.
 */
export default function KitchenLoading() {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto max-w-[1140px] px-4 py-10">
        <Skeleton className="h-8 w-44" />

        <LoadingRegion label="Loading today's orders">
          {/* Date rail */}
          <div className="mt-6 flex gap-2 overflow-hidden">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-14 w-20 shrink-0 rounded-xl" />
            ))}
          </div>

          {/* Prep sheet */}
          <Skeleton className="mt-8 h-40 rounded-2xl" />

          {/* Slot groups */}
          <div className="mt-6 space-y-4">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        </LoadingRegion>
      </div>
    </div>
  );
}
