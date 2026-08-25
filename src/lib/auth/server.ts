import { hash, verify } from "argon2";
import { AuthError } from "next-auth";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { randomBytes, createHash } from "node:crypto";

import { prisma } from "@/lib/db/prisma";

import { auth, signIn, signOut } from "./auth";
import { assertRateLimit, getRateLimitKey } from "./rate-limit";
import { toSessionUser, type SessionUser } from "./session";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema
} from "./validation";

export interface AuthActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  resetUrl?: string | undefined;
}

const genericSignInError = "Invalid email or password.";
const genericResetMessage = "If that email exists, a reset link will be sent.";
const genericSignUpError = "Unable to create an account right now. Try again in a moment.";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function validationError(
  fieldErrors: Record<string, string[]>,
  message = "Check the form and try again."
) {
  return {
    status: "error",
    message,
    fieldErrors
  } satisfies AuthActionState;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  let session: Session | null;

  try {
    session = await auth();
  } catch {
    return null;
  }

  if (!session?.user.id) {
    return null;
  }

  return toSessionUser(session.user);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}

export async function requireAnonymous() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }
}

export async function signInWithPassword(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  "use server";

  const parsed = signInSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    remember: formData.get("remember") === "on"
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      remember: parsed.data.remember ? "true" : "false",
      redirectTo: "/dashboard"
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        status: "error",
        message: genericSignInError
      };
    }

    throw error;
  }

  return { status: "success" };
}

export async function signUpWithPassword(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  "use server";

  const parsed = signUpSchema.safeParse({
    name: formValue(formData, "name"),
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    confirmPassword: formValue(formData, "confirmPassword"),
    remember: formData.get("remember") === "on"
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const rateLimitKey = getRateLimitKey("signup", parsed.data.email);
  assertRateLimit({ key: rateLimitKey, limit: 3, windowMs: 60 * 60 * 1000 });

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true }
    });

    if (existingUser) {
      return {
        status: "error",
        message: "Unable to create an account with those details."
      };
    }

    const passwordHash = await hash(parsed.data.password, {
      type: 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1
    });

    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        passwordUpdatedAt: new Date(),
        preferences: {
          create: {}
        }
      }
    });

    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      remember: parsed.data.remember ? "true" : "false",
      redirectTo: "/dashboard"
    });

    return { status: "success" };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
      if (error.code === "P2002") {
        return {
          status: "error",
          message: "Unable to create an account with those details."
        };
      }

      if (error.code === "P1001" || error.code === "P2021" || error.code === "P2022") {
        return {
          status: "error",
          message: genericSignUpError
        };
      }
    }

    throw error;
  }
}

export async function signInWithGoogle() {
  "use server";

  await signIn("google", { redirectTo: "/dashboard" });
}

export async function signInWithFacebook() {
  "use server";

  await signIn("facebook", { redirectTo: "/dashboard" });
}

export async function signOutCurrentUser() {
  "use server";

  await signOut({ redirectTo: "/sign-in" });
}

export async function requestPasswordReset(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  "use server";

  const parsed = forgotPasswordSchema.safeParse({
    email: formValue(formData, "email")
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const rateLimitKey = getRateLimitKey("forgot-password", parsed.data.email);
  assertRateLimit({ key: rateLimitKey, limit: 3, windowMs: 60 * 60 * 1000 });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true }
  });

  if (!user) {
    return {
      status: "success",
      message: genericResetMessage
    };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: tokenHash(token),
        expiresAt
      }
    })
  ]);

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;

  return {
    status: "success",
    message: genericResetMessage,
    ...(process.env.NODE_ENV === "development" ? { resetUrl } : {})
  };
}

export async function resetPassword(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  "use server";

  const parsed = resetPasswordSchema.safeParse({
    token: formValue(formData, "token"),
    password: formValue(formData, "password"),
    confirmPassword: formValue(formData, "confirmPassword")
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const rateLimitKey = getRateLimitKey("reset-password", parsed.data.token.slice(0, 12));
  assertRateLimit({ key: rateLimitKey, limit: 5, windowMs: 60 * 60 * 1000 });

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: tokenHash(parsed.data.token) },
    include: { user: true }
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return {
      status: "error",
      message: "Reset link is invalid or expired."
    };
  }

  if (resetToken.user.passwordHash) {
    const samePassword = await verify(resetToken.user.passwordHash, parsed.data.password);

    if (samePassword) {
      return {
        status: "error",
        message: "Choose a password you have not used recently."
      };
    }
  }

  const passwordHash = await hash(parsed.data.password, {
    type: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash,
        passwordUpdatedAt: new Date()
      }
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() }
    }),
    prisma.session.deleteMany({
      where: { userId: resetToken.userId }
    })
  ]);

  return {
    status: "success",
    message: "Password updated. You can sign in now."
  };
}
