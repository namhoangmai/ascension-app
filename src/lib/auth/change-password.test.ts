/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { verify } from "argon2";
import { describe, expect, it, vi, type Mock } from "vitest";

import type { Session } from "next-auth";

import { changePassword } from "./server";
import {
  MINUTE,
  advance,
  cheapHash,
  db,
  form,
  idle,
  seedUser,
  uniqueEmail,
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

const OLD_PASSWORD = "OldPassword123";
const NEW_PASSWORD = "BrandNewPass42x";

const changeForm = (fields: Record<string, string> = {}) =>
  form({ newPassword: NEW_PASSWORD, confirmNewPassword: NEW_PASSWORD, ...fields });

/**
 * Seeds a user and points the mocked `auth()` session at it. The session's `passwordUpdatedAt`
 * is stamped to match the seeded row so `getCurrentUser()`'s staleness check (compares the
 * session token's value against the DB's) accepts it — otherwise every call would look like a
 * session predating a password change and `requireUser()` would redirect before the test's
 * logic under test ever runs.
 */
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

describe("change password", () => {
  it("correct currentPassword + valid newPassword succeeds, rotates the hash and revokes sessions", async () => {
    const { user } = await seedAuthedUser({ passwordHash: await cheapHash(OLD_PASSWORD) });
    await db.session.create({ data: { userId: user.id } });
    advance(MINUTE);

    const result = await changePassword(idle, changeForm({ currentPassword: OLD_PASSWORD }));

    expect(result).toEqual({ status: "success", message: "Password updated." });
    const stored = db.user.rows.find((u) => u.id === user.id);
    expect(await verify(stored?.passwordHash as string, NEW_PASSWORD)).toBe(true);
    expect(await verify(stored?.passwordHash as string, OLD_PASSWORD)).toBe(false);
    expect((stored?.passwordUpdatedAt as Date).getTime()).toBeGreaterThan(Date.now() - MINUTE);
    expect(db.session.rows).toHaveLength(0);
    // Refreshes the current device's own token in-place so the staleness check in
    // getCurrentUser() does not also sign this request out (see refreshPasswordSession).
    expect(updateSessionMock).toHaveBeenCalledWith({
      user: { passwordUpdatedAt: (stored?.passwordUpdatedAt as Date).toISOString() }
    });
  });

  it("kills an outstanding emailed password-change code (it must not outlive the password change)", async () => {
    const { user } = await seedAuthedUser({ passwordHash: await cheapHash(OLD_PASSWORD) });
    const other = await seedUser();
    const outstanding = (userId: unknown) =>
      db.passwordChangeCode.create({
        data: { userId, salt: "s", codeHash: "h", expiresAt: new Date(Date.now() + 10 * MINUTE) }
      });
    await outstanding(user.id);
    await outstanding(other.id);

    await changePassword(idle, changeForm({ currentPassword: OLD_PASSWORD }));

    const usedAtFor = (userId: unknown) =>
      db.passwordChangeCode.rows.find((c) => c.userId === userId)?.usedAt as
        | Date
        | null
        | undefined;
    expect(usedAtFor(user.id)).not.toBeNull();
    expect(usedAtFor(other.id)).toBeNull();
  });

  it("wrong currentPassword is rejected with a field error and leaves the hash untouched", async () => {
    const oldHash = await cheapHash(OLD_PASSWORD);
    const { user } = await seedAuthedUser({ passwordHash: oldHash });

    const result = await changePassword(idle, changeForm({ currentPassword: "WrongPassword123" }));

    expect(result.fieldErrors?.currentPassword).toEqual(["Current password is incorrect."]);
    expect(db.user.rows.find((u) => u.id === user.id)?.passwordHash).toBe(oldHash);
  });

  it("missing currentPassword is rejected when the account already has a password", async () => {
    const oldHash = await cheapHash(OLD_PASSWORD);
    const { user } = await seedAuthedUser({ passwordHash: oldHash });

    const result = await changePassword(idle, changeForm());

    expect(result.fieldErrors?.currentPassword).toEqual(["Enter your current password."]);
    expect(db.user.rows.find((u) => u.id === user.id)?.passwordHash).toBe(oldHash);
  });

  it("rejects a new password equal to the current one", async () => {
    await seedAuthedUser({ passwordHash: await cheapHash(OLD_PASSWORD) });

    const result = await changePassword(
      idle,
      changeForm({
        currentPassword: OLD_PASSWORD,
        newPassword: OLD_PASSWORD,
        confirmNewPassword: OLD_PASSWORD
      })
    );

    expect(result).toEqual({
      status: "error",
      message: "Choose a password you have not used recently."
    });
  });

  it("Google-only account (no existing password) is rejected: must use the code flow instead", async () => {
    const { user } = await seedAuthedUser({ passwordHash: null });

    const result = await changePassword(idle, changeForm());

    expect(result).toEqual({
      status: "error",
      message: 'Use "Email me a code" to set your first password.'
    });
    expect(db.user.rows.find((u) => u.id === user.id)?.passwordHash).toBeNull();
  });

  it("redirects to sign-in when there is no session", async () => {
    authMock.mockResolvedValue(null);

    await expect(
      changePassword(idle, changeForm({ currentPassword: OLD_PASSWORD }))
    ).rejects.toThrow("NEXT_REDIRECT");
  });

  it("locks out after 5 attempts in 15 minutes", async () => {
    await seedAuthedUser({ passwordHash: await cheapHash(OLD_PASSWORD) });

    for (let i = 0; i < 5; i++) {
      await changePassword(idle, changeForm({ currentPassword: "WrongPassword123" }));
    }

    const result = await changePassword(idle, changeForm({ currentPassword: OLD_PASSWORD }));

    expect(result).toEqual({
      status: "error",
      message: "Too many attempts. Please wait and try again."
    });
  });

  it("rate limit lifts after 15 minutes", async () => {
    await seedAuthedUser({ passwordHash: await cheapHash(OLD_PASSWORD) });

    for (let i = 0; i < 6; i++) {
      await changePassword(idle, changeForm({ currentPassword: "WrongPassword123" }));
    }
    advance(15 * MINUTE + 1);

    const result = await changePassword(idle, changeForm({ currentPassword: OLD_PASSWORD }));

    expect(result).toEqual({ status: "success", message: "Password updated." });
  });
});
