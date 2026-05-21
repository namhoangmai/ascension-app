"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInWithPasswordAction } from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/server";

import { FormField } from "./form-field";
import { SubmitButton } from "./submit-button";

const initialState: AuthActionState = { status: "idle" };

export function SignInForm() {
  const [state, action] = useActionState(signInWithPasswordAction, initialState);

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
            className="size-4 rounded border-white/20 bg-white/10 accent-primary"
          />
          Remember me
        </label>
        <Link href="/forgot-password" className="font-medium text-primary">
          Forgot password?
        </Link>
      </div>
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
