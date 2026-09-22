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
import { auth } from "./auth";
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
vi.mock("./auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({
  // Mirrors real Next.js behavior: redirect() interrupts execution via a thrown "digest" error.
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` });
  })
}));
vi.mock("next/server", () => ({ after: vi.fn() }));

registerServerTestLifecycle();

// `auth` is overloaded (bare call / route-handler-wrapping call); pin the mock to the bare-call
// signature actually used here so `mockResolvedValue` accepts a `Session | null`.
const authMock = vi.mocked(auth) as unknown as Mock<() => Promise<Session | null>>;

const OLD_PASSWORD = "OldPassword123";
const NEW_PASSWORD = "BrandNewPass42x";

const changeForm = (fields: Record<string, string> = {}) =>
  form({ newPassword: NEW_PASSWORD, confirmNewPassword: NEW_PASSWORD, ...fields });

/** Seeds a user and points the mocked `auth()` session at it. */
async function seedAuthedUser(fields: Row = {}) {
  const email = uniqueEmail();
  const user = await seedUser({ email, emailVerified: new Date(), ...fields });

  authMock.mockResolvedValue({
    user: { id: user.id, email: user.email, name: user.name, image: user.image }
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

  it("Google-only account (no existing password) can set one without currentPassword", async () => {
    const { user } = await seedAuthedUser({ passwordHash: null });

    const result = await changePassword(idle, changeForm());

    expect(result).toEqual({
      status: "success",
      message: "Password set. You can now sign in with your username or email and this password."
    });
    const stored = db.user.rows.find((u) => u.id === user.id);
    expect(await verify(stored?.passwordHash as string, NEW_PASSWORD)).toBe(true);
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
