import Link from "next/link";

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
          <p className="text-sm text-destructive">Reset token is missing.</p>
          <Link href="/forgot-password" className="block text-sm font-medium text-primary">
            Request a new link
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
