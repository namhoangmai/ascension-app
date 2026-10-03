/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, expect, it, vi, type Mock } from "vitest";

import type { Session } from "next-auth";

import { getAccountDetails, getPasswordStatus } from "./server";
import {
  cheapHash,
  seedUser,
  seedUserProfile,
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

/** Seeds a user and points the mocked `auth()` session at it (see change-password.test.ts). */
async function seedAuthedUser(fields: Row = {}) {
  const user = await seedUser({ emailVerified: new Date(), ...fields });

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

  return user;
}

describe("getPasswordStatus", () => {
  it("is true when the account has a password hash", async () => {
    await seedAuthedUser({ passwordHash: await cheapHash("OldPassword123") });

    await expect(getPasswordStatus()).resolves.toEqual({ hasPassword: true });
  });

  it("is false for a Google-only account (no password hash)", async () => {
    await seedAuthedUser({ passwordHash: null });

    await expect(getPasswordStatus()).resolves.toEqual({ hasPassword: false });
  });

  it("reports the signed-in user's own row, not another account's", async () => {
    await seedUser({ email: uniqueEmail(), passwordHash: await cheapHash("OldPassword123") });
    await seedAuthedUser({ passwordHash: null });

    await expect(getPasswordStatus()).resolves.toEqual({ hasPassword: false });
  });

  it("redirects to sign-in when there is no session", async () => {
    authMock.mockResolvedValue(null);

    await expect(getPasswordStatus()).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("getAccountDetails", () => {
  it("returns email, username and dateOfBirth as an ISO string", async () => {
    const user = await seedAuthedUser();
    await seedUserProfile(user.id as string, {
      username: "Athlete99",
      dateOfBirth: new Date("1995-06-15T00:00:00.000Z")
    });

    await expect(getAccountDetails()).resolves.toEqual({
      email: user.email,
      username: "Athlete99",
      dateOfBirth: "1995-06-15T00:00:00.000Z"
    });
  });

  it("returns null username and dateOfBirth when the user has no profile yet", async () => {
    const user = await seedAuthedUser();

    await expect(getAccountDetails()).resolves.toEqual({
      email: user.email,
      username: null,
      dateOfBirth: null
    });
  });

  it("returns a null dateOfBirth when only the username is set", async () => {
    const user = await seedAuthedUser();
    await seedUserProfile(user.id as string, { username: "Athlete99", dateOfBirth: null });

    await expect(getAccountDetails()).resolves.toEqual({
      email: user.email,
      username: "Athlete99",
      dateOfBirth: null
    });
  });

  it("returns a null username when only the dateOfBirth is set", async () => {
    const user = await seedAuthedUser();
    await seedUserProfile(user.id as string, {
      username: null,
      dateOfBirth: new Date("1995-06-15T00:00:00.000Z")
    });

    await expect(getAccountDetails()).resolves.toEqual({
      email: user.email,
      username: null,
      dateOfBirth: "1995-06-15T00:00:00.000Z"
    });
  });

  it("does not leak another user's profile", async () => {
    const other = await seedUser({ email: uniqueEmail() });
    await seedUserProfile(other.id as string, {
      username: "someone_else",
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z")
    });
    const user = await seedAuthedUser();

    await expect(getAccountDetails()).resolves.toEqual({
      email: user.email,
      username: null,
      dateOfBirth: null
    });
  });

  it("prefers the email stored in the database over the one in the session token", async () => {
    const user = await seedAuthedUser();
    // The JWT carries the email as it was at sign-in; the DB row is the source of truth.
    authMock.mockResolvedValue({
      user: {
        id: user.id,
        email: "stale@example.com",
        name: user.name,
        image: user.image,
        passwordUpdatedAt: null
      }
    } as unknown as Session);

    await expect(getAccountDetails()).resolves.toMatchObject({ email: user.email });
  });

  it("redirects to sign-in when there is no session", async () => {
    authMock.mockResolvedValue(null);

    await expect(getAccountDetails()).rejects.toThrow("NEXT_REDIRECT");
  });
});
