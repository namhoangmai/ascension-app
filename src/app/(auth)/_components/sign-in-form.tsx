"use client";

import Link from "next/link";
import { useActionState, useCallback, useRef, useState } from "react";

import { signInWithPasswordAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/server";

import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";
import { VerifyEmailForm, type PendingCredentials } from "./verify-email-form";

const initialState: AuthActionState = { status: "idle" };

export function SignInForm() {
  // Held only in memory so an unverified account can be signed in right after
  // it verifies its email; cleared as soon as it is consumed.
  const credentials = useRef<PendingCredentials | null>(null);
  const [dismissedState, setDismissedState] = useState<AuthActionState | null>(null);
  const [state, action] = useActionState(async (previous: AuthActionState, formData: FormData) => {
    const password = formData.get("password");
    credentials.current =
      typeof password === "string" && password
        ? { password, remember: formData.get("remember") === "on" }
        : null;
    return signInWithPasswordAction(previous, formData);
  }, initialState);

  const takeCredentials = useCallback(() => {
    const value = credentials.current;
    credentials.current = null;
    return value;
  }, []);

  if (state.step === "verify-email" && state.email && state !== dismissedState) {
    return (
      <VerifyEmailForm
        email={state.email}
        cooldownSeconds={state.cooldownSeconds}
        takeCredentials={takeCredentials}
        onBack={() => {
          credentials.current = null;
          setDismissedState(state);
        }}
      />
    );
  }

  return (
    <form action={action} className="space-y-4">
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={state.fieldErrors?.email}
        required
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
        required
      />
      <div className="flex items-center justify-between gap-3 text-sm">
        <label className="flex items-center gap-2 text-muted-foreground">
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            className="size-4 rounded border-border accent-foreground"
          />
          Remember me
        </label>
        <Link
          href="/forgot-password"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      {state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
