import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin";

/**
 * Admin reads deliberately include inactive and sold-out rows — the whole
 * point of this screen is to see and edit what customers cannot.
 */

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
};

export type AdminMenuItem = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_paise: number;
  image_url: string | null;
  is_veg: boolean;
  is_available: boolean;
  is_active: boolean;
  prep_lead_time_hours: number;
  display_order: number;
};

export type AdminSlot = {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  max_orders: number;
  cutoff_hours_before: number;
  is_active: boolean;
  display_order: number;
};

export type AdminSlotOverride = {
  id: string;
  slot_id: string;
  date: string;
  max_orders_override: number | null;
  is_closed: boolean;
  note: string | null;
};

async function client() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return supabase;
}

export async function getAdminCategories(): Promise<AdminCategory[]> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description, display_order, is_active")
    .order("display_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAdminMenuItems(): Promise<AdminMenuItem[]> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("menu_items")
    .select(
      "id, category_id, name, description, price_paise, image_url, is_veg, is_available, is_active, prep_lead_time_hours, display_order",
    )
    .order("display_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAdminMenuItem(
  id: string,
): Promise<AdminMenuItem | null> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("menu_items")
    .select(
      "id, category_id, name, description, price_paise, image_url, is_veg, is_available, is_active, prep_lead_time_hours, display_order",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getAdminSlots(): Promise<AdminSlot[]> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("time_slots")
    .select(
      "id, label, start_time, end_time, max_orders, cutoff_hours_before, is_active, display_order",
    )
    .order("display_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getUpcomingOverrides(
  from: string,
): Promise<AdminSlotOverride[]> {
  const supabase = await client();
  const { data, error } = await supabase
    .from("slot_overrides")
    .select("id, slot_id, date, max_orders_override, is_closed, note")
    .gte("date", from)
    .order("date");
  if (error) throw new Error(error.message);
  return data ?? [];
}
