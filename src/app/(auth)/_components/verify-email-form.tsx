"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  resendVerificationCodeAction,
  signInWithPasswordAction,
  verifyEmailCodeAction
} from "@/lib/auth/actions";
import type { AuthActionState } from "@/lib/auth/server";

import { FormMessage } from "./form-message";

const initialState: AuthActionState = { status: "idle" };
const DEFAULT_COOLDOWN_SECONDS = 60;
const CODE_LENGTH = 6;

export interface PendingCredentials {
  password: string;
  remember: boolean;
}

interface VerifyEmailFormProps {
  email: string;
  cooldownSeconds?: number | undefined;
  /**
   * Returns the password held in the parent's memory (and clears it), or null
   * when unavailable. Never persisted to storage.
   */
  takeCredentials: () => PendingCredentials | null;
  onBack: () => void;
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

export function VerifyEmailForm({
  email,
  cooldownSeconds,
  takeCredentials,
  onBack
}: VerifyEmailFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [signInError, setSignInError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [remaining, setRemaining] = useState(cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS);
  const handledVerification = useRef<AuthActionState | null>(null);

  const [verifyState, verifyAction, isVerifying] = useActionState(
    verifyEmailCodeAction,
    initialState
  );
  const [resendState, resendAction, isResending] = useActionState(
    resendVerificationCodeAction,
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

  // A fresh resend result restarts the cooldown and clears the old code.
  useEffect(() => {
    if (resendState.status === "idle") return;
    setRemaining(resendState.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS);
    setCode("");
  }, [resendState]);

  // After verification, sign in automatically if the password is still in memory.
  useEffect(() => {
    if (!verifyState.verified || handledVerification.current === verifyState) return;
    handledVerification.current = verifyState;

    const credentials = takeCredentials();
    if (!credentials) {
      router.replace("/sign-in?verified=1");
      return;
    }

    const formData = new FormData();
    formData.set("email", verifyState.email ?? email);
    formData.set("password", credentials.password);
    if (credentials.remember) formData.set("remember", "on");

    setIsSigningIn(true);
    startTransition(async () => {
      // On success the action redirects (e.g. to /profile/setup) and never returns.
      const result = await signInWithPasswordAction(initialState, formData);
      setIsSigningIn(false);
      if (result.status === "error") {
        setSignInError("Email verified, but automatic sign-in failed. Please sign in.");
        router.replace("/sign-in?verified=1");
      }
    });
  }, [verifyState, takeCredentials, router, email]);

  const busy = isVerifying || isSigningIn;
  const codeError = verifyState.fieldErrors?.code?.[0] ?? null;
  const verifyError =
    !verifyState.verified && verifyState.status === "error" ? verifyState.message : null;
  const errorText = signInError ?? codeError ?? verifyError;

  return (
    <div className="animate-rise-in space-y-4">
      <p className="text-sm text-muted-foreground">
        We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
        Enter it below to verify your email.
      </p>

      <form action={verifyAction} className="space-y-4">
        <input type="hidden" name="email" value={email} />
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
            autoFocus
            value={code}
            aria-invalid={errorText ? true : undefined}
            onChange={(event) => {
              setCode(digitsOnly(event.target.value));
            }}
            onPaste={(event) => {
              event.preventDefault();
              setCode(digitsOnly(event.clipboardData.getData("text")));
            }}
            className="h-12 w-full rounded-md border border-border bg-muted px-3 text-center font-mono text-xl tracking-[0.5em] text-foreground outline-none transition-shadow duration-200 placeholder:text-muted-foreground focus:border-foreground focus:ring-2 focus:ring-ring"
          />
        </label>
        <div aria-live="polite">
          {errorText ? <FormMessage tone="error">{errorText}</FormMessage> : null}
          {isSigningIn ? (
            <FormMessage tone="success">Email verified. Signing you in...</FormMessage>
          ) : null}
          {!isSigningIn && !errorText && resendState.status === "success" ? (
            <FormMessage tone="success">
              {resendState.message ?? "If the account exists, a new code is on its way."}
            </FormMessage>
          ) : null}
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={busy || code.length !== CODE_LENGTH}
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {busy ? "Working..." : "Verify"}
        </Button>
      </form>

      <form action={resendAction}>
        <input type="hidden" name="email" value={email} />
        <Button
          type="submit"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={remaining > 0 || isResending || busy}
        >
          {isResending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {remaining > 0 ? `Resend code in ${String(remaining)}s` : "Resend code"}
        </Button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="press inline-flex items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Use a different email
      </button>
    </div>
  );
}
