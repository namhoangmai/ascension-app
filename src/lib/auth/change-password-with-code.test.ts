/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { verify } from "argon2";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { Session } from "next-auth";

import { sendPasswordChangeCodeEmail } from "@/lib/services/email";

import { changePasswordWithCode, requestPasswordChangeCode } from "./server";
import { hashCodeWithPurpose } from "./code-hash";
import { codeMatches } from "./email-verification";
import {
  CODE_TTL_MINUTES,
  MAX_CODES_PER_HOUR,
  MAX_CODE_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
  issuePasswordChangeCode,
  passwordChangeCodeMatches
} from "./password-change-code";
import {
  MINUTE,
  advance,
  cheapHash,
  db,
  form,
  idle,
  seedUser,
  uniqueEmail,
  wrongCodeFor,
  registerServerTestLifecycle
} from "./server-kit.test.helpers";
import { auth, updateSession } from "./auth";
import type { Row } from "./fake-db.test.helpers";

vi.mock("@/lib/db/prisma", async () => {
  const { createFakeDb } = await import("./fake-db.test.helpers");
  return { prisma: createFakeDb() };
});
vi.mock("@/lib/services/email", () => ({
  sendVerificationCodeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendPasswordChangeCodeEmail: vi.fn(),
  sendWelcomeEmail: vi.fn()
}));
vi.mock("./auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  updateSession: vi.fn()
}));
vi.mock("next/navigation", () => ({
  // Mirrors real Next.js behavior: redirect() interrupts execution via a thrown "digest" error.
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` });
  })
}));
vi.mock("next/server", () => ({ after: vi.fn() }));
// getCurrentUser() builds the Cookie header for auth() from headers()/cookies(), which throw
// outside a real Next request scope (and that error is swallowed as "signed out").
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
  cookies: () => Promise.resolve({ getAll: () => [] })
}));

registerServerTestLifecycle();

// `auth` is overloaded (bare call / route-handler-wrapping call); pin the mock to the bare-call
// signature actually used here so `mockResolvedValue` accepts a `Session | null`.
const authMock = vi.mocked(auth) as unknown as Mock<() => Promise<Session | null>>;
const updateSessionMock = vi.mocked(updateSession);
const sendCodeMock = vi.mocked(sendPasswordChangeCodeEmail);

// registerServerTestLifecycle() only resets/defaults the email mocks it knows about
// (sendVerificationCodeEmail, sendPasswordResetEmail); sendPasswordChangeCodeEmail is local to
// this file and needs the same "delivery succeeds by default" default.
beforeEach(() => {
  sendCodeMock.mockReset();
  sendCodeMock.mockResolvedValue(true);
});

const OLD_PASSWORD = "OldPassword123";
const NEW_PASSWORD = "BrandNewPass42x";

const changeForm = (fields: Record<string, string> = {}) =>
  form({ code: "000000", newPassword: NEW_PASSWORD, confirmNewPassword: NEW_PASSWORD, ...fields });

const changeWithCode = (code: string, fields: Record<string, string> = {}) =>
  changePasswordWithCode(idle, changeForm({ code, ...fields }));

const lastCode = () => sendCodeMock.mock.calls.at(-1)?.[1] ?? "";

/** Seeds a user and points the mocked `auth()` session at it (matching passwordUpdatedAt so the
 * staleness check in getCurrentUser() accepts it — see change-password.test.ts for the same
 * pattern and rationale). */
async function seedAuthedUser(fields: Row = {}) {
  const email = uniqueEmail();
  const user = await seedUser({ email, emailVerified: new Date(), ...fields });

  authMock.mockResolvedValue({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      passwordUpdatedAt:
        user.passwordUpdatedAt instanceof Date ? user.passwordUpdatedAt.toISOString() : null
    }
  } as unknown as Session);

  return { email, user };
}

async function requestCode() {
  const result = await requestPasswordChangeCode();
  return { result, code: lastCode() };
}

describe("changePasswordWithCode", () => {
  it("correct code updates the password, bumps passwordUpdatedAt, revokes sessions, consumes the code, and refreshes this device's session", async () => {
    const { user } = await seedAuthedUser({ passwordHash: await cheapHash(OLD_PASSWORD) });
    await db.session.create({ data: { userId: user.id } });
    const { code } = await requestCode();
    advance(MINUTE);

    const result = await changeWithCode(code);

    expect(result).toEqual({ status: "success", message: "Password updated." });
    const stored = db.user.rows.find((u) => u.id === user.id);
    expect(await verify(stored?.passwordHash as string, NEW_PASSWORD)).toBe(true);
    expect(await verify(stored?.passwordHash as string, OLD_PASSWORD)).toBe(false);
    expect((stored?.passwordUpdatedAt as Date).getTime()).toBeGreaterThan(Date.now() - MINUTE);
    expect(db.session.rows).toHaveLength(0);
    expect(db.passwordChangeCode.rows[0]?.usedAt).not.toBeNull();
    expect(updateSessionMock).toHaveBeenCalledWith({
      user: { passwordUpdatedAt: (stored?.passwordUpdatedAt as Date).toISOString() }
    });
  });

  it("a successful change invalidates every other outstanding code for that user (and only that user)", async () => {
    const { user } = await seedAuthedUser({ passwordHash: await cheapHash(OLD_PASSWORD) });
    const other = await seedUser();
    const { code } = await requestCode();
    // Two codes can be outstanding at once if issuance requests race; only one is redeemed here.
    const outstanding = (userId: unknown) =>
      db.passwordChangeCode.create({
        data: {
          userId,
          salt: "s",
          codeHash: "h",
          createdAt: new Date(Date.now() - 1000),
          expiresAt: new Date(Date.now() + 10 * MINUTE)
        }
      });
    const sibling = await outstanding(user.id);
    const othersCode = await outstanding(other.id);

    expect((await changeWithCode(code)).status).toBe("success");

    const usedAt = (id: unknown) =>
      db.passwordChangeCode.rows.find((c) => c.id === id)?.usedAt as Date | null | undefined;
    expect(usedAt(sibling.id)).not.toBeNull();
    expect(usedAt(othersCode.id)).toBeNull();
  });

  it("a code that expires between the check and the redemption is not redeemed", async () => {
    const oldHash = await cheapHash(OLD_PASSWORD);
    await seedAuthedUser({ passwordHash: oldHash });
    const { code } = await requestCode();
    // The record is read as still valid; the clock then crosses its expiry while the (slow)
    // password hashing runs. The user lookup right after the code check is the hook for that.
    const realFindUnique = db.user.findUnique.bind(db.user);
    let lookups = 0;
    vi.spyOn(db.user, "findUnique").mockImplementation((args) => {
      if (++lookups === 2) advance(CODE_TTL_MINUTES * MINUTE + 1);
      return realFindUnique(args);
    });

    const result = await changeWithCode(code);

    expect(result).toEqual({ status: "error", message: "That code is invalid or has expired." });
    expect(db.user.rows[0]?.passwordHash).toBe(oldHash);
  });

  it("a Google-only account (no existing password) can set one via a valid code", async () => {
    const { user } = await seedAuthedUser({ passwordHash: null });
    const { code } = await requestCode();

    const result = await changeWithCode(code);

    expect(result).toEqual({
      status: "success",
      message: "Password set. You can now sign in with your username or email and this password."
    });
    const stored = db.user.rows.find((u) => u.id === user.id);
    expect(await verify(stored?.passwordHash as string, NEW_PASSWORD)).toBe(true);
  });

  it("wrong code is rejected and counts as an attempt, leaving the password untouched", async () => {
    const oldHash = await cheapHash(OLD_PASSWORD);
    const { user } = await seedAuthedUser({ passwordHash: oldHash });
    const { code } = await requestCode();

    const result = await changeWithCode(wrongCodeFor(code));

    expect(result).toEqual({ status: "error", message: "That code is invalid or has expired." });
    expect(db.passwordChangeCode.rows[0]?.attempts).toBe(1);
    expect(db.user.rows.find((u) => u.id === user.id)?.passwordHash).toBe(oldHash);
  });

  it(`locks the code after ${String(MAX_CODE_ATTEMPTS)} wrong attempts, even to the correct code afterward`, async () => {
    const oldHash = await cheapHash(OLD_PASSWORD);
    await seedAuthedUser({ passwordHash: oldHash });
    const { code } = await requestCode();
    const wrong = wrongCodeFor(code);
    let last;

    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
      last = await changeWithCode(wrong);
    }

    expect(last).toEqual({ status: "error", message: "That code is invalid or has expired." });
    expect(db.passwordChangeCode.rows[0]?.attempts).toBe(MAX_CODE_ATTEMPTS);
    expect(db.passwordChangeCode.rows[0]?.usedAt).not.toBeNull();
    expect(db.user.rows[0]?.passwordHash).toBe(oldHash);
  });

  it("rejects an expired code", async () => {
    const oldHash = await cheapHash(OLD_PASSWORD);
    await seedAuthedUser({ passwordHash: oldHash });
    const { code } = await requestCode();
    advance(CODE_TTL_MINUTES * MINUTE + 1);

    const result = await changeWithCode(code);

    expect(result).toEqual({ status: "error", message: "That code is invalid or has expired." });
    expect(db.user.rows[0]?.passwordHash).toBe(oldHash);
  });

  it("rejects reusing the current password as the new one, without consuming the code", async () => {
    const oldHash = await cheapHash(OLD_PASSWORD);
    await seedAuthedUser({ passwordHash: oldHash });
    const { code } = await requestCode();

    const result = await changeWithCode(code, {
      newPassword: OLD_PASSWORD,
      confirmNewPassword: OLD_PASSWORD
    });

    expect(result).toEqual({
      status: "error",
      message: "Choose a password you have not used recently."
    });
    expect(db.passwordChangeCode.rows[0]?.usedAt).toBeNull();
    expect(db.user.rows[0]?.passwordHash).toBe(oldHash);

    // The code was not burned by that rejection, so it can still be redeemed with a real new one.
    expect((await changeWithCode(code)).status).toBe("success");
  });

  it("a code issued to one user does not verify against a different user's request", async () => {
    const hashA = await cheapHash(OLD_PASSWORD);
    const { user: userA } = await seedAuthedUser({ passwordHash: hashA });
    const { code: codeForA } = await requestCode();

    const hashB = await cheapHash("OtherPass123");
    const { user: userB } = await seedAuthedUser({ passwordHash: hashB });

    const result = await changeWithCode(codeForA);

    expect(result).toEqual({ status: "error", message: "That code is invalid or has expired." });
    expect(db.user.rows.find((u) => u.id === userB.id)?.passwordHash).toBe(hashB);
    expect(db.user.rows.find((u) => u.id === userA.id)?.passwordHash).toBe(hashA);
  });

  it("binds a code to its user at the crypto level (code for a different account id does not match)", async () => {
    const user = await db.user.create({ data: { email: uniqueEmail() } });
    await issuePasswordChangeCode({ id: user.id as string, email: user.email as string });
    const [row] = db.passwordChangeCode.rows;
    const code = lastCode();
    const salt = row?.salt as string;
    const codeHash = row?.codeHash as string;

    expect(passwordChangeCodeMatches(code, salt, user.id as string, codeHash)).toBe(true);
    expect(passwordChangeCodeMatches(code, salt, "someone-else", codeHash)).toBe(false);
  });

  it("an email-verification code hash does not verify as a password-change code, even for the same code/salt/user (purpose-tagged HMAC)", () => {
    const emailVerifyHash = hashCodeWithPurpose("123456", "shared-salt", "user-1", "email-verify");

    expect(codeMatches("123456", "shared-salt", "user-1", emailVerifyHash)).toBe(true);
    expect(passwordChangeCodeMatches("123456", "shared-salt", "user-1", emailVerifyHash)).toBe(
      false
    );
  });

  it("redirects to sign-in when there is no session", async () => {
    authMock.mockResolvedValue(null);

    await expect(changeWithCode("123456")).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("requestPasswordChangeCode", () => {
  it("redirects to sign-in when there is no session", async () => {
    authMock.mockResolvedValue(null);

    await expect(requestPasswordChangeCode()).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("issuePasswordChangeCode", () => {
  it("emails a 6-digit numeric code with the documented TTL", async () => {
    const u = await db.user.create({ data: { email: uniqueEmail() } });

    expect(await issuePasswordChangeCode({ id: u.id, email: u.email as string })).toBe("sent");
    const code = lastCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(sendCodeMock).toHaveBeenCalledWith(u.email, code, CODE_TTL_MINUTES);
  });

  it("stores only a hash of the code (never the plaintext)", async () => {
    const u = await db.user.create({ data: { email: uniqueEmail() } });
    await issuePasswordChangeCode({ id: u.id, email: u.email as string });
    const [row] = db.passwordChangeCode.rows;
    const code = lastCode();

    expect(row?.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(`"${code}"`);
  });

  it("enforces the 60s resend cooldown without sending a new code", async () => {
    const u = await db.user.create({ data: { email: uniqueEmail() } });
    expect(await issuePasswordChangeCode({ id: u.id, email: u.email as string })).toBe("sent");

    advance(RESEND_COOLDOWN_SECONDS * 1000 - 1);
    expect(await issuePasswordChangeCode({ id: u.id, email: u.email as string })).toBe("cooldown");
    expect(sendCodeMock).toHaveBeenCalledTimes(1);
    expect(db.passwordChangeCode.rows).toHaveLength(1);
  });

  it("allows a resend once the cooldown has elapsed", async () => {
    const u = await db.user.create({ data: { email: uniqueEmail() } });
    await issuePasswordChangeCode({ id: u.id, email: u.email as string });
    advance(RESEND_COOLDOWN_SECONDS * 1000);

    expect(await issuePasswordChangeCode({ id: u.id, email: u.email as string })).toBe("sent");
    expect(sendCodeMock).toHaveBeenCalledTimes(2);
  });

  it(`caps codes at ${String(MAX_CODES_PER_HOUR)} per rolling hour`, async () => {
    const u = await db.user.create({ data: { email: uniqueEmail() } });

    for (let i = 0; i < MAX_CODES_PER_HOUR; i++) {
      expect(await issuePasswordChangeCode({ id: u.id, email: u.email as string })).toBe("sent");
      advance(RESEND_COOLDOWN_SECONDS * 1000);
    }

    expect(await issuePasswordChangeCode({ id: u.id, email: u.email as string })).toBe("capped");
    expect(sendCodeMock).toHaveBeenCalledTimes(MAX_CODES_PER_HOUR);
  });

  it("frees the hourly cap once the oldest codes age out", async () => {
    const u = await db.user.create({ data: { email: uniqueEmail() } });

    for (let i = 0; i < MAX_CODES_PER_HOUR; i++) {
      await issuePasswordChangeCode({ id: u.id, email: u.email as string });
      advance(RESEND_COOLDOWN_SECONDS * 1000);
    }
    advance(60 * 60 * 1000);

    expect(await issuePasswordChangeCode({ id: u.id, email: u.email as string })).toBe("sent");
  });

  it("does not share cooldown or cap between users", async () => {
    const a = await db.user.create({ data: { email: uniqueEmail() } });
    await issuePasswordChangeCode({ id: a.id, email: a.email as string });
    const b = await db.user.create({ data: { email: uniqueEmail() } });

    expect(await issuePasswordChangeCode({ id: b.id, email: b.email as string })).toBe("sent");
  });
});
