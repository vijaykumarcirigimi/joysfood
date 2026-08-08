"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isKitchenAuthed } from "@/lib/kitchen-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rupeesToPaise } from "@/lib/utils";

export type ActionState = { error: string | null; ok?: boolean };

const PHOTO_BUCKET = "dish-photos";
/**
 * Must stay below next.config.ts's serverActions.bodySizeLimit, or an oversized
 * photo is rejected as a 413 before this check can produce a readable message.
 * Photos are downscaled in the browser first, so reaching this is unusual.
 */
const MAX_PHOTO_BYTES = 3.5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * The owner and the kitchen share one password today — a home kitchen is one
 * or two people. When staff accounts arrive, price editing should split from
 * order status changes; this is the seam where that happens.
 */
async function requireStaff() {
  if (!(await isKitchenAuthed())) throw new Error("Not authorised.");
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return supabase;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Menu pages are cached; every write has to blow that away. */
function revalidateStorefront() {
  revalidatePath("/", "layout");
}

function fail(error: string): ActionState {
  return { error };
}

// ---------------------------------------------------------------- categories

const CategorySchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Name is too short").max(60),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  displayOrder: z.coerce.number().int().min(0).max(999),
  isActive: z.boolean(),
});

export async function saveCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireStaff();

  const parsed = CategorySchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    displayOrder: formData.get("displayOrder") ?? 0,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const value = parsed.data;
  const row = {
    name: value.name,
    slug: slugify(value.name),
    description: value.description || null,
    display_order: value.displayOrder,
    is_active: value.isActive,
  };

  const { error } = value.id
    ? await supabase.from("categories").update(row).eq("id", value.id)
    : await supabase.from("categories").insert(row);

  if (error) {
    console.error("[admin] saveCategory:", error);
    return fail(
      error.code === "23505"
        ? "A category with that name already exists."
        : error.message,
    );
  }

  revalidateStorefront();
  return { error: null, ok: true };
}

// ----------------------------------------------------------------- menu item

const MenuItemSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  categoryId: z.uuid("Pick a category"),
  name: z.string().trim().min(2, "Name is too short").max(80),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  price: z.string().trim().min(1, "Enter a price"),
  prepLeadHours: z.coerce.number().int().min(0).max(168),
  displayOrder: z.coerce.number().int().min(0).max(999),
  isVeg: z.boolean(),
  isAvailable: z.boolean(),
  isActive: z.boolean(),
});

export async function saveMenuItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireStaff();

  const parsed = MenuItemSchema.safeParse({
    id: formData.get("id") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    price: formData.get("price") ?? "",
    prepLeadHours: formData.get("prepLeadHours") ?? 0,
    displayOrder: formData.get("displayOrder") ?? 0,
    isVeg: formData.get("isVeg") === "on",
    isAvailable: formData.get("isAvailable") === "on",
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const value = parsed.data;
  const pricePaise = rupeesToPaise(value.price);
  if (pricePaise === null) {
    return fail("Price must be a number with at most two decimals, e.g. 280 or 280.50");
  }

  // Photo is optional on every save — leaving the field empty keeps the
  // existing image rather than clearing it.
  let imageUrl: string | undefined;
  const file = formData.get("image");

  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return fail("Photo must be a JPEG, PNG, WebP or AVIF.");
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return fail(
        "That photo is too large even after resizing. Please pick a smaller one.",
      );
    }

    const extension = file.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${slugify(value.name)}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error("[admin] photo upload:", uploadError);
      return fail(`Photo upload failed: ${uploadError.message}`);
    }

    imageUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)
      .data.publicUrl;
  }

  const row = {
    category_id: value.categoryId,
    name: value.name,
    description: value.description || null,
    price_paise: pricePaise,
    prep_lead_time_hours: value.prepLeadHours,
    display_order: value.displayOrder,
    is_veg: value.isVeg,
    is_available: value.isAvailable,
    is_active: value.isActive,
    ...(imageUrl ? { image_url: imageUrl } : {}),
  };

  const { error } = value.id
    ? await supabase.from("menu_items").update(row).eq("id", value.id)
    : await supabase.from("menu_items").insert(row);

  if (error) {
    console.error("[admin] saveMenuItem:", error);
    return fail(
      error.code === "23505"
        ? "That category already has a dish with this name."
        : error.message,
    );
  }

  revalidateStorefront();
  redirect("/admin/menu");
}

/** Clears the photo without touching anything else. */
export async function clearMenuItemPhoto(formData: FormData): Promise<void> {
  const supabase = await requireStaff();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) throw new Error("Invalid item.");

  const { error } = await supabase
    .from("menu_items")
    .update({ image_url: null })
    .eq("id", id.data);
  if (error) throw new Error(error.message);

  revalidateStorefront();
}

