/* eslint-disable @typescript-eslint/non-nullable-type-assertion-style */
import { hash } from "argon2";
import { afterEach, beforeEach, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { sendPasswordResetEmail, sendVerificationCodeEmail } from "@/lib/services/email";

import { afterQueue, flushAfter } from "./after-queue.test.helpers";
import { signIn } from "./auth";
import type { FakeDb, Row } from "./fake-db.test.helpers";
import { signUpWithPassword, verifyEmailCode, type AuthActionState } from "./server";

/**
 * Shared fixtures for the server-action tests. Each test file must declare the vi.mock() calls
 * for @/lib/db/prisma (fake db), @/lib/services/email, ./auth, next/navigation and next/server.
 */
export const db = prisma as unknown as FakeDb;
export const sendCode = vi.mocked(sendVerificationCodeEmail);
export const sendReset = vi.mocked(sendPasswordResetEmail);
export const signInMock = vi.mocked(signIn);
export { flushAfter };

export const GOOD_PASSWORD = "CorrectHorse9Battery";
export const START = new Date("2026-03-01T09:00:00Z");
export const MINUTE = 60_000;
export const idle: AuthActionState = { status: "idle" };

let counter = 0;
/** Unique email per test so the process-wide in-memory rate limiter never bleeds between tests. */
export const uniqueEmail = () => `user${String(++counter)}@example.com`;

export const form = (fields: Record<string, string | boolean>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === true) data.set(key, "on");
    else if (value !== false) data.set(key, value);
  }
  return data;
};

export const signUp = (overrides: Record<string, string> = {}) =>
  signUpWithPassword(
    idle,
    form({
      name: "Test User",
      email: uniqueEmail(),
      password: GOOD_PASSWORD,
      confirmPassword: GOOD_PASSWORD,
      ...overrides
    })
  );

export const cheapHash = (password: string) => hash(password, { memoryCost: 1024, timeCost: 1 });

export async function seedUser(fields: Row = {}) {
  const email = (fields.email as string | undefined) ?? uniqueEmail();
  return db.user.create({ data: { name: "Seed", email, ...fields } });
}

export const advance = (ms: number) => {
  vi.setSystemTime(new Date(Date.now() + ms));
};

export const lastCode = () => sendCode.mock.calls.at(-1)?.[1] ?? "";

export const wrongCodeFor = (code: string) => (code === "000000" ? "000001" : "000000");

export async function registerUnverified(email = uniqueEmail()) {
  await signUp({ email });
  return { email, code: lastCode(), user: db.user.rows.find((u) => u.email === email) as Row };
}

export { verifyEmailCode };

/** Registers the shared beforeEach/afterEach: frozen clock, empty db, fresh mocks. */
export function registerServerTestLifecycle() {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    db.reset();
    afterQueue.length = 0;
    sendCode.mockReset();
    sendReset.mockReset();
    sendCode.mockResolvedValue(true);
    sendReset.mockResolvedValue(true);
    signInMock.mockReset();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
}
