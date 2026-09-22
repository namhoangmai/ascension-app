/* eslint-disable @typescript-eslint/non-nullable-type-assertion-style, @typescript-eslint/no-unsafe-assignment */
import { verify } from "argon2";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { getAuthProviders } from "./providers";
import { requestPasswordReset, resetPassword } from "./server";
import type { Row } from "./fake-db.test.helpers";
import {
  MINUTE,
  START,
  advance,
  cheapHash,
  db,
  flushAfter,
  form,
  idle,
  seedUser,
  sendReset,
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
vi.mock("next/server", async () => {
  const { afterQueue } = await import("./after-queue.test.helpers");
  return {
    after: (callback: () => Promise<void> | void) => {
      afterQueue.push(callback);
    }
  };
});

registerServerTestLifecycle();

describe("forgot password", () => {
  const GENERIC = {
    status: "success",
    message: "If that email exists, a reset link will be sent."
  };
  const forgot = (email: string) => requestPasswordReset(idle, form({ email }));

  it("returns the same generic response for unknown and known emails", async () => {
    const email = uniqueEmail();
    await seedUser({ email, passwordHash: "h" });

    const known = await forgot(email);
    const unknown = await forgot(uniqueEmail());
    await flushAfter();

    expect(known).toEqual(GENERIC);
    expect(unknown).toEqual(GENERIC);
    expect(sendReset).toHaveBeenCalledTimes(1);
    expect(db.passwordResetToken.rows).toHaveLength(1);
  });

  it("stores only a SHA-256 hash of the token and emails a 30-minute link", async () => {
    const email = uniqueEmail();
    await seedUser({ email });

    await forgot(email);
    await flushAfter();

    const [to, url, ttl] = sendReset.mock.calls[0] ?? [];
    const token = new URL(url as string).searchParams.get("token") ?? "";
    expect(to).toBe(email);
    expect(ttl).toBe(30);
    expect((url as string).startsWith("https://app.test/reset-password?token=")).toBe(true);
    const [row] = db.passwordResetToken.rows;
    expect(row?.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(JSON.stringify(row)).not.toContain(token);
    expect((row?.expiresAt as Date).getTime()).toBe(START.getTime() + 30 * MINUTE);
  });

  it("does not leak the reset URL in the response outside development", async () => {
    const email = uniqueEmail();
    await seedUser({ email });
    expect(await forgot(email)).not.toHaveProperty("resetUrl");
  });

  it("invalidates earlier unused tokens when a new one is requested", async () => {
    const email = uniqueEmail();
    await seedUser({ email });
    await forgot(email);
    await forgot(email);

    expect(db.passwordResetToken.rows).toHaveLength(2);
    expect(db.passwordResetToken.rows.filter((t) => t.usedAt === null)).toHaveLength(1);
  });

  it("is rate limited at 3/hour but keeps the generic response", async () => {
    const email = uniqueEmail();
    await seedUser({ email });
    for (let i = 0; i < 3; i++) await forgot(email);

    expect(await forgot(email)).toEqual(GENERIC);
    expect(db.passwordResetToken.rows).toHaveLength(3);
  });

  it("rejects an invalid email with field errors", async () => {
    const result = await forgot("nope");
    expect(result.fieldErrors?.email).toBeDefined();
  });
});

describe("reset password", () => {
  const NEW_PASSWORD = "BrandNewPass42x";
  const INVALID = { status: "error", message: "Reset link is invalid or expired." };

  const reset = (token: string, password = NEW_PASSWORD, confirm = password) =>
    resetPassword(idle, form({ token, password, confirmPassword: confirm }));

  async function requestToken(fields: Row = {}) {
    const email = uniqueEmail();
    const user = await seedUser({
      email,
      passwordHash: await cheapHash("OldPassword123"),
      ...fields
    });
    await requestPasswordReset(idle, form({ email }));
    await flushAfter();
    const url = sendReset.mock.calls.at(-1)?.[1] ?? "";
    return { email, user, token: new URL(url).searchParams.get("token") ?? "" };
  }

  it("sets the new password, consumes the token and revokes sessions", async () => {
    const { user, token } = await requestToken({ emailVerified: new Date() });
    await db.session.create({ data: { userId: user.id } });
    advance(MINUTE);

    const result = await reset(token);

    expect(result).toEqual({
      status: "success",
      message: "Password updated. You can sign in now."
    });
    const stored = db.user.rows.find((u) => u.id === user.id);
    expect(await verify(stored?.passwordHash as string, NEW_PASSWORD)).toBe(true);
    expect(await verify(stored?.passwordHash as string, "OldPassword123")).toBe(false);
    expect(db.passwordResetToken.rows[0]?.usedAt).not.toBeNull();
    expect(db.session.rows).toHaveLength(0);
  });

  it("tokens are single-use", async () => {
    const { token } = await requestToken();

    expect((await reset(token)).status).toBe("success");
    expect(await reset(token, "YetAnotherPass77")).toEqual(INVALID);
  });

  it("two concurrent redemptions: exactly one succeeds", async () => {
    const { token } = await requestToken();

    const results = await Promise.all([reset(token), reset(token, "ConcurrentPass88")]);

    expect(results.filter((r) => r.status === "success")).toHaveLength(1);
    expect(results.filter((r) => r.status === "error")).toHaveLength(1);
  });

  it("rejects an expired token (after 30 minutes)", async () => {
    const { token } = await requestToken();
    advance(30 * MINUTE + 1000);

    expect(await reset(token)).toEqual(INVALID);
    expect(await verify(db.user.rows[0]?.passwordHash as string, "OldPassword123")).toBe(true);
  });

  it("rejects an unknown token of valid shape", async () => {
    expect(await reset("x".repeat(43))).toEqual(INVALID);
  });

  it("rejects a token that was superseded by a newer request", async () => {
    const { email, token: first } = await requestToken();
    await requestPasswordReset(idle, form({ email }));

    expect(await reset(first)).toEqual(INVALID);
  });

  it("rejects too-short and too-long tokens as field errors", async () => {
    expect((await reset("short")).fieldErrors?.token).toEqual(["Reset token is invalid."]);
    expect((await reset("x".repeat(257))).fieldErrors?.token).toEqual(["Reset token is invalid."]);
  });

  it("marks an unverified account as verified (link proves mailbox ownership)", async () => {
    const { user, token } = await requestToken({ emailVerified: null });

    await reset(token);

    expect(db.user.rows.find((u) => u.id === user.id)?.emailVerified).toEqual(START);
  });

  it("an unverified account can sign in after resetting (authorize succeeds)", async () => {
    const { email, token } = await requestToken({ emailVerified: null });
    await reset(token);
    const provider = getAuthProviders()[0] as unknown as {
      options: { authorize: (c: Record<string, unknown>) => Promise<unknown> };
    };

    expect(await provider.options.authorize({ email, password: NEW_PASSWORD })).toMatchObject({
      email
    });
  });

  it("does not overwrite an existing emailVerified date", async () => {
    const original = new Date("2025-01-01T00:00:00Z");
    const { user, token } = await requestToken({ emailVerified: original });

    await reset(token);

    expect(db.user.rows.find((u) => u.id === user.id)?.emailVerified).toEqual(original);
  });

  it("refuses to reuse the current password and keeps the token usable", async () => {
    const { token } = await requestToken();

    expect(await reset(token, "OldPassword123")).toEqual({
      status: "error",
      message: "Choose a password you have not used recently."
    });
    expect((await reset(token)).status).toBe("success");
  });

  it.each([
    ["short", "Ab1", "Use at least 12 characters."],
    ["no uppercase", "abcdefghijkl1", "Add an uppercase letter."],
    ["no lowercase", "ABCDEFGHIJKL1", "Add a lowercase letter."],
    ["no number", "Abcdefghijklm", "Add a number."]
  ])("enforces the password policy on reset (%s)", async (_label, password, message) => {
    const { token } = await requestToken();

    const result = await reset(token, password);

    expect(result.fieldErrors?.password).toContain(message);
    expect(db.passwordResetToken.rows[0]?.usedAt).toBeNull();
  });

  it("rejects mismatched confirmation without consuming the token", async () => {
    const { token } = await requestToken();

    const result = await reset(token, NEW_PASSWORD, `${NEW_PASSWORD}!`);

    expect(result.fieldErrors?.confirmPassword).toEqual(["Passwords do not match."]);
    expect(db.passwordResetToken.rows[0]?.usedAt).toBeNull();
  });

  it("rate limits redemption attempts to 5/hour per token prefix", async () => {
    const token = "r".repeat(43);
    for (let i = 0; i < 5; i++) expect(await reset(token)).toEqual(INVALID);

    expect(await reset(token)).toEqual({
      status: "error",
      message: "Too many attempts. Please wait and try again."
    });
  });
});
