import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthConfig } from "next-auth";

import { prisma } from "@/lib/db/prisma";
import { sendWelcomeEmail } from "@/lib/services/email";

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
  events: {
    // Google only reaches here with email_verified === true (see signIn callback).
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.id) {
        const result = await prisma.user.updateMany({
          where: { id: user.id, emailVerified: null },
          data: { emailVerified: new Date() }
        });

        // Only true on the first Google sign-up (transition from emailVerified: null), never on
        // repeat Google logins.
        if (result.count === 1) {
          await sendWelcomeEmail(user.email ?? "", user.name);
        }
      }
    }
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") {
        return true;
      }

      // Refuse Google accounts whose email Google has not verified (blocks account pre-linking).
      if (profile?.email_verified !== true || !profile.email) {
        return false;
      }

      // Pre-hijack defense: if an UNVERIFIED credential account already exists for this email, an
      // attacker may know its password. Drop the password and revoke sessions before linking; the
      // real owner can set a new one via password reset.
      const email = profile.email.toLowerCase();
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, emailVerified: true, passwordHash: true }
      });

      if (existing && !existing.emailVerified && existing.passwordHash) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: existing.id },
            data: { passwordHash: null, passwordUpdatedAt: new Date() }
          }),
          prisma.session.deleteMany({ where: { userId: existing.id } })
        ]);
      }

      return true;
    },
    jwt({ token, user }) {
      const maybeUser = user as { passwordUpdatedAt?: unknown } | undefined;

      if (maybeUser && "passwordUpdatedAt" in maybeUser) {
        token.passwordUpdatedAt =
          typeof maybeUser.passwordUpdatedAt === "string" ? maybeUser.passwordUpdatedAt : null;
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
