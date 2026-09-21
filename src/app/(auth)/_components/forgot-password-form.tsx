"use client";

import { useActionState } from "react";

import { requestPasswordResetAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/server";

import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
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
        <FormMessage tone={state.status === "success" ? "success" : "error"}>
          {state.message}
        </FormMessage>
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
