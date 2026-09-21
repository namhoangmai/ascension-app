import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signInWithGoogleAction } from "@/lib/auth/actions";

export function GoogleButton() {
  const isConfigured = Boolean(
    (process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID) &&
    (process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET)
  );

  return (
    <form action={signInWithGoogleAction}>
      <Button type="submit" variant="outline" size="lg" className="w-full" disabled={!isConfigured}>
        <ShieldCheck className="size-4" aria-hidden="true" />
        {isConfigured ? "Continue with Google" : "Google login not configured"}
      </Button>
    </form>
  );
}
