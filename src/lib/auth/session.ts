import type { DefaultSession } from "next-auth";

export interface SessionUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export function toSessionUser(user: {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}): SessionUser {
  if (!user.email) {
    throw new Error("Authenticated users must have an email address.");
  }

  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email,
    image: user.image ?? null
  };
}

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      email: string;
      passwordUpdatedAt: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    passwordUpdatedAt?: string | null;
  }
}
