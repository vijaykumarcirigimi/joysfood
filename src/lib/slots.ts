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
