import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthConfig } from "next-auth";

import { prisma } from "@/lib/db/prisma";

import { getAuthProviders } from "./providers";

function requireProductionSecret(name: string) {
  const value = process.env[name];

  if (process.env.NODE_ENV === "production" && !value) {
    throw new Error(`${name} is required in production.`);
  }

  return value;
}

const authSecret =
  requireProductionSecret("AUTH_SECRET") ?? "development-only-auth-secret-change-before-production";

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  secret: authSecret,
  providers: getAuthProviders(),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60
  },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in"
  },
  trustHost: true,
  callbacks: {
    async jwt({ token }) {
      if (token.sub) {
        const user = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            email: true,
            passwordUpdatedAt: true
          }
        });

        if (user?.email) {
          token.email = user.email;
        }
        token.passwordUpdatedAt = user?.passwordUpdatedAt?.toISOString() ?? null;
      }

      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.email = token.email ?? "";
      session.user.passwordUpdatedAt =
        typeof token.passwordUpdatedAt === "string" ? token.passwordUpdatedAt : null;

      return session;
    },
    authorized({ auth }) {
      return Boolean(auth?.user);
    }
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production"
      }
    }
  }
} satisfies NextAuthConfig;
