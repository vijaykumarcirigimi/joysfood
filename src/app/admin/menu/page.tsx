import Image from "next/image";
import Link from "next/link";
import { ImageOff, Plus } from "lucide-react";
import {
  archiveMenuItem,
  toggleItemAvailability,
} from "@/app/admin/actions";
import { VegBadge } from "@/components/veg-badge";
import { getAdminCategories, getAdminMenuItems } from "@/lib/admin-data";
import { cn, formatPaise } from "@/lib/utils";

export const metadata = { title: "Menu" };

export default async function AdminMenuPage() {
  const [categories, items] = await Promise.all([
    getAdminCategories(),
    getAdminMenuItems(),
  ]);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const grouped = categories.map((category) => ({
    category,
    items: items.filter((item) => item.category_id === category.id),
  }));
  const orphans = items.filter((item) => !categoryById.has(item.category_id));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Menu
          </h1>
          <p className="text-sm text-muted">
            {items.filter((i) => i.is_active).length} live ·{" "}
            {items.filter((i) => !i.is_active).length} archived
          </p>
        </div>
        <Link
          href="/admin/menu/new"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
        >
          <Plus className="size-4" aria-hidden />
          Add dish
        </Link>
      </div>

      {categories.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
          No categories yet.{" "}
          <Link href="/admin/categories" className="text-primary underline">
            Create one first
          </Link>
          .
        </p>
      ) : null}

      <div className="space-y-8">
        {grouped.map(({ category, items: rows }) => (
          <section key={category.id}>
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              {category.name}
              {!category.is_active ? (
                <span className="rounded-full bg-surface-alt px-2 py-0.5 text-xs font-normal text-muted">
                  hidden
                </span>
              ) : null}
              <span className="text-sm font-normal text-muted">
                · {rows.length}
              </span>
            </h2>

            {rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">
                No dishes in this category.
              </p>
            ) : (
              <ul className="space-y-2">
                {rows.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      "flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-3",
                      !item.is_active && "opacity-55",
                    )}
                  >
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt=""
                        width={48}
                        height={48}
                        className="size-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-surface-alt text-muted">
                        <ImageOff className="size-4" aria-hidden />
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-medium">
                        <VegBadge isVeg={item.is_veg} />
                        <span className="truncate">{item.name}</span>
                        {!item.is_active ? (
                          <span className="rounded-full bg-surface-alt px-2 py-0.5 text-xs text-muted">
                            archived
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm text-muted">
                        {formatPaise(item.price_paise)} ·{" "}
                        {item.prep_lead_time_hours}h notice
                      </p>
                    </div>

                    <form action={toggleItemAvailability}>
                      <input type="hidden" name="id" value={item.id} />
                      <input
                        type="hidden"
                        name="value"
                        value={item.is_available ? "off" : "on"}
                      />
                      <button
                        type="submit"
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                          item.is_available
                            ? "border-veg/40 text-veg hover:bg-veg/10"
                            : "border-border text-muted hover:border-veg/40 hover:text-veg",
                        )}
                      >
                        {item.is_available ? "Available" : "Sold out"}
                      </button>
                    </form>

                    <form action={archiveMenuItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <input
                        type="hidden"
                        name="value"
                        value={item.is_active ? "off" : "on"}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-nonveg/40 hover:text-nonveg"
                      >
                        {item.is_active ? "Archive" : "Restore"}
                      </button>
                    </form>

                    <Link
                      href={`/admin/menu/${item.id}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary/40 hover:text-primary"
                    >
                      Edit
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {orphans.length > 0 ? (
          <section>
            <h2 className="mb-3 font-semibold text-nonveg">
              Dishes in a deleted category
            </h2>
            <ul className="space-y-2">
              {orphans.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-nonveg/40 bg-surface p-3"
                >
                  <span>{item.name}</span>
                  <Link
                    href={`/admin/menu/${item.id}`}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                  >
                    Reassign
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
