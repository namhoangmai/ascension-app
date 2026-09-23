"use client";

import { ShieldCheck } from "lucide-react";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import { useTransition, type SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { signInWithGoogleAction } from "@/lib/auth/actions";

interface GoogleSignInFormProps {
  disabled: boolean;
}

export function GoogleSignInForm({ disabled }: GoogleSignInFormProps) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      try {
        await signInWithGoogleAction();
      } catch (error) {
        // A tab left open across a deploy can still be running JS that
        // references a server action id the current server no longer
        // recognizes. Reload to pick up the current build instead of
        // dead-ending on a raw error. Anything else (network failure, a
        // real OAuth error, etc.) is rethrown untouched.
        if (unstable_isUnrecognizedActionError(error)) {
          window.location.reload();
          return;
        }

        throw error;
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Button
        type="submit"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={disabled || isPending}
      >
        <ShieldCheck className="size-4" aria-hidden="true" />
        {disabled ? "Google login not configured" : "Continue with Google"}
      </Button>
    </form>
  );
}
