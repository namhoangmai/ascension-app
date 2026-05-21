"use client";

import { useActionState } from "react";

import { signUpWithPasswordAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/server";

import { FormField } from "./form-field";
import { SubmitButton } from "./submit-button";

const initialState: AuthActionState = { status: "idle" };

export function SignUpForm() {
  const [state, action] = useActionState(signUpWithPasswordAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <FormField
        label="Name"
        name="name"
        autoComplete="name"
        error={state.fieldErrors?.name}
        required
      />
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
