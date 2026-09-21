import Link from "next/link";

import { FormMessage } from "../_components/form-message";
import { AuthCard } from "../_components/auth-card";
import { ResetPasswordForm } from "../_components/reset-password-form";

interface ResetPasswordPageProps {
  searchParams: Promise<{
    token?: string;
  }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  return (
    <AuthCard
      eyebrow="Secure reset"
      title="Choose new password"
      description="Use a strong password that you do not use anywhere else."
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-4">
          <FormMessage tone="error">Reset token is missing.</FormMessage>
          <Link
            href="/forgot-password"
            className="block text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Request a new link
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
