"use client";

import { useActionState, useEffect, useState } from "react";

import { changePasswordAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/server";

import { FormField } from "@/app/(auth)/_components/form-field";
import { FormMessage } from "@/app/(auth)/_components/form-message";
import { PasswordRequirements } from "@/app/(auth)/_components/password-requirements";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";

const initialState: AuthActionState = { status: "idle" };

interface ChangePasswordFormProps {
  hasPassword: boolean;
}

export function ChangePasswordForm({ hasPassword }: ChangePasswordFormProps) {
  const [state, action] = useActionState(changePasswordAction, initialState);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    // Every submission (success or failure) clears the underlying password
    // inputs, mirroring a native form reset — keep the live requirements
    // checklist in sync with that instead of showing a stale password.
    setNewPassword("");
  }, [state]);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-title">{hasPassword ? "Change password" : "Set a password"}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {hasPassword
          ? "Update the password used to sign in with your username or email."
          : "Set a password so you can also sign in with your username or email instead of only Google."}
      </p>
      <form action={action} className="mt-5 space-y-4">
        {hasPassword ? (
          <FormField
            label="Current password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            error={state.fieldErrors?.currentPassword}
            required
          />
        ) : null}
        <div className="space-y-2">
          <FormField
            label="New password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
            }}
            error={state.fieldErrors?.newPassword}
            required
          />
          <PasswordRequirements password={newPassword} />
        </div>
        <FormField
          label="Confirm new password"
          name="confirmNewPassword"
          type="password"
          autoComplete="new-password"
          error={state.fieldErrors?.confirmNewPassword}
          required
        />
        {state.message ? (
          <FormMessage tone={state.status === "success" ? "success" : "error"}>
            {state.message}
          </FormMessage>
        ) : null}
        <SubmitButton>{hasPassword ? "Change password" : "Set password"}</SubmitButton>
      </form>
    </section>
  );
}
