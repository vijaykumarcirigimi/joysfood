import { ItemForm } from "@/app/admin/menu/item-form";
import { getAdminCategories } from "@/lib/admin-data";

export const metadata = { title: "Add dish" };

export default async function NewMenuItemPage() {
  const categories = await getAdminCategories();

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold tracking-tight">
        Add dish
      </h1>
      <ItemForm categories={categories} />
    </div>
  );
}
