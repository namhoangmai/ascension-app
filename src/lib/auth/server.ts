import { hash, verify } from "argon2";
import { AuthError } from "next-auth";
import type { Session } from "next-auth";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { randomBytes, createHash } from "node:crypto";

import { prisma } from "@/lib/db/prisma";

import { issueVerificationCode, codeMatches, MAX_CODE_ATTEMPTS } from "./email-verification";
import {
  issuePasswordChangeCode,
  passwordChangeCodeMatches,
  MAX_CODE_ATTEMPTS as MAX_PASSWORD_CHANGE_CODE_ATTEMPTS
} from "./password-change-code";
import { sendPasswordResetEmail } from "@/lib/services/email";

import { auth, signIn, signOut, updateSession } from "./auth";
import { findUserByIdentifier } from "./identifier";
import { assertRateLimit, clearRateLimit, getRateLimitKey, RateLimitError } from "./rate-limit";
import { toSessionUser, type SessionUser } from "./session";
import {
  changePasswordSchema,
  changePasswordWithCodeSchema,
  forgotPasswordSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  verifyEmailSchema
} from "./validation";

export interface AuthActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  resetUrl?: string | undefined;
  /** When "verify-email", the UI must show the 6-digit code step for `email`. */
  step?: "verify-email";
  /** Normalized (lowercased) email the code step applies to. */
  email?: string;
  /** True only from a successful verifyEmailCode. */
  verified?: boolean;
  /** Seconds the UI should wait before enabling "resend". */
  cooldownSeconds?: number;
}

const RESEND_COOLDOWN_SECONDS = 60;

const genericSignInError = "Invalid email/username or password.";
const genericResetMessage = "If that email exists, a reset link will be sent.";
const genericSignUpError = "Unable to create an account right now. Try again in a moment.";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const rateLimitedState = {
  status: "error",
  message: "Too many attempts. Please wait and try again."
} satisfies AuthActionState;

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

function verifyStep(
  email: string,
  message: string,
  status: AuthActionState["status"] = "success"
): AuthActionState {
  return {
    status,
    step: "verify-email",
    email,
    message,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS
  };
}

/** `auth`'s `(req, res)` overload, which is typed for Pages Router objects but only reads `headers`. */
type AuthFromHeaders = (
  req: { headers: Headers },
  res: { headers: Headers }
) => Promise<Session | null>;

/**
 * Reads the session from the *freshest* cookie, not the incoming Cookie header.
 *
 * `auth()` reads `headers().get("cookie")`, i.e. what the browser sent. A Server Action that
 * rotates the session cookie (`refreshPasswordSession`) makes Next.js re-render the current page
 * in the same request; `cookies()` sees the rotated cookie there (Next syncs it), but `headers()`
 * still holds the OLD one (a TODO in Next's `synchronizeMutableCookies`). Reading the old JWT
 * failed the `passwordUpdatedAt` check below and bounced the device that just changed its
 * password to /sign-in. Feeding `cookies()` to `auth()` fixes that without loosening the check.
 */
