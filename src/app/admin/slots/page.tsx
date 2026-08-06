import { CalendarX2 } from "lucide-react";
import { deleteSlotOverride } from "@/app/admin/actions";
import { OverrideForm, SlotForm } from "./slot-forms";
import { getAdminSlots, getUpcomingOverrides } from "@/lib/admin-data";
import { formatDayLabel, formatTime, istToday } from "@/lib/dates";

export const metadata = { title: "Slots" };

export default async function AdminSlotsPage() {
  const today = istToday();
  const [slots, overrides] = await Promise.all([
    getAdminSlots(),
    getUpcomingOverrides(today),
  ]);

  const slotById = new Map(slots.map((slot) => [slot.id, slot]));

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div>
        <h1 className="mb-1 font-display text-2xl font-bold tracking-tight">
          Time slots
        </h1>
        <p className="mb-6 text-sm text-muted">
          Capacity is enforced in the database, per slot per day. Cutoff hours
          are counted in IST.
        </p>

        {slots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
            No slots yet — add one on the right. Without slots nobody can
            check out.
          </p>
        ) : (
          <ul className="space-y-4">
            {slots.map((slot) => (
              <li
                key={slot.id}
                className="rounded-2xl border border-border bg-surface p-5"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold">
                    {slot.label}
                    <span className="ml-2 text-sm font-normal text-muted">
                      {formatTime(slot.start_time)} –{" "}
                      {formatTime(slot.end_time)} · {slot.max_orders} orders ·{" "}
                      {slot.cutoff_hours_before}h notice
                    </span>
                  </p>
                  {!slot.is_active ? (
                    <span className="rounded-full bg-surface-alt px-2.5 py-1 text-xs text-muted">
                      paused
                    </span>
                  ) : null}
                </div>
                <SlotForm slot={slot} />
              </li>
            ))}
          </ul>
        )}

        <section className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <CalendarX2 className="size-4 text-primary" aria-hidden />
            Upcoming closures and capacity changes
          </h2>

          {overrides.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">
              Nothing scheduled. Normal capacity applies every day.
            </p>
          ) : (
            <ul className="space-y-2">
              {overrides.map((override) => (
                <li
                  key={override.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3"
                >
                  <span className="font-medium">
                    {formatDayLabel(override.date)}
                  </span>
                  <span className="text-sm text-muted">
                    {slotById.get(override.slot_id)?.label ?? "Unknown slot"}
                  </span>
                  <span
                    className={
                      override.is_closed
                        ? "rounded-full bg-nonveg/10 px-2.5 py-1 text-xs font-medium text-nonveg"
                        : "rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary"
                    }
                  >
                    {override.is_closed
                      ? "Closed"
                      : `Capacity ${override.max_orders_override}`}
                  </span>
                  {override.note ? (
                    <span className="text-sm text-muted">{override.note}</span>
                  ) : null}

                  <form action={deleteSlotOverride} className="ml-auto">
                    <input type="hidden" name="id" value={override.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-nonveg/40 hover:text-nonveg"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-4 font-semibold">New slot</h2>
          <SlotForm />
        </div>

        {slots.length > 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-1 font-semibold">Close a day</h2>
            <p className="mb-4 text-xs text-muted">
              Festival, holiday, or a smaller batch than usual.
            </p>
            <OverrideForm slots={slots} today={today} />
          </div>
        ) : null}
      </aside>
    </div>
  );
}
