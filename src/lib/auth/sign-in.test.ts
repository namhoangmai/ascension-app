/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-type-assertion */
import { AuthError, CredentialsSignin } from "next-auth";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { signIn } from "./auth";
import { getAuthProviders } from "./providers";
import { signInWithPassword, verifyEmailCode } from "./server";
import {
  GOOD_PASSWORD,
  MINUTE,
  advance,
  cheapHash,
  db,
  form,
  idle,
  lastCode,
  seedUser,
  sendCode,
  signInMock,
  uniqueEmail,
  registerServerTestLifecycle
} from "./server-kit.test.helpers";

vi.mock("@/lib/db/prisma", async () => {
  const { createFakeDb } = await import("./fake-db.test.helpers");
  return { prisma: createFakeDb() };
});
vi.mock("@/lib/services/email", () => ({
  sendVerificationCodeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn()
}));
vi.mock("./auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));

registerServerTestLifecycle();

/**
 * `signIn` from Auth.js is replaced by a shim that runs the REAL credentials `authorize` and
 * mirrors Auth.js error mapping (null -> CredentialsSignin, other thrown errors -> AuthError,
 * success -> NEXT_REDIRECT), so the server action and the provider are tested together.
 */
const credentialsProvider = getAuthProviders().find(
  (provider) => (provider as { id?: string }).id === "credentials"
) as unknown as {
  options: { authorize: (credentials: Record<string, unknown>) => Promise<unknown> };
};

let authorizeResult: unknown;

beforeEach(() => {
  authorizeResult = undefined;
  signInMock.mockImplementation((async (_provider: string, options: Record<string, unknown>) => {
    try {
      authorizeResult = await credentialsProvider.options.authorize(options);
    } catch (error) {
      if (error instanceof CredentialsSignin) throw error;
      throw new AuthError("CallbackRouteError", { cause: error });
    }
    if (!authorizeResult) throw new CredentialsSignin();
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;/profile/setup" });
  }) as unknown as typeof signIn);
});

const signInAs = (email: string, password: string, extra: Record<string, string | boolean> = {}) =>
  signInWithPassword(idle, form({ email, password, ...extra }));

const GENERIC_SIGN_IN = { status: "error", message: "Invalid email or password." };

async function seedPasswordUser(verified: boolean, password = GOOD_PASSWORD) {
  const email = uniqueEmail();
  const user = await seedUser({
    email,
    emailVerified: verified ? new Date() : null,
    passwordHash: await cheapHash(password),
    passwordUpdatedAt: new Date()
  });
  return { email, user };
}

describe("sign-in with password", () => {
  it("correct password + verified email authenticates (redirects to /profile/setup)", async () => {
    const { email, user } = await seedPasswordUser(true);

    await expect(signInAs(email, GOOD_PASSWORD)).rejects.toThrow("NEXT_REDIRECT");

    expect(signInMock).toHaveBeenCalledWith("credentials", {
      email,
      password: GOOD_PASSWORD,
      remember: "false",
      redirectTo: "/profile/setup"
    });
    expect(authorizeResult).toMatchObject({ id: user.id, email });
    expect(authorizeResult).not.toHaveProperty("passwordHash");
    expect(sendCode).not.toHaveBeenCalled();
  });

  it("passes remember=true when the box is ticked", async () => {
    const { email } = await seedPasswordUser(true);
    await expect(signInAs(email, GOOD_PASSWORD, { remember: true })).rejects.toThrow();
    expect(signInMock.mock.calls[0]?.[1]).toMatchObject({ remember: "true" });
  });

  it("is case-insensitive on the email", async () => {
    const { email } = await seedPasswordUser(true);
    await expect(signInAs(email.toUpperCase(), GOOD_PASSWORD)).rejects.toThrow("NEXT_REDIRECT");
  });

  it("returns success if the auth layer resolves without redirecting", async () => {
    signInMock.mockReset();
    signInMock.mockResolvedValueOnce(undefined as never);
    expect(await signInAs("a@example.com", "x")).toEqual({ status: "success" });
  });

  it("wrong password gives the generic error and issues no code", async () => {
    const { email } = await seedPasswordUser(true);

    expect(await signInAs(email, "WrongPassword123")).toEqual(GENERIC_SIGN_IN);
    expect(sendCode).not.toHaveBeenCalled();
  });

  it("unknown email gives the same generic error as a wrong password", async () => {
    const { email } = await seedPasswordUser(true);
    const wrong = await signInAs(email, "WrongPassword123");
    const unknown = await signInAs(uniqueEmail(), GOOD_PASSWORD);

    expect(unknown).toEqual(wrong);
    expect(unknown).toEqual(GENERIC_SIGN_IN);
    expect(unknown.step).toBeUndefined();
  });

  it("Google-only account (no password) gets the generic error", async () => {
    const email = uniqueEmail();
    await seedUser({ email, emailVerified: new Date(), passwordHash: null });

    expect(await signInAs(email, GOOD_PASSWORD)).toEqual(GENERIC_SIGN_IN);
  });

  it("correct password + unverified email: issues a code, returns the verify step, does not sign in", async () => {
    const { email } = await seedPasswordUser(false);

    const result = await signInAs(email, GOOD_PASSWORD);

    expect(result).toMatchObject({
      status: "error",
      step: "verify-email",
      email,
      cooldownSeconds: 60
    });
    expect(result.verified).toBeUndefined();
    expect(authorizeResult).toBeUndefined();
    expect(sendCode).toHaveBeenCalledTimes(1);
    expect(sendCode.mock.calls[0]?.[0]).toBe(email);
    expect(db.emailVerificationCode.rows).toHaveLength(1);
  });

  it("the emailed code then verifies the account, after which sign-in works", async () => {
    const { email } = await seedPasswordUser(false);
    await signInAs(email, GOOD_PASSWORD);

    expect((await verifyEmailCode(email, lastCode())).verified).toBe(true);
    await expect(signInAs(email, GOOD_PASSWORD)).rejects.toThrow("NEXT_REDIRECT");
  });

  it("unverified + correct password twice inside the cooldown re-shows the step without a second email", async () => {
    const { email } = await seedPasswordUser(false);
    await signInAs(email, GOOD_PASSWORD);

    const again = await signInAs(email, GOOD_PASSWORD);

    expect(again.step).toBe("verify-email");
    expect(sendCode).toHaveBeenCalledTimes(1);
  });

  it("unverified + WRONG password does not reveal the account (generic error, no code)", async () => {
    const { email } = await seedPasswordUser(false);

    expect(await signInAs(email, "WrongPassword123")).toEqual(GENERIC_SIGN_IN);
    expect(sendCode).not.toHaveBeenCalled();
  });

  it("locks out after 5 attempts in 15 minutes, even for the correct password", async () => {
    const { email } = await seedPasswordUser(true);
    for (let i = 0; i < 5; i++) {
      expect(await signInAs(email, "WrongPassword123")).toEqual(GENERIC_SIGN_IN);
    }

    authorizeResult = undefined;
    expect(await signInAs(email, GOOD_PASSWORD)).toEqual(GENERIC_SIGN_IN);
    expect(authorizeResult).toBeUndefined();
  });

  it("lock-out lifts after 15 minutes", async () => {
    const { email } = await seedPasswordUser(true);
    for (let i = 0; i < 6; i++) await signInAs(email, "WrongPassword123");
    advance(15 * MINUTE + 1);

    await expect(signInAs(email, GOOD_PASSWORD)).rejects.toThrow("NEXT_REDIRECT");
  });

  it("a successful sign-in resets the attempt counter", async () => {
    const { email } = await seedPasswordUser(true);
    for (let i = 0; i < 4; i++) await signInAs(email, "WrongPassword123");
    await expect(signInAs(email, GOOD_PASSWORD)).rejects.toThrow("NEXT_REDIRECT");
    for (let i = 0; i < 4; i++) await signInAs(email, "WrongPassword123");

    await expect(signInAs(email, GOOD_PASSWORD)).rejects.toThrow("NEXT_REDIRECT");
  });

  it("lock-out is per email", async () => {
    const a = await seedPasswordUser(true);
    const b = await seedPasswordUser(true);
    for (let i = 0; i < 6; i++) await signInAs(a.email, "WrongPassword123");

    await expect(signInAs(b.email, GOOD_PASSWORD)).rejects.toThrow("NEXT_REDIRECT");
  });

  it("rejects empty fields with field errors and never calls the auth layer", async () => {
    const noEmail = await signInAs("", GOOD_PASSWORD);
    const noPassword = await signInAs("a@example.com", "");
    const neither = await signInWithPassword(idle, new FormData());

    expect(noEmail.fieldErrors?.email).toBeDefined();
    expect(noPassword.fieldErrors?.password).toEqual(["Enter your password."]);
    expect(neither.fieldErrors?.email).toBeDefined();
    expect(neither.fieldErrors?.password).toBeDefined();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed email before hitting the auth layer", async () => {
    const result = await signInAs("not-an-email", GOOD_PASSWORD);
    expect(result.fieldErrors?.email).toEqual(["Enter a valid email address."]);
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("does not enforce the password policy on sign-in (legacy/short passwords may log in)", async () => {
    const { email } = await seedPasswordUser(true, "short");
    await expect(signInAs(email, "short")).rejects.toThrow("NEXT_REDIRECT");
  });

  it("rethrows non-auth errors such as NEXT_REDIRECT or database failures", async () => {
    signInMock.mockReset();
    signInMock.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(signInAs("a@example.com", "x")).rejects.toThrow("NEXT_REDIRECT");
  });
});
