"use client";

import { useActionState, useEffect, useState } from "react";

import { signUpWithPasswordAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/server";

import { FormField } from "./form-field";
import { PasswordRequirements } from "./password-requirements";
import { SubmitButton } from "./submit-button";

const initialState: AuthActionState = { status: "idle" };

export function SignUpForm() {
  const [state, action] = useActionState(signUpWithPasswordAction, initialState);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    // Every submission (success or failure) clears the underlying password
    // inputs, mirroring a native form reset — keep the live requirements
    // checklist in sync with that instead of showing a stale password.
    setPassword("");
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <FormField
        label="Name"
        name="name"
        autoComplete="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={state.fieldErrors?.name}
        required
      />
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={state.fieldErrors?.email}
        required
      />
      <div className="space-y-2">
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          onChange={(event) => setPassword(event.target.value)}
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
          className="size-4 rounded border-white/20 bg-white/10 accent-primary"
        />
        Remember this device
      </label>
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}
