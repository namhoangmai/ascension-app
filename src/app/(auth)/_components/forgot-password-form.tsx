"use client";

import { useActionState } from "react";

import { requestPasswordResetAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/server";

import { FormField } from "./form-field";
import { SubmitButton } from "./submit-button";

const initialState: AuthActionState = { status: "idle" };

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, initialState);

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
      {state.message ? (
        <p
          className={
            state.status === "success" ? "text-sm text-primary" : "text-sm text-destructive"
          }
        >
          {state.message}
        </p>
      ) : null}
      {state.resetUrl ? (
        <a
          href={state.resetUrl}
          className="block break-all text-sm text-muted-foreground underline"
        >
          Development reset link: {state.resetUrl}
        </a>
      ) : null}
      <SubmitButton>Send reset link</SubmitButton>
    </form>
  );
}
