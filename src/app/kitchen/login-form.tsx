"use client";

import { useActionState } from "react";
import { Loader2, Lock } from "lucide-react";
import { kitchenLogin } from "./actions";

export function LoginForm({ next = "/kitchen" }: { next?: string }) {
  const [state, action, pending] = useActionState(kitchenLogin, {
    error: null as string | null,
  });

  return (
    <form action={action} className="w-full max-w-sm">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="password" className="text-sm font-medium">
        Kitchen password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className="mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
      />

      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-nonveg">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Lock className="size-4" aria-hidden />
        )}
        Sign in
      </button>
    </form>
  );
}
