/**
 * Every business date in this app is a calendar day in Asia/Kolkata, held as a
 * plain `YYYY-MM-DD` string. Never derive one from the browser's clock or from
 * the server's local zone — see plan.md §6.2.
 */
export const IST = "Asia/Kolkata";

/** Today's date in IST, as YYYY-MM-DD. */
export function istToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Date strings are anchored to midday UTC before arithmetic so that adding a
 * day can never land on a DST boundary and shift the calendar date.
 */
function anchor(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

export function addDays(iso: string, days: number): string {
  const date = anchor(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The next `count` dates starting today, IST. */
export function upcomingDates(count: number): string[] {
  const today = istToday();
  return Array.from({ length: count }, (_, index) => addDays(today, index));
}

export function formatDayParts(iso: string): {
  weekday: string;
  day: string;
  month: string;
} {
  const date = anchor(iso);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" }).format(date);

  return {
    weekday: part({ weekday: "short" }),
    day: part({ day: "numeric" }),
    month: part({ month: "short" }),
  };
}

/** "Today", "Tomorrow", or "Mon, 12 Aug". */
export function formatDayLabel(iso: string): string {
  const today = istToday();
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  const { weekday, day, month } = formatDayParts(iso);
  return `${weekday}, ${day} ${month}`;
}

/**
 * The instant a slot begins, as epoch milliseconds.
 *
 * IST is a fixed +05:30 offset with no daylight saving, so the offset can be
 * written into the timestamp literal rather than reasoned about. This mirrors
 * `(fulfilment_date + start_time) at time zone 'Asia/Kolkata'` in the database,
 * which stays the authority — this exists so the UI can show or hide a control
 * without a round trip.
 */
export function slotStartMs(isoDate: string, startTime: string): number {
  const [hours = 0, minutes = 0] = startTime.split(":").map(Number);
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return Date.parse(`${isoDate}T${hh}:${mm}:00+05:30`);
}

/** "12:00 PM" from a Postgres `time` value like "12:00:00". */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(date);
}
