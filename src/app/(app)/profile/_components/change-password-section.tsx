"use client";

import { Loader2 } from "lucide-react";
import { startTransition, useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  changePasswordAction,
  changePasswordWithCodeAction,
  requestPasswordChangeCodeAction
} from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/server";
import { cn } from "@/lib/utils";

import { FormField } from "@/app/(auth)/_components/form-field";
import { FormMessage } from "@/app/(auth)/_components/form-message";
import { PasswordRequirements } from "@/app/(auth)/_components/password-requirements";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";

const initialState: AuthActionState = { status: "idle" };
const DEFAULT_COOLDOWN_SECONDS = 60;
const CODE_LENGTH = 6;

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

/** Masks all but the first local-part character, e.g. `jane@example.com` -> `j***@example.com`. */
function maskEmail(email: string) {
  const [local, domain] = email.split("@");

  if (!local || !domain) {
    return email;
  }

  return `${local.slice(0, 1)}***@${domain}`;
}

interface ChangePasswordSectionProps {
  hasPassword: boolean;
  email: string;
}

export function ChangePasswordSection({ hasPassword, email }: ChangePasswordSectionProps) {
  const [method, setMethod] = useState<"password" | "code">(hasPassword ? "password" : "code");

  return (
    <div>
      <h3 className="text-title">{hasPassword ? "Change password" : "Set a password"}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {hasPassword
          ? "Update the password used to sign in with your username or email."
          : "Set a password so you can also sign in with your username or email instead of only Google."}
      </p>

      {hasPassword ? (
        <div className="mt-4 inline-flex rounded-full border border-border bg-muted p-1 text-sm">
          <button
            type="button"
            onClick={() => {
              setMethod("password");
            }}
            aria-pressed={method === "password"}
            className={cn(
              "press rounded-full px-4 py-1.5 font-medium transition-colors",
              method === "password"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Current password
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod("code");
            }}
            aria-pressed={method === "code"}
            className={cn(
              "press rounded-full px-4 py-1.5 font-medium transition-colors",
              method === "code"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Email me a code
          </button>
        </div>
      ) : null}

      <div className="mt-5">
        {method === "password" ? (
          <CurrentPasswordForm />
        ) : (
          <CodeChangeFlow email={email} hasPassword={hasPassword} />
        )}
      </div>
    </div>
  );
}

function CurrentPasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialState);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    // Every submission (success or failure) clears the underlying password inputs, mirroring a
    // native form reset — keep the live requirements checklist in sync instead of showing stale
    // password contents.
    setNewPassword("");
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <FormField
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.currentPassword}
        required
      />
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
      <SubmitButton>Change password</SubmitButton>
    </form>
  );
}

interface CodeChangeFlowProps {
  email: string;
  hasPassword: boolean;
}

function CodeChangeFlow({ email, hasPassword }: CodeChangeFlowProps) {
  const [requestState, setRequestState] = useState<AuthActionState>(initialState);
  const [isRequesting, setIsRequesting] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [codeRequested, setCodeRequested] = useState(false);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [changeState, changeAction, isChanging] = useActionState(
    changePasswordWithCodeAction,
    initialState
  );

  // Visible resend countdown, ticking once per second while above zero.
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [remaining]);

  useEffect(() => {
    setNewPassword("");
    setCode("");
  }, [changeState]);

  function requestCode() {
    setIsRequesting(true);
    startTransition(async () => {
      // `requestPasswordChangeCodeAction` takes zero arguments — it cannot go through
      // `useActionState`/a plain form action, so it is invoked directly here.
      const result = await requestPasswordChangeCodeAction();
      setIsRequesting(false);
      setRequestState(result);
      setRemaining(result.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS);
      setCode("");
      if (result.status === "success") {
        setCodeRequested(true);
      }
    });
  }

  const maskedEmail = maskEmail(requestState.email ?? email);

  return (
    <div className="space-y-4">
      {requestState.status === "error" ? (
        <FormMessage tone="error">{requestState.message}</FormMessage>
      ) : null}

      {!codeRequested ? (
        <>
          <p className="text-sm text-muted-foreground">
            We will email a 6-digit code to your account email to confirm this change.
          </p>
          <Button type="button" onClick={requestCode} disabled={isRequesting || remaining > 0}>
            {isRequesting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {remaining > 0 ? `Try again in ${String(remaining)}s` : "Email me a code"}
          </Button>
        </>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-foreground">{maskedEmail}</span>.
          </p>
          <form action={changeAction} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">Verification code</span>
              <input
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                pattern="[0-9]{6}"
                placeholder="000000"
                required
                value={code}
                aria-invalid={changeState.fieldErrors?.code ? true : undefined}
                onChange={(event) => {
                  setCode(digitsOnly(event.target.value));
                }}
                onPaste={(event) => {
                  event.preventDefault();
                  setCode(digitsOnly(event.clipboardData.getData("text")));
                }}
                className="h-12 w-full rounded-md border border-border bg-muted px-3 text-center font-mono text-xl tracking-[0.5em] text-foreground outline-none transition-shadow duration-200 placeholder:text-muted-foreground focus:border-foreground focus:ring-2 focus:ring-ring"
              />
              {changeState.fieldErrors?.code ? (
                <FormMessage tone="error">{changeState.fieldErrors.code[0]}</FormMessage>
              ) : null}
            </label>
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
                error={changeState.fieldErrors?.newPassword}
                required
              />
              <PasswordRequirements password={newPassword} />
            </div>
            <FormField
              label="Confirm new password"
              name="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              error={changeState.fieldErrors?.confirmNewPassword}
              required
            />
            {changeState.message ? (
              <FormMessage tone={changeState.status === "success" ? "success" : "error"}>
                {changeState.message}
              </FormMessage>
            ) : null}
            <SubmitButton>{hasPassword ? "Change password" : "Set password"}</SubmitButton>
          </form>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={requestCode}
            disabled={isRequesting || remaining > 0 || isChanging}
          >
            {isRequesting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {remaining > 0 ? `Resend code in ${String(remaining)}s` : "Resend code"}
          </Button>
        </div>
      )}
    </div>
  );
}
