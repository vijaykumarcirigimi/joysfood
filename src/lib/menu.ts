import { resolveDishPhoto } from "./dish-photos";
import { seedCategories, seedMenuItems } from "./seed-menu";
import { createSupabasePublicClient } from "./supabase/public";
import type {
  Category,
  Menu,
  MenuItem,
  MenuSection,
  SeedReason,
} from "./types";

function buildSections(
  categories: Category[],
  items: MenuItem[],
): MenuSection[] {
  const byCategory = new Map<string, MenuItem[]>();
  for (const item of items) {
    const bucket = byCategory.get(item.category_id);
    if (bucket) bucket.push(item);
    else byCategory.set(item.category_id, [item]);
  }

  return categories
    .filter((category) => category.is_active)
    .sort((a, b) => a.display_order - b.display_order)
    .map((category) => ({
      ...category,
      items: (byCategory.get(category.id) ?? [])
        .sort((a, b) => a.display_order - b.display_order)
        // A photo set in the database always wins; otherwise look for a local
        // file in public/dishes/.
        .map((item) => ({
          ...item,
          image_url: item.image_url ?? resolveDishPhoto(item.name),
        })),
    }))
    // An empty category is a rendering dead end — drop it.
    .filter((section) => section.items.length > 0);
}

function seedMenu(seedReason: SeedReason): Menu {
  return {
    sections: buildSections(seedCategories, seedMenuItems),
    source: "seed",
    seedReason,
  };
}

/**
 * Load the full menu. Falls back to the local seed data when Supabase is not
 * configured or unreachable, so the storefront never renders empty.
 */
export async function getMenu(): Promise<Menu> {
  const supabase = createSupabasePublicClient();
  if (!supabase) return seedMenu("not-configured");

  try {
    const [categoriesResult, itemsResult] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, slug, description, display_order, is_active")
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("menu_items")
        .select(
          "id, category_id, name, description, price_paise, image_url, is_veg, is_available, prep_lead_time_hours, display_order",
        )
        .eq("is_active", true)
        .order("display_order"),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (itemsResult.error) throw itemsResult.error;

    const sections = buildSections(
      categoriesResult.data as Category[],
      itemsResult.data as MenuItem[],
    );

    // A reachable-but-empty database on first boot should still show something.
    if (sections.length === 0) return seedMenu("empty");

    return { sections, source: "supabase", seedReason: null };
  } catch (error) {
    console.error("[menu] Supabase read failed, serving seed menu:", error);
    return seedMenu("unavailable");
  }
}

/** One category with all of its items, for the /menu/[slug] page. */
export async function getMenuSection(slug: string) {
  const { sections } = await getMenu();
  return sections.find((section) => section.slug === slug) ?? null;
}

/** Slugs for generateStaticParams on the category pages. */
export async function getCategorySlugs() {
  const { sections } = await getMenu();
  return sections.map((section) => section.slug);
}
