"use client";

import { useActionState } from "react";
import { saveSlot, saveSlotOverride, type ActionState } from "@/app/admin/actions";
import {
  Checkbox,
  ErrorNote,
  Field,
  Select,
  SubmitButton,
} from "@/app/admin/ui";
import type { AdminSlot } from "@/lib/admin-data";

export function SlotForm({ slot }: { slot?: AdminSlot }) {
  const [state, action] = useActionState<ActionState, FormData>(saveSlot, {
    error: null,
  });

  return (
    <form action={action} className="space-y-4">
      {slot ? <input type="hidden" name="id" value={slot.id} /> : null}

      <ErrorNote error={state.error} />

      <Field
        label="Label"
        name="label"
        required
        maxLength={60}
        placeholder="Lunch · 12:00 – 13:00"
        defaultValue={slot?.label ?? ""}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Starts"
          name="startTime"
          type="time"
          required
          defaultValue={slot?.start_time.slice(0, 5) ?? "12:00"}
        />
        <Field
          label="Ends"
          name="endTime"
          type="time"
          required
          defaultValue={slot?.end_time.slice(0, 5) ?? "13:00"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Capacity"
          name="maxOrders"
          type="number"
          min={1}
          max={500}
          required
          defaultValue={slot?.max_orders ?? 20}
          hint="Orders per day"
        />
        <Field
          label="Cutoff (hours)"
          name="cutoffHours"
          type="number"
          min={0}
          max={168}
          required
          defaultValue={slot?.cutoff_hours_before ?? 12}
          hint="Notice required"
        />
        <Field
          label="Order"
          name="displayOrder"
          type="number"
          min={0}
          max={999}
          required
          defaultValue={slot?.display_order ?? 0}
        />
      </div>

      <Checkbox
        label="Accepting orders"
        name="isActive"
        defaultChecked={slot?.is_active ?? true}
      />

      <SubmitButton>{slot ? "Save slot" : "Add slot"}</SubmitButton>
    </form>
  );
}

export function OverrideForm({
  slots,
  today,
}: {
  slots: AdminSlot[];
  today: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    saveSlotOverride,
    { error: null },
  );

  return (
    <form action={action} className="space-y-4">
      <ErrorNote error={state.error} />

      <Select label="Slot" name="slotId" required defaultValue="">
        <option value="" disabled>
          Choose…
        </option>
        {slots.map((slot) => (
          <option key={slot.id} value={slot.id}>
            {slot.label}
          </option>
        ))}
      </Select>

      <Field label="Date" name="date" type="date" required min={today} />

      <Select label="What happens" name="mode" defaultValue="close">
        <option value="close">Closed — no orders that day</option>
        <option value="capacity">Different capacity</option>
      </Select>

      <Field
        label="Capacity (only if changing capacity)"
        name="capacity"
        type="number"
        min={0}
        max={500}
        placeholder="10"
      />

      <Field
        label="Note"
        name="note"
        maxLength={120}
        placeholder="Diwali — kitchen closed"
      />

      <SubmitButton>Save override</SubmitButton>
    </form>
  );
}
