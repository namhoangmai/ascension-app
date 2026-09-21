import Link from "next/link";

import { AuthCard } from "../_components/auth-card";
import { ForgotPasswordForm } from "../_components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Reset password"
      description="Enter your email and we will prepare a secure short-lived reset link."
    >
      <div className="space-y-4">
        <ForgotPasswordForm />
        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
