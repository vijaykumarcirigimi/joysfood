/**
 * Shared state shape for the email sign-in form.
 *
 * Lives outside actions.ts deliberately: a `"use server"` module may only
 * export async functions. A plain object exported from there does not arrive in
 * the client as itself, so `useActionState`'s initial state came through with
 * `step: undefined` and the form rendered the code step before a code was ever
 * sent. Keep non-function exports out of server-action files.
 */
export type EmailAuthState = {
  step: "email" | "code";
  email: string;
  error: string | null;
  notice: string | null;
};

export const EMAIL_AUTH_INITIAL: EmailAuthState = {
  step: "email",
  email: "",
  error: null,
  notice: null,
};
