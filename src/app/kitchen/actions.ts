"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cancelOrder } from "@/app/actions/cancel-order";
import { isKitchenAuthed, signInKitchen, signOutKitchen } from "@/lib/kitchen-auth";
import { KITCHEN_STATUSES } from "@/lib/kitchen";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function kitchenLogin(
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const password = String(formData.get("password") ?? "");
  const ok = await signInKitchen(password);
  if (!ok) return { error: "Incorrect password." };

  // Only ever redirect to our own paths — an open redirect here would let a
  // crafted link bounce staff to an attacker's login lookalike.
  const next = String(formData.get("next") ?? "/kitchen");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/kitchen");
}

export async function kitchenLogout() {
  await signOutKitchen();
  redirect("/kitchen");
}

const StatusSchema = z.object({
  orderId: z.uuid(),
  status: z.enum(KITCHEN_STATUSES),
});

export async function updateOrderStatus(
  formData: FormData,
): Promise<void> {
  // Re-check on every write. The page rendering is not authorisation.
  if (!(await isKitchenAuthed())) {
    throw new Error("Not authorised.");
  }

  const parsed = StatusSchema.safeParse({
    orderId: formData.get("orderId"),
    status: formData.get("status"),
  });
  if (!parsed.success) throw new Error("Invalid status change.");

  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Service role key is not configured.");

  // Cancelling is not just a status change when the customer has paid: this
  // used to set status = 'cancelled' and quietly keep their money. Delegate to
  // cancelOrder(), which cancels and then refunds through the gateway.
  if (parsed.data.status === "cancelled") {
    const { data: order, error: lookupError } = await supabase
      .from("orders")
      .select("public_token")
      .eq("id", parsed.data.orderId)
      .maybeSingle();

    if (lookupError || !order?.public_token) {
      console.error("[kitchen] cancel lookup failed:", lookupError);
      throw new Error("Could not cancel that order.");
    }

    const outcome = await cancelOrder(order.public_token, "kitchen");
    if (!outcome.ok) throw new Error(outcome.error);

    // A refund the gateway did not complete must not look like success on a
    // screen the kitchen glances at during a shift.
    if (outcome.refundPending) {
      console.error(
        "[kitchen] REFUND OUTSTANDING on cancelled order:",
        outcome.orderNumber,
      );
    }

    revalidatePath("/kitchen");
    return;
  }

  const patch: Record<string, unknown> = { status: parsed.data.status };

  // Moving an order out of pending_payment means the seat is no longer a
  // timed hold — clear the expiry so the sweeper cannot cancel it later.
  if (parsed.data.status !== "pending_payment") {
    patch.reserved_until = null;
  }

  const { error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", parsed.data.orderId);

  if (error) {
    console.error("[kitchen] status update failed:", error);
    throw new Error("Could not update that order.");
  }

  revalidatePath("/kitchen");
}

export async function markPaid(formData: FormData): Promise<void> {
  if (!(await isKitchenAuthed())) throw new Error("Not authorised.");

  const orderId = z.uuid().safeParse(formData.get("orderId"));
  if (!orderId.success) throw new Error("Invalid order.");

  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Service role key is not configured.");

  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      status: "confirmed",
      reserved_until: null,
    })
    .eq("id", orderId.data)
    .eq("payment_status", "unpaid");

  if (error) {
    console.error("[kitchen] mark paid failed:", error);
    throw new Error("Could not mark that order paid.");
  }

  revalidatePath("/kitchen");
}
