import { Database } from "lucide-react";
import { CartBar } from "@/components/cart-bar";
import { CategoryRail } from "@/components/category-rail";
import { DishCard } from "@/components/dish-card";
import { Hero } from "@/components/hero";
import { PromoBanner } from "@/components/promo-banner";
import { SectionHeader } from "@/components/section-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getMenu } from "@/lib/menu";
import type { Menu } from "@/lib/types";

// Must be a literal — Next.js statically analyses this export and cannot
// resolve an imported constant. Phase 2 admin writes will revalidate on save.
export const revalidate = 60;

/** Dishes shown per category on the home page before "View all". */
const PREVIEW_COUNT = 3;

const SEED_BANNER: Record<NonNullable<Menu["seedReason"]>, React.ReactNode> = {
  "not-configured": (
    <>
      Showing the built-in sample menu — add your Supabase keys to{" "}
      <code className="font-mono">.env.local</code> to go live.
    </>
  ),
  unavailable: (
    <>
      Showing the built-in sample menu — Supabase is configured but the query
      failed. Run{" "}
      <code className="font-mono">supabase/migrations/0001_menu.sql</code> in the
      SQL Editor.
    </>
  ),
  empty: (
    <>
      Showing the built-in sample menu — the database is connected but empty.
      Run <code className="font-mono">supabase/seed.sql</code> to populate it.
    </>
  ),
};

export default async function HomePage() {
  const { sections, seedReason } = await getMenu();

  return (
    <div className="min-h-dvh">
      {seedReason ? (
        <div className="flex items-center justify-center gap-2 bg-accent/15 px-4 py-2 text-center text-xs text-muted">
          <Database className="size-3.5 shrink-0" aria-hidden />
          <span>{SEED_BANNER[seedReason]}</span>
        </div>
      ) : null}

      <SiteHeader />
      <Hero />
      <CategoryRail
        sections={sections.map(({ slug, name }) => ({ slug, name }))}
      />

      <main id="menu" className="mx-auto max-w-[1140px] px-4 pt-10 pb-28">
        {sections.map((section, index) => (
          <div key={section.id}>
            <section
              id={`cat-${section.slug}`}
              aria-labelledby={`cat-${section.slug}-heading`}
            >
              <SectionHeader
                title={section.name}
                description={section.description}
                viewAllHref={
                  section.items.length > PREVIEW_COUNT
                    ? `/menu/${section.slug}`
                    : undefined
                }
              />

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.slice(0, PREVIEW_COUNT).map((item) => (
                  <DishCard
                    key={item.id}
                    item={item}
                    categorySlug={section.slug}
                  />
                ))}
              </div>
            </section>

            {/* Reference places the pre-order strip after the first block. */}
            {index === 0 ? <PromoBanner /> : <div className="h-12" />}
          </div>
        ))}
      </main>

      <SiteFooter />
      <CartBar />
    </div>
  );
}
