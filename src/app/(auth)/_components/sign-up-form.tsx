"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";

import { signUpWithPasswordAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/server";

import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { PasswordRequirements } from "./password-requirements";
import { SubmitButton } from "./submit-button";
import { VerifyEmailForm, type PendingCredentials } from "./verify-email-form";

const initialState: AuthActionState = { status: "idle" };

export function SignUpForm() {
  // Held only in memory so the user can be signed in right after verifying
  // their email; cleared as soon as it is consumed.
  const credentials = useRef<PendingCredentials | null>(null);
  const [dismissedState, setDismissedState] = useState<AuthActionState | null>(null);
  const [state, action] = useActionState(async (previous: AuthActionState, formData: FormData) => {
    const submittedPassword = formData.get("password");
    credentials.current =
      typeof submittedPassword === "string" && submittedPassword
        ? { password: submittedPassword, remember: formData.get("remember") === "on" }
        : null;
    return signUpWithPasswordAction(previous, formData);
  }, initialState);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    // Every submission (success or failure) clears the underlying password
    // inputs, mirroring a native form reset — keep the live requirements
    // checklist in sync with that instead of showing a stale password.
    setPassword("");
  }, [state]);

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
        label="Name"
        name="name"
        autoComplete="name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
        error={state.fieldErrors?.name}
        required
      />
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
        }}
        error={state.fieldErrors?.email}
        required
      />
      <div className="space-y-2">
        <FormField
          label="Password"
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
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="remember"
          defaultChecked
          className="size-4 rounded border-border accent-foreground"
        />
        Remember this device
      </label>
      {state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}
