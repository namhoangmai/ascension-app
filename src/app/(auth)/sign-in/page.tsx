import Link from "next/link";

import { AuthCard } from "../_components/auth-card";
import { FormMessage } from "../_components/form-message";
import { GoogleButton } from "../_components/oauth-button";
import { SignInForm } from "../_components/sign-in-form";

interface SignInPageProps {
  searchParams: Promise<{ verified?: string | string[] }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { verified } = await searchParams;
  const showVerifiedNotice = verified === "1";

  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Sign in"
      description="Pick up your training log, nutrition targets, and body progress."
    >
      <div className="space-y-4">
        {showVerifiedNotice ? (
          <FormMessage tone="success">Email verified, please sign in.</FormMessage>
        ) : null}
        <GoogleButton />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
        <SignInForm />
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