const ToggleSchema = z.object({ id: z.uuid(), value: z.enum(["on", "off"]) });

export async function toggleItemAvailability(
  formData: FormData,
): Promise<void> {
  const supabase = await requireStaff();
  const parsed = ToggleSchema.safeParse({
    id: formData.get("id"),
    value: formData.get("value"),
  });
  if (!parsed.success) throw new Error("Invalid toggle.");

  const { error } = await supabase
    .from("menu_items")
    .update({ is_available: parsed.data.value === "on" })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidateStorefront();
}

/**
 * Archive, never DELETE. Orders placed for a future date still reference this
 * row, and order_items keeps a name/price snapshot precisely so history stays
 * intact — but the foreign key is `on delete restrict`, so a hard delete would
 * fail anyway once the dish has ever been ordered. See plan.md §6.5.
 */
export async function archiveMenuItem(formData: FormData): Promise<void> {
  const supabase = await requireStaff();
  const parsed = ToggleSchema.safeParse({
    id: formData.get("id"),
    value: formData.get("value"),
  });
  if (!parsed.success) throw new Error("Invalid archive request.");

  const { error } = await supabase
    .from("menu_items")
    .update({ is_active: parsed.data.value === "on" })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidateStorefront();
}

// --------------------------------------------------------------------- slots

const SlotSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  label: z.string().trim().min(2, "Label is too short").max(60),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time must be HH:MM"),
  maxOrders: z.coerce.number().int().min(1, "Capacity must be at least 1").max(500),
  cutoffHours: z.coerce.number().int().min(0).max(168),
  displayOrder: z.coerce.number().int().min(0).max(999),
  isActive: z.boolean(),
});

export async function saveSlot(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireStaff();

  const parsed = SlotSchema.safeParse({
    id: formData.get("id") ?? "",
    label: formData.get("label") ?? "",
    startTime: formData.get("startTime") ?? "",
    endTime: formData.get("endTime") ?? "",
    maxOrders: formData.get("maxOrders") ?? 1,
    cutoffHours: formData.get("cutoffHours") ?? 0,
    displayOrder: formData.get("displayOrder") ?? 0,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const value = parsed.data;
  if (value.endTime <= value.startTime) {
    return fail("End time must be after start time.");
  }

  const row = {
    label: value.label,
    start_time: `${value.startTime}:00`,
    end_time: `${value.endTime}:00`,
    max_orders: value.maxOrders,
    cutoff_hours_before: value.cutoffHours,
    display_order: value.displayOrder,
    is_active: value.isActive,
  };

  const { error } = value.id
    ? await supabase.from("time_slots").update(row).eq("id", value.id)
    : await supabase.from("time_slots").insert(row);

  if (error) {
    console.error("[admin] saveSlot:", error);
    return fail(error.message);
  }

  revalidateStorefront();
  return { error: null, ok: true };
}

// ----------------------------------------------------------- slot overrides

const OverrideSchema = z.object({
  slotId: z.uuid("Pick a slot"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  mode: z.enum(["close", "capacity"]),
  capacity: z.coerce.number().int().min(0).max(500).optional(),
  note: z.string().trim().max(120).optional().or(z.literal("")),
});

export async function saveSlotOverride(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireStaff();

  const parsed = OverrideSchema.safeParse({
    slotId: formData.get("slotId") ?? "",
    date: formData.get("date") ?? "",
    mode: formData.get("mode") ?? "close",
    capacity: formData.get("capacity") || undefined,
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const value = parsed.data;
  const isClose = value.mode === "close";

  if (!isClose && value.capacity === undefined) {
    return fail("Enter a capacity for that day.");
  }

  const { error } = await supabase.from("slot_overrides").upsert(
    {
      slot_id: value.slotId,
      date: value.date,
      is_closed: isClose,
      max_orders_override: isClose ? null : value.capacity,
      note: value.note || null,
    },
    { onConflict: "slot_id,date" },
  );

  if (error) {
    console.error("[admin] saveSlotOverride:", error);
    return fail(error.message);
  }

  revalidateStorefront();
  return { error: null, ok: true };
}

export async function deleteSlotOverride(formData: FormData): Promise<void> {
  const supabase = await requireStaff();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) throw new Error("Invalid override.");

  const { error } = await supabase
    .from("slot_overrides")
    .delete()
    .eq("id", id.data);
  if (error) throw new Error(error.message);

  revalidateStorefront();
}
