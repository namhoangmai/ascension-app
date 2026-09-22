import { verify } from "argon2";
import { CredentialsSignin } from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { findUserByIdentifier } from "./identifier";
import { assertRateLimit, clearRateLimit, getRateLimitKey } from "./rate-limit";
import { signInSchema } from "./validation";

/** Thrown only after the password was verified, so it does not reveal whether an account exists. */
export class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

export function getAuthProviders() {
  const googleClientId = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  const providers: Provider[] = [
    Credentials({
      name: "Email and password",
      credentials: {
        identifier: { label: "Email or username", type: "text" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember me", type: "checkbox" }
      },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse({
          identifier: credentials.identifier,
          password: credentials.password,
          remember: credentials.remember === "on" || credentials.remember === "true"
        });

        if (!parsed.success) {
          return null;
        }

        const rateLimitKey = getRateLimitKey("login", parsed.data.identifier);
        assertRateLimit({ key: rateLimitKey, limit: 5, windowMs: 15 * 60 * 1000 });

        const user = await findUserByIdentifier(parsed.data.identifier);

        if (!user?.passwordHash) {
          return null;
        }

        const isValidPassword = await verify(user.passwordHash, parsed.data.password);

        if (!isValidPassword) {
          return null;
        }

        if (!user.emailVerified) {
          throw new EmailNotVerifiedError();
        }

        clearRateLimit(rateLimitKey);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          passwordUpdatedAt: user.passwordUpdatedAt?.toISOString() ?? null
        };
      }
    })
  ];

  if (googleClientId && googleClientSecret) {
    providers.push(
      Google({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        // Safe only because the signIn callback in config.ts rejects any Google profile whose
        // email_verified is not true, so an unverified Google email can never link to an account.
        allowDangerousEmailAccountLinking: true
      })
    );
  }

  return providers;
}
