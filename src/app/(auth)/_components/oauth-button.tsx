import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signInWithFacebookAction, signInWithGoogleAction } from "@/lib/auth/actions";

function isOAuthConfigured(clientId: string | undefined, clientSecret: string | undefined) {
  return Boolean(clientId && clientSecret);
}

export function GoogleButton() {
  const isConfigured = isOAuthConfigured(
    process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID,
    process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET
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

export function FacebookButton() {
  const isConfigured = isOAuthConfigured(
    process.env.AUTH_FACEBOOK_ID ?? process.env.FACEBOOK_CLIENT_ID,
    process.env.AUTH_FACEBOOK_SECRET ?? process.env.FACEBOOK_CLIENT_SECRET
  );

  return (
    <form action={signInWithFacebookAction}>
      <Button type="submit" variant="outline" size="lg" className="w-full" disabled={!isConfigured}>
        <ShieldCheck className="size-4" aria-hidden="true" />
        {isConfigured ? "Continue with Facebook" : "Facebook login not configured"}
      </Button>
    </form>
  );
}
