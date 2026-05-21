"use client";

import Link from "next/link";
import { useActionState } from "react";

import { resetPasswordAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/server";

import { FormField } from "./form-field";
import { SubmitButton } from "./submit-button";

const initialState: AuthActionState = { status: "idle" };

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [state, action] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.password}
        required
      />
      <FormField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.confirmPassword}
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
      {state.status === "success" ? (
        <Link href="/sign-in" className="block text-sm font-medium text-primary">
          Back to sign in
        </Link>
      ) : null}
      <SubmitButton>Reset password</SubmitButton>
    </form>
  );
}
