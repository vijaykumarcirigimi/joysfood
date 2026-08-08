import { LoadingRegion, Skeleton } from "@/components/skeleton";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/**
 * Only /cart and /kitchen have a loading.tsx, and that is deliberate.
 *
 * A loading boundary makes the route stream, which commits the HTTP status
 * before the page body runs. Any page that calls redirect() or notFound()
 * therefore loses its real status code — /orders returned 200 instead of 307,
 * and a bad order token returned 200 instead of 404, with the redirect or the
 * 404 UI arriving only after the skeleton had already streamed.
 *
 * So: skeletons on pages that always render, never on pages that may divert.
 * /cart and /kitchen qualify; /orders, /signin and /order/[token] do not.
 */
export default function CartLoading() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-[1140px] px-4 py-10">
        <Skeleton className="mb-8 h-9 w-40" />

        <LoadingRegion label="Loading checkout">
          <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
            <div className="space-y-8">
              <section>
                <Skeleton className="h-6 w-32" />
                <div className="mt-4 space-y-3">
                  {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-[4.5rem] w-full rounded-xl" />
                  ))}
                </div>
              </section>

              <section>
                <Skeleton className="h-6 w-56" />
                {/* Date rail */}
                <div className="mt-4 flex gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-[4.5rem] w-16 rounded-xl" />
                  ))}
                </div>
                {/* Slot grid */}
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-[4.25rem] rounded-xl" />
                  ))}
                </div>
              </section>

              <section>
                <Skeleton className="h-6 w-36" />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Skeleton className="h-[4.25rem] rounded-xl" />
                  <Skeleton className="h-[4.25rem] rounded-xl" />
                </div>
              </section>
            </div>

            <aside>
              <Skeleton className="h-72 rounded-2xl" />
            </aside>
          </div>
        </LoadingRegion>
      </main>

      <SiteFooter />
    </div>
  );
}
