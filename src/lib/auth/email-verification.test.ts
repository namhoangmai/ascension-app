import * as nodeCrypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { sendVerificationCodeEmail } from "@/lib/services/email";

import {
  CODE_TTL_MINUTES,
  MAX_CODES_PER_HOUR,
  RESEND_COOLDOWN_SECONDS,
  codeMatches,
  issueVerificationCode
} from "./email-verification";
import type { FakeDb } from "./fake-db.test.helpers";

vi.mock("@/lib/db/prisma", async () => {
  const { createFakeDb } = await import("./fake-db.test.helpers");
  return { prisma: createFakeDb() };
});
vi.mock("@/lib/services/email", () => ({
  sendVerificationCodeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn()
}));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

const db = prisma as unknown as FakeDb;
const send = vi.mocked(sendVerificationCodeEmail);
const START = new Date("2026-01-01T12:00:00Z");

let userId: string;
const sentCodes: string[] = [];

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(START);
  db.reset();
  sentCodes.length = 0;
  send.mockReset();
  send.mockImplementation((_to, code) => {
    sentCodes.push(code);
    return Promise.resolve(true);
  });
  userId = (await db.user.create({ data: { email: "a@example.com" } })).id;
});

afterEach(() => {
  vi.useRealTimers();
});

const user = () => ({ id: userId, email: "a@example.com" });
const advance = (ms: number) => {
  vi.setSystemTime(new Date(Date.now() + ms));
};