async function readSession(): Promise<Session | null> {
  const requestHeaders = new Headers(await headers());
  const cookieStore = await cookies();

  requestHeaders.set(
    "cookie",
    cookieStore
      .getAll()
      .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
      .join("; ")
  );

  // The (discarded) response headers only receive Set-Cookie refreshes, which a render can't send.
  return (auth as unknown as AuthFromHeaders)(
    { headers: requestHeaders },
    { headers: new Headers() }
  );
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  let session: Session | null;

  try {
    session = await readSession();
  } catch {
    return null;
  }

  if (!session?.user.id) {
    return null;
  }

  // Staleness check: a password change stamps a fresh `passwordUpdatedAt` on the User row. Any
  // JWT minted before that (i.e. every device except the one that made the change, which gets
  // its token refreshed via `updateSession()` right after the change) will not match and is
  // treated as signed out. This is the actual "sign out other devices" mechanism — the
  // `prisma.session.deleteMany` calls elsewhere in this file are no-ops under JWT sessions.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordUpdatedAt: true }
  });

  if (!dbUser) {
    return null;
  }

  const dbPasswordUpdatedAt = dbUser.passwordUpdatedAt
    ? dbUser.passwordUpdatedAt.toISOString()
    : null;

  if (dbPasswordUpdatedAt !== session.user.passwordUpdatedAt) {
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
  const parsed = signInSchema.safeParse({
    identifier: formValue(formData, "identifier"),
    password: formValue(formData, "password"),
    remember: formData.get("remember") === "on"
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  try {
    await signIn("credentials", {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      remember: parsed.data.remember ? "true" : "false",
      redirectTo: "/profile/setup"
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Only thrown after the password was verified, so this does not enumerate accounts.
      if ("code" in error && error.code === "email_not_verified") {
        // A user who isn't verified can't have finished /profile/setup, so in practice this
        // resolves by email only — but resolve generically rather than assuming.
        const user = await findUserByIdentifier(parsed.data.identifier);

        if (user) {
          await issueVerificationCode(user);
        }

        return verifyStep(
          user?.email ?? parsed.data.identifier,
          "Verify your email to continue. We sent a 6-digit code.",
          "error"
        );
      }

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
  try {
    assertRateLimit({ key: rateLimitKey, limit: 3, windowMs: 60 * 60 * 1000 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return rateLimitedState;
    }

    throw error;
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, emailVerified: true, passwordHash: true }
    });

    // A verified account, or one owned via OAuth (no password), is never touched.
    if (existingUser && (existingUser.emailVerified || !existingUser.passwordHash)) {
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

    // An unverified pending sign-up for this email is replaced (name/password), so nobody can
    // squat an address they cannot verify. Only the mailbox owner can finish with the code.
    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: { name: parsed.data.name, passwordHash, passwordUpdatedAt: new Date() },
          select: { id: true, email: true }
        })
      : await prisma.user.create({
          data: {
            name: parsed.data.name,
            email: parsed.data.email,
            emailVerified: null,
            passwordHash,
            passwordUpdatedAt: new Date(),
            preferences: {
              create: {}
            }
          },
          select: { id: true, email: true }
        });

    const result = await issueVerificationCode(user);

    if (result === "send_failed") {
      return {
        status: "error",
        message: "We could not send the verification email. Please try again in a minute."
      };
    }

    return verifyStep(user.email, "We sent a 6-digit code to your email.");
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
  await signIn("google", { redirectTo: "/profile/setup" });
}

export async function signOutCurrentUser() {
  await signOut({ redirectTo: "/" });
}

export async function requestPasswordReset(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formValue(formData, "email")
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const rateLimitKey = getRateLimitKey("forgot-password", parsed.data.email);
  try {
    assertRateLimit({ key: rateLimitKey, limit: 3, windowMs: 60 * 60 * 1000 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      // Same message as the success path so rate limiting does not reveal account existence.
      return { status: "success", message: genericResetMessage };
    }

    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true }
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

  // Deferred so response time does not reveal whether the account exists.
  after(async () => {
    await sendPasswordResetEmail(user.email, resetUrl, 30);
  });

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
  const parsed = resetPasswordSchema.safeParse({
    token: formValue(formData, "token"),
    password: formValue(formData, "password"),
    confirmPassword: formValue(formData, "confirmPassword")
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const rateLimitKey = getRateLimitKey("reset-password", parsed.data.token.slice(0, 12));
  try {
    assertRateLimit({ key: rateLimitKey, limit: 5, windowMs: 60 * 60 * 1000 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return rateLimitedState;
    }

    throw error;
  }

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

  // Consume the token atomically so two concurrent requests cannot both redeem it.
  const redeemed = await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: resetToken.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() }
    });

    if (consumed.count !== 1) {
      return false;
    }

    await tx.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash,
        passwordUpdatedAt: new Date()
      }
    });
    // Following an emailed link proves mailbox ownership.
    await tx.user.updateMany({
      where: { id: resetToken.userId, emailVerified: null },
      data: { emailVerified: new Date() }
    });
    await tx.session.deleteMany({
      where: { userId: resetToken.userId }
    });
    // The password just changed: an emailed password-change code issued before it must not outlive it.
    await tx.passwordChangeCode.updateMany({
      where: { userId: resetToken.userId, usedAt: null },
      data: { usedAt: new Date() }
    });

    return true;
  });

  if (!redeemed) {
    return {
      status: "error",
      message: "Reset link is invalid or expired."
    };
  }

  return {
    status: "success",
    message: "Password updated. You can sign in now."
  };
}

/**
 * Refreshes the *current request's* session cookie right after a password change, so the device
 * that made the change is not also logged out by the `passwordUpdatedAt` staleness check in
 * `getCurrentUser()`. Every other device's JWT still predates the DB value and fails that check
 * on its next request — that is the actual "sign out other devices" mechanism now.
 */
async function refreshPasswordSession(passwordUpdatedAt: Date) {
  await updateSession({ user: { passwordUpdatedAt: passwordUpdatedAt.toISOString() } });
}

