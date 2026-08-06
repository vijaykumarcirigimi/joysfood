import { CategoryForm } from "./category-form";
import { getAdminCategories, getAdminMenuItems } from "@/lib/admin-data";

export const metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  const [categories, items] = await Promise.all([
    getAdminCategories(),
    getAdminMenuItems(),
  ]);

  const countByCategory = new Map<string, number>();
  for (const item of items) {
    if (!item.is_active) continue;
    countByCategory.set(
      item.category_id,
      (countByCategory.get(item.category_id) ?? 0) + 1,
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div>
        <h1 className="mb-6 font-display text-2xl font-bold tracking-tight">
          Categories
        </h1>

        {categories.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
            No categories yet — add one on the right.
          </p>
        ) : (
          <ul className="space-y-4">
            {categories.map((category) => (
              <li
                key={category.id}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="font-semibold">
                    {category.name}
                    <span className="ml-2 text-sm font-normal text-muted">
                      {countByCategory.get(category.id) ?? 0} dishes
                    </span>
                  </p>
                  {!category.is_active ? (
                    <span className="rounded-full bg-surface-alt px-2.5 py-1 text-xs text-muted">
                      hidden
                    </span>
                  ) : null}
                </div>
                <CategoryForm category={category} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-4 font-semibold">New category</h2>
          <CategoryForm />
        </div>
        <p className="mt-3 text-xs text-muted">
          Categories are hidden rather than deleted — dishes and past orders
          still point at them.
        </p>
      </aside>
    </div>
  );
}
