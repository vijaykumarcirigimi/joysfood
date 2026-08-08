"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isKitchenAuthed } from "@/lib/kitchen-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ActionState = { error: string | null; ok?: boolean };

async function requireStaff() {
  if (!(await isKitchenAuthed())) throw new Error("Not authorised.");
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return supabase;
}

const RecipientSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Enter a name").max(60),
  // Lowercased because the table has a check constraint requiring it — two
  // casings of one address would mean two copies of every alert.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address")),
  onNewOrder: z.boolean(),
  onCancellation: z.boolean(),
  onRefundOwed: z.boolean(),
  isActive: z.boolean(),
});

export async function saveRecipient(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await requireStaff();

  const parsed = RecipientSchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    onNewOrder: formData.get("onNewOrder") === "on",
    onCancellation: formData.get("onCancellation") === "on",
    onRefundOwed: formData.get("onRefundOwed") === "on",
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const value = parsed.data;
  const row = {
    name: value.name,
    email: value.email,
    on_new_order: value.onNewOrder,
    on_cancellation: value.onCancellation,
    on_refund_owed: value.onRefundOwed,
    is_active: value.isActive,
  };

  const { error } = value.id
    ? await supabase.from("notification_recipients").update(row).eq("id", value.id)
    : await supabase.from("notification_recipients").insert(row);

  if (error) {
    console.error("[notifications] save failed:", error);
    return {
      error:
        error.code === "23505"
          ? "That email address is already on the list."
          : error.message,
    };
  }

  revalidatePath("/admin/notifications");
  return { error: null, ok: true };
}

export async function deleteRecipient(formData: FormData): Promise<void> {
  const supabase = await requireStaff();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) throw new Error("Invalid recipient.");

  // Refusing to delete the last active new-order recipient: an empty list means
  // an order can arrive with nobody told, which is the one outcome this whole
  // feature exists to prevent. Deactivating is still allowed — that is a choice
  // someone makes deliberately, not a list they empty by tidying.
  const { data: remaining } = await supabase
    .from("notification_recipients")
    .select("id")
    .eq("is_active", true)
    .eq("on_new_order", true)
    .neq("id", id.data);

  if ((remaining ?? []).length === 0) {
    throw new Error(
      "That is the only address getting new-order alerts. Add another before removing this one.",
    );
  }

  const { error } = await supabase
    .from("notification_recipients")
    .delete()
    .eq("id", id.data);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/notifications");
}

/** Removes a registered device — the browser stops receiving push. */
export async function removePushDevice(formData: FormData): Promise<void> {
  const supabase = await requireStaff();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) throw new Error("Invalid device.");

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("id", id.data);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/notifications");
}
