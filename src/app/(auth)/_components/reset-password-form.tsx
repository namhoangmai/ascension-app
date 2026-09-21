"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { resetPasswordAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/server";

import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { PasswordRequirements } from "./password-requirements";
import { SubmitButton } from "./submit-button";

const initialState: AuthActionState = { status: "idle" };

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [state, action] = useActionState(resetPasswordAction, initialState);
  const [password, setPassword] = useState("");

  useEffect(() => {
    setPassword("");
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <FormField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          error={state.fieldErrors?.password}
          required
        />
        <PasswordRequirements password={password} />
      </div>
      <FormField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.confirmPassword}
        required
      />
      {state.message ? (
        <FormMessage tone={state.status === "success" ? "success" : "error"}>
          {state.message}
        </FormMessage>
      ) : null}
      {state.status === "success" ? (
        <Link
          href="/sign-in"
          className="block text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      ) : null}
      <SubmitButton>Reset password</SubmitButton>
    </form>
  );
}
