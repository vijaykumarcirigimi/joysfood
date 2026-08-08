"use client";

import { useActionState, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { saveMenuItem, type ActionState } from "@/app/admin/actions";
import {
  Checkbox,
  ErrorNote,
  Field,
  Select,
  TextArea,
} from "@/app/admin/ui";
import type { AdminCategory, AdminMenuItem } from "@/lib/admin-data";
import { downscaleImage, formatBytes } from "@/lib/image-resize";

export function ItemForm({
  categories,
  item,
}: {
  categories: AdminCategory[];
  item?: AdminMenuItem;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveMenuItem, {
    error: null,
  });
  const [pending, startTransition] = useTransition();
  const [shrunk, setShrunk] = useState<string | null>(null);

  const isEdit = Boolean(item);

  /**
   * Submitting by hand rather than with `action={action}` so the photo can be
   * downscaled first. Without this, a normal phone photo exceeds the Server
   * Action body limit and the request is rejected with a 413 before any of our
   * validation runs — which is what produced "Something went wrong" with no
   * useful message.
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("image");

    if (file instanceof File && file.size > 0) {
      const result = await downscaleImage(file);
      formData.set("image", result.file, result.file.name);
      setShrunk(
        result.skipped
          ? null
          : `Resized from ${formatBytes(result.originalBytes)} to ${formatBytes(result.file.size)} before upload.`,
      );
    }

    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}

      <ErrorNote error={state.error} />

      <Field
        label="Dish name"
        name="name"
        required
        maxLength={80}
        defaultValue={item?.name ?? ""}
      />

      <TextArea
        label="Description"
        name="description"
        maxLength={400}
        defaultValue={item?.description ?? ""}
        hint="One or two lines. This is what sells the dish."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Category"
          name="categoryId"
          required
          defaultValue={item?.category_id ?? ""}
        >
          <option value="" disabled>
            Choose…
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.is_active ? "" : " (hidden)"}
            </option>
          ))}
        </Select>

        <Field
          label="Price (₹)"
          name="price"
          required
          inputMode="decimal"
          placeholder="280"
          defaultValue={item ? (item.price_paise / 100).toString() : ""}
          hint="Stored as paise. Two decimals maximum."
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Prep notice (hours)"
          name="prepLeadHours"
          type="number"
          min={0}
          max={168}
          required
          defaultValue={item?.prep_lead_time_hours ?? 4}
          hint="Slots closer than this are blocked for carts containing this dish."
        />
        <Field
          label="Display order"
          name="displayOrder"
          type="number"
          min={0}
          max={999}
          required
          defaultValue={item?.display_order ?? 0}
          hint="Lower numbers appear first."
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Checkbox
          label="Vegetarian"
          name="isVeg"
          defaultChecked={item?.is_veg ?? true}
        />
        <Checkbox
          label="Available"
          name="isAvailable"
          hint="Uncheck for sold out today"
          defaultChecked={item?.is_available ?? true}
        />
        <Checkbox
          label="On the menu"
          name="isActive"
          hint="Uncheck to archive"
          defaultChecked={item?.is_active ?? true}
        />
      </div>

      <div>
        <label htmlFor="image" className="text-sm font-medium">
          Photo
        </label>
        {item?.image_url ? (
          <div className="mt-2 flex items-center gap-3">
            <Image
              src={item.image_url}
              alt=""
              width={72}
              height={72}
              className="size-18 rounded-xl border border-border object-cover"
            />
            <p className="text-xs text-muted">
              Current photo. Choosing a new file replaces it.
            </p>
          </div>
        ) : null}
        <input
          id="image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="mt-2 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary"
        />
        <p className="mt-1 text-xs text-muted">
          Any size — large photos are shrunk in your browser before upload.
          Leave empty to keep the existing photo.
        </p>
        {shrunk ? (
          <p className="mt-1 text-xs text-veg">{shrunk}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-5">
        {/* Not SubmitButton: useFormStatus reports nothing once the form
            submits through onSubmit rather than action. */}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition-colors enabled:hover:bg-primary-hover disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          {isEdit ? "Save changes" : "Add dish"}
        </button>
        <Link
          href="/admin/menu"
          className="text-sm font-medium text-muted hover:text-primary"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
