"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveCategory, type ActionState } from "@/app/admin/actions";
import { Checkbox, ErrorNote, Field, SubmitButton } from "@/app/admin/ui";
import type { AdminCategory } from "@/lib/admin-data";

export function CategoryForm({
  category,
  onDone,
}: {
  category?: AdminCategory;
  onDone?: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveCategory, {
    error: null,
  });
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the create form after a successful add so the next one starts blank.
  useEffect(() => {
    if (state.ok && !category) {
      formRef.current?.reset();
      onDone?.();
    }
  }, [state.ok, category, onDone]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}

      <ErrorNote error={state.error} />

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field
          label="Name"
          name="name"
          required
          maxLength={60}
          defaultValue={category?.name ?? ""}
          hint={
            category
              ? `URL: /menu/${category.slug} — renaming changes this`
              : "The URL slug is generated from this"
          }
        />
        <Field
          label="Display order"
          name="displayOrder"
          type="number"
          min={0}
          max={999}
          required
          defaultValue={category?.display_order ?? 0}
        />
      </div>

      <Field
        label="Description"
        name="description"
        maxLength={200}
        defaultValue={category?.description ?? ""}
        hint="Shown under the heading on the menu."
      />

      <Checkbox
        label="Visible on the menu"
        name="isActive"
        defaultChecked={category?.is_active ?? true}
      />

      <SubmitButton>{category ? "Save" : "Add category"}</SubmitButton>
    </form>
  );
}
