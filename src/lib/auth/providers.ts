import { verify } from "argon2";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { prisma } from "@/lib/db/prisma";

import { assertRateLimit, clearRateLimit, getRateLimitKey } from "./rate-limit";
import { signInSchema } from "./validation";

export function getAuthProviders() {
  const googleClientId = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  const providers: Provider[] = [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember me", type: "checkbox" }
      },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse({
          email: credentials.email,
          password: credentials.password,
          remember: credentials.remember === "on" || credentials.remember === "true"
        });

        if (!parsed.success) {
          return null;
        }

        const rateLimitKey = getRateLimitKey("login", parsed.data.email);
        assertRateLimit({ key: rateLimitKey, limit: 5, windowMs: 15 * 60 * 1000 });

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            passwordHash: true,
            passwordUpdatedAt: true
          }
        });

        if (!user?.passwordHash) {
          return null;
        }

        const isValidPassword = await verify(user.passwordHash, parsed.data.password);

        if (!isValidPassword) {
          return null;
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
        allowDangerousEmailAccountLinking: true
      })
    );
  }

  return providers;
}
