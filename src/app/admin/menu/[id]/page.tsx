import { notFound } from "next/navigation";
import { clearMenuItemPhoto } from "@/app/admin/actions";
import { ItemForm } from "@/app/admin/menu/item-form";
import { getAdminCategories, getAdminMenuItem } from "@/lib/admin-data";

export const metadata = { title: "Edit dish" };

export default async function EditMenuItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [categories, item] = await Promise.all([
    getAdminCategories(),
    getAdminMenuItem(id),
  ]);

  if (!item) notFound();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {item.name}
        </h1>
        {item.image_url ? (
          <form action={clearMenuItemPhoto}>
            <input type="hidden" name="id" value={item.id} />
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-nonveg/40 hover:text-nonveg"
            >
              Remove photo
            </button>
          </form>
        ) : null}
      </div>
      <ItemForm categories={categories} item={item} />
    </div>
  );
}