export async function changePassword(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const user = await requireUser();

  try {
    assertRateLimit({
      key: getRateLimitKey("change-password", user.id),
      limit: 5,
      windowMs: 15 * 60 * 1000
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return rateLimitedState;
    }

    throw error;
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formValue(formData, "currentPassword") || undefined,
    newPassword: formValue(formData, "newPassword"),
    confirmNewPassword: formValue(formData, "confirmNewPassword")
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true }
  });

  // Setting a *first* password (no existing hash, e.g. a Google-only account) must go through
  // `changePasswordWithCode` instead — proving control of the mailbox, since there is no current
  // password to check here.
  if (!dbUser?.passwordHash) {
    return {
      status: "error",
      message: 'Use "Email me a code" to set your first password.'
    };
  }

  if (!parsed.data.currentPassword) {
    return validationError(
      { currentPassword: ["Enter your current password."] },
      "Check the form and try again."
    );
  }

  const isCurrentPasswordValid = await verify(dbUser.passwordHash, parsed.data.currentPassword);

  if (!isCurrentPasswordValid) {
    return validationError(
      { currentPassword: ["Current password is incorrect."] },
      "Check the form and try again."
    );
  }

  const samePassword = await verify(dbUser.passwordHash, parsed.data.newPassword);

  if (samePassword) {
    return {
      status: "error",
      message: "Choose a password you have not used recently."
    };
  }

  const passwordHash = await hash(parsed.data.newPassword, {
    type: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });

  const passwordUpdatedAt = new Date();

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordUpdatedAt }
  });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  // The password just changed: an emailed password-change code issued before it must not outlive it.
  await prisma.passwordChangeCode.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() }
  });
  await refreshPasswordSession(passwordUpdatedAt);

  return {
    status: "success",
    message: "Password updated."
  };
}

const genericPasswordChangeCodeError = {
  status: "error",
  message: "That code is invalid or has expired."
} satisfies AuthActionState;

export async function requestPasswordChangeCode(): Promise<AuthActionState> {
  const user = await requireUser();

  try {
    assertRateLimit({
      key: getRateLimitKey("password-change-code", user.id),
      limit: 5,
      windowMs: 60 * 60 * 1000
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return rateLimitedState;
    }

    throw error;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true }
  });

  if (!dbUser) {
    return {
      status: "error",
      message: "Unable to send a code right now. Try again in a moment."
    };
  }

  // Always the signed-in user's own current email — never a value from the form, so this cannot
  // be used to email a code to an address the user doesn't control.
  const result = await issuePasswordChangeCode({ id: user.id, email: dbUser.email });

  if (result === "send_failed") {
    return {
      status: "error",
      message: "We could not send the code. Please try again in a minute."
    };
  }

  if (result === "cooldown") {
    return {
      status: "error",
      message: "Please wait before requesting another code.",
      email: dbUser.email,
      cooldownSeconds: RESEND_COOLDOWN_SECONDS
    };
  }

  if (result === "capped") {
    return {
      status: "error",
      message: "Too many codes requested. Please wait before trying again.",
      email: dbUser.email
    };
  }

  return {
    status: "success",
    message: "We sent a 6-digit code to your email.",
    email: dbUser.email,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS
  };
}

export async function changePasswordWithCode(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const user = await requireUser();

  try {
    assertRateLimit({
      key: getRateLimitKey("change-password-with-code", user.id),
      limit: 5,
      windowMs: 15 * 60 * 1000
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return rateLimitedState;
    }

    throw error;
  }

  const parsed = changePasswordWithCodeSchema.safeParse({
    code: formValue(formData, "code"),
    newPassword: formValue(formData, "newPassword"),
    confirmNewPassword: formValue(formData, "confirmNewPassword")
  });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  const record = await prisma.passwordChangeCode.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" }
  });

  if (!record) {
    return genericPasswordChangeCodeError;
  }

  // Count the attempt atomically before comparing, so parallel guesses cannot exceed the cap.
  const counted = await prisma.passwordChangeCode.updateMany({
    where: { id: record.id, usedAt: null, attempts: { lt: MAX_PASSWORD_CHANGE_CODE_ATTEMPTS } },
    data: { attempts: { increment: 1 } }
  });

  if (counted.count !== 1) {
    return genericPasswordChangeCodeError;
  }

  if (!passwordChangeCodeMatches(parsed.data.code, record.salt, user.id, record.codeHash)) {
    if (record.attempts + 1 >= MAX_PASSWORD_CHANGE_CODE_ATTEMPTS) {
      await prisma.passwordChangeCode.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() }
      });
    }

    return genericPasswordChangeCodeError;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true }
  });

  if (dbUser?.passwordHash) {
    const samePassword = await verify(dbUser.passwordHash, parsed.data.newPassword);

    if (samePassword) {
      return {
        status: "error",
        message: "Choose a password you have not used recently."
      };
    }
  }

  const passwordHash = await hash(parsed.data.newPassword, {
    type: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
  });
  const passwordUpdatedAt = new Date();

  // Consume the code atomically so two concurrent requests cannot both redeem it.
  const changed = await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordChangeCode.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() }
    });

    if (consumed.count !== 1) {
      return false;
    }

    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordUpdatedAt }
    });
    // The password just changed: no other outstanding code may outlive it.
    await tx.passwordChangeCode.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    });

    return true;
  });

  if (!changed) {
    return genericPasswordChangeCodeError;
  }

  await prisma.session.deleteMany({ where: { userId: user.id } });
  await refreshPasswordSession(passwordUpdatedAt);

  return {
    status: "success",
    message: dbUser?.passwordHash
      ? "Password updated."
      : "Password set. You can now sign in with your username or email and this password."
  };
}