describe("issueVerificationCode", () => {
  it("emails a 6-digit numeric code with the documented TTL", async () => {
    expect(await issueVerificationCode(user())).toBe("sent");
    expect(sentCodes).toHaveLength(1);
    expect(sentCodes[0]).toMatch(/^\d{6}$/);
    expect(send).toHaveBeenCalledWith("a@example.com", sentCodes[0], CODE_TTL_MINUTES);

    const [row] = db.emailVerificationCode.rows;
    expect(row?.expiresAt.getTime()).toBe(START.getTime() + CODE_TTL_MINUTES * 60_000);
    expect(row?.attempts).toBe(0);
    expect(row?.usedAt).toBeNull();
  });

  it("stores only a hash of the code (never the plaintext)", async () => {
    await issueVerificationCode(user());
    const [row] = db.emailVerificationCode.rows;
    const code = sentCodes[0] ?? "";

    expect(row?.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.codeHash).not.toContain(code);
    expect(JSON.stringify(row)).not.toContain(`"${code}"`);
    expect(Object.values(row ?? {})).not.toContain(code);
  });

  it("verifies the emailed code against the stored hash and rejects others", async () => {
    await issueVerificationCode(user());
    const [row] = db.emailVerificationCode.rows;
    const code = sentCodes[0] ?? "";
    const wrong = code === "000000" ? "000001" : "000000";

    expect(codeMatches(code, row?.salt, userId, row?.codeHash)).toBe(true);
    expect(codeMatches(wrong, row?.salt, userId, row?.codeHash)).toBe(false);
  });

  it("binds a code to its user (code for a different account does not match)", async () => {
    await issueVerificationCode(user());
    const [row] = db.emailVerificationCode.rows;

    expect(codeMatches(sentCodes[0] ?? "", row?.salt, "someone-else", row?.codeHash)).toBe(false);
  });

  it("uses a fresh salt per code so identical codes hash differently", async () => {
    await issueVerificationCode(user());
    advance(RESEND_COOLDOWN_SECONDS * 1000 + 1);
    await issueVerificationCode(user());
    const [a, b] = db.emailVerificationCode.rows;

    expect(a?.salt).not.toBe(b?.salt);
    expect(a?.codeHash).not.toBe(b?.codeHash);
  });

  it("enforces the 60s resend cooldown without sending", async () => {
    expect(await issueVerificationCode(user())).toBe("sent");
    advance((RESEND_COOLDOWN_SECONDS - 1) * 1000);

    expect(await issueVerificationCode(user())).toBe("cooldown");
    expect(send).toHaveBeenCalledTimes(1);
    expect(db.emailVerificationCode.rows).toHaveLength(1);
  });

  it("allows a resend once the cooldown has elapsed", async () => {
    await issueVerificationCode(user());
    advance(RESEND_COOLDOWN_SECONDS * 1000);

    expect(await issueVerificationCode(user())).toBe("sent");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("invalidates older codes when a new one is issued", async () => {
    await issueVerificationCode(user());
    advance(RESEND_COOLDOWN_SECONDS * 1000);
    await issueVerificationCode(user());

    const [older, newer] = db.emailVerificationCode.rows;
    expect(older?.usedAt).not.toBeNull();
    expect(newer?.usedAt).toBeNull();
    // The old code no longer verifies through the "active" query used by verifyEmailCode.
    const active = await db.emailVerificationCode.findMany({ where: { userId, usedAt: null } });
    expect(active).toHaveLength(1);
  });

  it("caps codes at 5 per rolling hour", async () => {
    for (let i = 0; i < MAX_CODES_PER_HOUR; i++) {
      expect(await issueVerificationCode(user())).toBe("sent");
      advance(RESEND_COOLDOWN_SECONDS * 1000);
    }

    expect(await issueVerificationCode(user())).toBe("capped");
    expect(send).toHaveBeenCalledTimes(MAX_CODES_PER_HOUR);
  });

  it("frees the hourly cap once the oldest codes age out", async () => {
    for (let i = 0; i < MAX_CODES_PER_HOUR; i++) {
      await issueVerificationCode(user());
      advance(RESEND_COOLDOWN_SECONDS * 1000);
    }
    advance(60 * 60 * 1000);

    expect(await issueVerificationCode(user())).toBe("sent");
  });

  it("does not share cooldown or cap between users", async () => {
    await issueVerificationCode(user());
    const other = await db.user.create({ data: { email: "b@example.com" } });

    expect(await issueVerificationCode({ id: other.id, email: "b@example.com" })).toBe("sent");
  });

  it("burns the code and reports send_failed when email delivery fails", async () => {
    send.mockResolvedValueOnce(false);

    expect(await issueVerificationCode(user())).toBe("send_failed");
    const [row] = db.emailVerificationCode.rows;
    expect(row?.usedAt).not.toBeNull();
  });

  it("still applies the cooldown after a failed send", async () => {
    send.mockResolvedValueOnce(false);
    await issueVerificationCode(user());

    expect(await issueVerificationCode(user())).toBe("cooldown");
  });
});

describe("codeMatches", () => {
  it("compares via crypto.timingSafeEqual (constant-time path)", async () => {
    await issueVerificationCode(user());
    const [row] = db.emailVerificationCode.rows;
    const spy = vi.mocked(nodeCrypto.timingSafeEqual);
    spy.mockClear();

    codeMatches(sentCodes[0] ?? "", row?.salt, userId, row?.codeHash);
    codeMatches("999999", row?.salt, userId, row?.codeHash);

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("returns false (does not throw) for a malformed or wrong-length stored hash", () => {
    expect(codeMatches("123456", "salt", userId, "abcd")).toBe(false);
    expect(codeMatches("123456", "salt", userId, "")).toBe(false);
    expect(codeMatches("123456", "salt", userId, "not-hex-at-all")).toBe(false);
  });

  it("depends on AUTH_SECRET (a different secret invalidates old codes)", async () => {
    await issueVerificationCode(user());
    const [row] = db.emailVerificationCode.rows;
    const code = sentCodes[0] ?? "";
    const original = process.env.AUTH_SECRET;

    process.env.AUTH_SECRET = "rotated-secret";
    try {
      expect(codeMatches(code, row?.salt, userId, row?.codeHash)).toBe(false);
    } finally {
      process.env.AUTH_SECRET = original;
    }
    expect(codeMatches(code, row?.salt, userId, row?.codeHash)).toBe(true);
  });
});
