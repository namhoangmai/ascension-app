import Link from "next/link";

import { AuthCard } from "../_components/auth-card";
import { FacebookButton, GoogleButton } from "../_components/oauth-button";
import { SignUpForm } from "../_components/sign-up-form";

export default function SignUpPage() {
  return (
    <AuthCard
      eyebrow="Start strong"
      title="Create account"
      description="Build a private training and nutrition history that stays yours."
    >
      <div className="space-y-4">
        <GoogleButton />
        <FacebookButton />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-white/10" />
          or
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <SignUpForm />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
