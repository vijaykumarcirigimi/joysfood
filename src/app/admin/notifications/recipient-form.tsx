"use client";

import { useActionState } from "react";
import { Checkbox, ErrorNote, Field, SubmitButton } from "@/app/admin/ui";
import type { Recipient } from "@/lib/recipients";
import { saveRecipient, type ActionState } from "./actions";

/**
 * Add or edit one recipient.
 *
 * The three event checkboxes are separate on purpose: someone who only wants to
 * know about refunds owed should not have to take every new order as well.
 */
export function RecipientForm({ recipient }: { recipient?: Recipient }) {
  const [state, action] = useActionState<ActionState, FormData>(saveRecipient, {
    error: null,
  });

  const isEdit = Boolean(recipient);

  return (
    <form action={action} className="space-y-4">
      {recipient ? <input type="hidden" name="id" value={recipient.id} /> : null}

      <ErrorNote error={state.error} />
      {state.ok ? (
        <p className="rounded-lg border border-veg/40 bg-veg/10 px-3 py-2 text-sm text-veg">
          Saved.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Name"
          name="name"
          required
          maxLength={60}
          defaultValue={recipient?.name ?? ""}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          required
          defaultValue={recipient?.email ?? ""}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Send them</legend>
        <div className="mt-2 space-y-2">
          <Checkbox
            label="New orders"
            name="onNewOrder"
            defaultChecked={recipient?.on_new_order ?? true}
          />
          <Checkbox
            label="Cancellations"
            name="onCancellation"
            defaultChecked={recipient?.on_cancellation ?? true}
          />
          <Checkbox
            label="Refunds owed"
            name="onRefundOwed"
            defaultChecked={recipient?.on_refund_owed ?? true}
          />
        </div>
      </fieldset>

      <Checkbox
        label="Active"
        name="isActive"
        defaultChecked={recipient?.is_active ?? true}
        hint="Turn off to stop all email to this address without removing it."
      />

      <SubmitButton>{isEdit ? "Save changes" : "Add recipient"}</SubmitButton>
    </form>
  );
}
