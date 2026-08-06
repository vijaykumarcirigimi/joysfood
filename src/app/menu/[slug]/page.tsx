import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CartBar } from "@/components/cart-bar";
import { DishCard } from "@/components/dish-card";
import { SectionHeader } from "@/components/section-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCategorySlugs, getMenuSection } from "@/lib/menu";

export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getCategorySlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const section = await getMenuSection(slug);
  return { title: section?.name ?? "Menu" };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const section = await getMenuSection(slug);
  if (!section) notFound();

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-[1140px] px-4 pt-8 pb-28">
        <Link
          href="/#menu"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All categories
        </Link>

        <SectionHeader title={section.name} description={section.description} />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.map((item) => (
            <DishCard key={item.id} item={item} categorySlug={section.slug} />
          ))}
        </div>
      </main>

      <SiteFooter />
      <CartBar />
    </div>
  );
}
