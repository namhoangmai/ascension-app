import NextAuth from "next-auth";

import { authConfig, passwordRefreshProof } from "./config";

const nextAuth = NextAuth(authConfig);

export const { handlers, auth, signIn, signOut } = nextAuth;

/**
 * Server-side session refresh after a password change. Signs the new `passwordUpdatedAt` so the
 * `jwt` callback (config.ts) only honours updates that came from here, never from the public
 * `POST /api/auth/session` endpoint.
 */
export function updateSession(data: { user: { passwordUpdatedAt: string | null } }) {
  return nextAuth.unstable_update({
    ...data,
    proof: passwordRefreshProof(data.user.passwordUpdatedAt)
  } as unknown as Parameters<typeof nextAuth.unstable_update>[0]);
}
