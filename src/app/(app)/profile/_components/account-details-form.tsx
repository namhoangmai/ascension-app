"use client";

import { useActionState } from "react";

import { updateAccountDetailsAction } from "@/features/profile/actions";
import type { ProfileActionState } from "@/features/profile/server";

import { FormField } from "@/app/(auth)/_components/form-field";
import { FormMessage } from "@/app/(auth)/_components/form-message";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";

const initialState: ProfileActionState = { status: "idle" };

function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

interface AccountDetailsFormProps {
  username: string | null;
  dateOfBirth: string | null;
}

export function AccountDetailsForm({ username, dateOfBirth }: AccountDetailsFormProps) {
  const [state, action] = useActionState(updateAccountDetailsAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Username"
          name="username"
          defaultValue={username ?? ""}
          error={state.fieldErrors?.username}
          required
        />
        <FormField
          label="Date of birth"
          name="dateOfBirth"
          type="date"
          defaultValue={toDateInputValue(dateOfBirth)}
          error={state.fieldErrors?.dateOfBirth}
          required
        />
      </div>
      {state.message ? (
        <FormMessage tone={state.status === "success" ? "success" : "error"}>
          {state.message}
        </FormMessage>
      ) : null}
      <SubmitButton>Save account details</SubmitButton>
    </form>
  );
}
