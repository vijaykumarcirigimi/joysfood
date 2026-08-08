import { createSupabasePublicClient } from "./supabase/public";
import { addDays, istToday } from "./dates";

/** How far ahead customers may book. Mirrors the copy on the home page. */
export const BOOKING_WINDOW_DAYS = 14;

type RawSlot = {
  slot_id: string;
  label: string;
  start_time: string;
  end_time: string;
  cutoff_hours_before: number;
  display_order: number;
  service_date: string;
  capacity: number;
  seats_taken: number;
  seats_left: number;
  is_closed: boolean;
  cutoff_at: string;
  starts_at: string;
};

export type OrderingRules = {
  slots: {
    label: string;
    startTime: string;
    endTime: string;
    maxOrders: number;
    cutoffHours: number;
  }[];
  /** Single value when every slot agrees, which is the normal case. */
  cutoffHours: number | null;
  /** Longest per-dish notice on the live menu, e.g. the 24h biryani. */
  maxLeadHours: number;
  /** Dishes needing the longest notice, for naming them in copy. */
  longestLeadDishes: string[];
};

/**
 * The real ordering rules, for the How it works page.
 *
 * Read from the database rather than written into the copy, so the page cannot
 * promise a cutoff the admin panel has since changed. A page that describes
 * rules the system no longer enforces is worse than no page.
 */
export async function getOrderingRules(): Promise<OrderingRules> {
  const supabase = createSupabasePublicClient();
  if (!supabase) {
    return { slots: [], cutoffHours: null, maxLeadHours: 0, longestLeadDishes: [] };
  }

  const [slotsResult, dishesResult] = await Promise.all([
    supabase
      .from("time_slots")
      .select("label, start_time, end_time, max_orders, cutoff_hours_before")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("menu_items")
      .select("name, prep_lead_time_hours")
      .eq("is_active", true)
      .order("prep_lead_time_hours", { ascending: false })
      .limit(20),
  ]);

  if (slotsResult.error) {
    console.error("[slots] ordering rules failed:", slotsResult.error);
  }

  const slots = (slotsResult.data ?? []).map((row) => ({
    label: row.label as string,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    maxOrders: row.max_orders as number,
    cutoffHours: row.cutoff_hours_before as number,
  }));

  const distinctCutoffs = [...new Set(slots.map((s) => s.cutoffHours))];

  const dishes = (dishesResult.data ?? []) as {
    name: string;
    prep_lead_time_hours: number;
  }[];
  const maxLeadHours = dishes[0]?.prep_lead_time_hours ?? 0;

  return {
    slots,
    cutoffHours: distinctCutoffs.length === 1 ? distinctCutoffs[0] : null,
    maxLeadHours,
    longestLeadDishes: dishes
      .filter((d) => d.prep_lead_time_hours === maxLeadHours && maxLeadHours > 0)
      .map((d) => d.name)
      .slice(0, 3),
  };
}

export type SlotOption = {
  slotId: string;
  label: string;
  startTime: string;
  endTime: string;
  serviceDate: string;
  seatsLeft: number;
  capacity: number;
  isClosed: boolean;
  /** ISO instants — the client compares these against its own clock for hints
   *  only. place_order() re-checks both server-side and is the authority. */
  cutoffAt: string;
  startsAt: string;
};

export type DaySlots = {
  date: string;
  slots: SlotOption[];
};

/**
 * Slot availability for the booking window.
 *
 * Returns [] when slots are not configured yet (migration 0002 not applied),
 * so the cart degrades to "no slots available" instead of crashing.
 */
export async function getSlotAvailability(
  days: number = BOOKING_WINDOW_DAYS,
): Promise<{ days: DaySlots[]; configured: boolean }> {
  const supabase = createSupabasePublicClient();
  if (!supabase) return { days: [], configured: false };

  const from = istToday();
  const to = addDays(from, days - 1);

  const { data, error } = await supabase.rpc("slot_availability", {
    p_from: from,
    p_to: to,
  });

  if (error) {
    console.error("[slots] availability lookup failed:", error);
    return { days: [], configured: false };
  }

  const rows = (data ?? []) as RawSlot[];
  const byDate = new Map<string, SlotOption[]>();

  for (const row of rows) {
    const option: SlotOption = {
      slotId: row.slot_id,
      label: row.label,
      startTime: row.start_time,
      endTime: row.end_time,
      serviceDate: row.service_date,
      seatsLeft: row.seats_left,
      capacity: row.capacity,
      isClosed: row.is_closed,
      cutoffAt: row.cutoff_at,
      startsAt: row.starts_at,
    };
    const bucket = byDate.get(row.service_date);
    if (bucket) bucket.push(option);
    else byDate.set(row.service_date, [option]);
  }

  return {
    days: Array.from(byDate.entries()).map(([date, slots]) => ({ date, slots })),
    configured: rows.length > 0,
  };
}