export async function getAccountDetails(): Promise<{
  email: string;
  username: string | null;
  dateOfBirth: string | null;
}> {
  const user = await requireUser();

  const [dbUser, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true }
    }),
    prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { username: true, dateOfBirth: true }
    })
  ]);

  return {
    email: dbUser?.email ?? user.email,
    username: profile?.username ?? null,
    dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.toISOString() : null
  };
}

export async function getPasswordStatus(): Promise<{ hasPassword: boolean }> {
  const user = await requireUser();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true }
  });

  return { hasPassword: Boolean(dbUser?.passwordHash) };
}

const genericCodeError = "That code is invalid or has expired.";
const genericResendMessage = "If that account needs verification, a new code will be sent.";

export async function verifyEmailCode(email: string, code: string): Promise<AuthActionState> {
  const parsed = verifyEmailSchema.safeParse({ email, code });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  try {
    assertRateLimit({
      key: getRateLimitKey("verify-email", parsed.data.email),
      limit: 10,
      windowMs: 15 * 60 * 1000
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return rateLimitedState;
    }

    throw error;
  }

  const failure = { status: "error", message: genericCodeError } satisfies AuthActionState;
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, emailVerified: true }
  });

  if (!user || user.emailVerified) {
    return failure;
  }

  const record = await prisma.emailVerificationCode.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" }
  });

  if (!record) {
    return failure;
  }

  // Count the attempt atomically before comparing, so parallel guesses cannot exceed the cap.
  const counted = await prisma.emailVerificationCode.updateMany({
    where: { id: record.id, usedAt: null, attempts: { lt: MAX_CODE_ATTEMPTS } },
    data: { attempts: { increment: 1 } }
  });

  if (counted.count !== 1) {
    return failure;
  }

  if (!codeMatches(parsed.data.code, record.salt, user.id, record.codeHash)) {
    if (record.attempts + 1 >= MAX_CODE_ATTEMPTS) {
      await prisma.emailVerificationCode.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() }
      });
    }

    return failure;
  }

  const verified = await prisma.$transaction(async (tx) => {
    const consumed = await tx.emailVerificationCode.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() }
    });

    if (consumed.count !== 1) {
      return false;
    }

    await tx.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
    await tx.emailVerificationCode.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    });

    return true;
  });

  if (!verified) {
    return failure;
  }

  clearRateLimit(getRateLimitKey("verify-email", parsed.data.email));

  return {
    status: "success",
    verified: true,
    email: parsed.data.email,
    message: "Email verified. You can sign in now."
  };
}

export async function resendVerificationCode(email: string): Promise<AuthActionState> {
  const parsed = resendVerificationSchema.safeParse({ email });

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors);
  }

  // Same response for every outcome (unknown, verified, cooldown, capped, rate limited).
  const generic = {
    status: "success",
    step: "verify-email",
    email: parsed.data.email,
    message: genericResendMessage,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS
  } satisfies AuthActionState;

  try {
    assertRateLimit({
      key: getRateLimitKey("resend-verification", parsed.data.email),
      limit: 10,
      windowMs: 60 * 60 * 1000
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return generic;
    }

    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, emailVerified: true, passwordHash: true }
  });

  if (!user || user.emailVerified || !user.passwordHash) {
    return generic;
  }

  // Deferred so response time does not reveal whether the account exists.
  after(async () => {
    await issueVerificationCode({ id: user.id, email: user.email });
  });

  return generic;
}

export async function verifyEmailCodeFromForm(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  return verifyEmailCode(formValue(formData, "email"), formValue(formData, "code"));
}

export async function resendVerificationCodeFromForm(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  return resendVerificationCode(formValue(formData, "email"));
}
