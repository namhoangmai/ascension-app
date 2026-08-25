import Link from "next/link";

import { AuthCard } from "../_components/auth-card";
import { FacebookButton, GoogleButton } from "../_components/oauth-button";
import { SignInForm } from "../_components/sign-in-form";

export default function SignInPage() {
  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Sign in"
      description="Pick up your training log, nutrition targets, and body progress."
    >
      <div className="space-y-4">
        <GoogleButton />
        <FacebookButton />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-white/10" />
          or
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <SignInForm />
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/sign-up" className="font-medium text-primary">
            Create an account
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
