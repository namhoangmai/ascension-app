import { GoogleSignInForm } from "./google-sign-in-form";

export function GoogleButton() {
  const isConfigured = Boolean(
    (process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID) &&
    (process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET)
  );

  return <GoogleSignInForm disabled={!isConfigured} />;
}
