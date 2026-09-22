import { verify } from "argon2";
import { describe, expect, it, vi } from "vitest";

import { resendVerificationCode, verifyEmailCode } from "./server";
import {
  GOOD_PASSWORD,
  MINUTE,
  START,
  advance,
  cheapHash,
  db,
  flushAfter,
  lastCode,
  registerUnverified,
  seedUser,
  sendCode,
  signInMock,
  signUp,
  uniqueEmail,
  registerServerTestLifecycle,
  wrongCodeFor
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

describe("sign-up", () => {
  it("creates an unverified user, hashes the password with argon2id and sends a code", async () => {
    const result = await signUp({ email: "New@Example.com", name: "  Ada  " });

    expect(result).toMatchObject({
      status: "success",
      step: "verify-email",
      email: "new@example.com",
      cooldownSeconds: 60
    });
    const [user] = db.user.rows;
    expect(db.user.rows).toHaveLength(1);
    expect(user).toMatchObject({ email: "new@example.com", name: "Ada", emailVerified: null });
    expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(user)).not.toContain(GOOD_PASSWORD);
    expect(sendCode).toHaveBeenCalledTimes(1);
    expect(lastCode()).toMatch(/^\d{6}$/);
  });

  it("does not sign the user in or issue a session", async () => {
    await signUp();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it.each(["", "not-an-email", "a@", "@example.com", "a b@example.com"])(
    "rejects invalid email %j",
    async (email) => {
      const result = await signUp({ email });

      expect(result.status).toBe("error");
      expect(result.fieldErrors?.email?.[0]).toBe("Enter a valid email address.");
      expect(db.user.rows).toHaveLength(0);
      expect(sendCode).not.toHaveBeenCalled();
    }
  );

  it("rejects an email longer than 254 characters", async () => {
    const result = await signUp({ email: `${"a".repeat(250)}@example.com` });
    expect(result.fieldErrors?.email).toBeDefined();
  });

  describe("password requirements", () => {
    it.each([
      ["shorter than 12 chars", "Abcdefgh1", "Use at least 12 characters."],
      ["exactly 11 chars", "Abcdefghij1", "Use at least 12 characters."],
      ["no lowercase letter", "ABCDEFGHIJKL1", "Add a lowercase letter."],
      ["no uppercase letter", "abcdefghijkl1", "Add an uppercase letter."],
      ["no number", "Abcdefghijklm", "Add a number."],
      ["longer than 128 chars", `Aa1${"x".repeat(126)}`, "Password is too long."],
      ["empty", "", "Use at least 12 characters."]
    ])("rejects a password %s", async (_label, password, expected) => {
      const result = await signUp({ password, confirmPassword: password });

      expect(result.status).toBe("error");
      expect(result.fieldErrors?.password).toContain(expected);
      expect(db.user.rows).toHaveLength(0);
      expect(sendCode).not.toHaveBeenCalled();
    });

    it("reports every unmet requirement at once", async () => {
      const result = await signUp({ password: "abc", confirmPassword: "abc" });
      expect(result.fieldErrors?.password).toEqual([
        "Use at least 12 characters.",
        "Add an uppercase letter.",
        "Add a number."
      ]);
    });

    it.each(["Abcdefghij12", `Aa1${"x".repeat(125)}`, "Unicode-Passw0rd-ok"])(
      "accepts boundary password %j",
      async (password) => {
        const result = await signUp({ password, confirmPassword: password });
        expect(result.status).toBe("success");
      }
    );
  });

  it("rejects mismatched confirm password", async () => {
    const result = await signUp({ confirmPassword: `${GOOD_PASSWORD}x` });

    expect(result.fieldErrors?.confirmPassword).toEqual(["Passwords do not match."]);
    expect(db.user.rows).toHaveLength(0);
  });

  it.each(["", " ", "A", "x".repeat(81)])("rejects invalid name %j", async (name) => {
    const result = await signUp({ name });
    expect(result.fieldErrors?.name).toBeDefined();
  });

  it("returns a generic error for an already-verified email (no enumeration)", async () => {
    const email = uniqueEmail();
    await seedUser({ email, emailVerified: new Date(), passwordHash: await cheapHash("x") });
    const before = JSON.stringify(db.user.rows);

    const result = await signUp({ email });

    expect(result).toEqual({
      status: "error",
      message: "Unable to create an account with those details."
    });
    expect(sendCode).not.toHaveBeenCalled();
    expect(JSON.stringify(db.user.rows)).toBe(before);
  });

  it("treats a Google-only account (no password) exactly like a verified one", async () => {
    const verifiedEmail = uniqueEmail();
    const googleEmail = uniqueEmail();
    await seedUser({
      email: verifiedEmail,
      emailVerified: new Date(),
      passwordHash: await cheapHash("x")
    });
    await seedUser({ email: googleEmail, emailVerified: new Date(), passwordHash: null });

    const verified = await signUp({ email: verifiedEmail });
    const google = await signUp({ email: googleEmail });

    expect(google).toEqual(verified);
    expect(db.user.rows.find((u) => u.email === googleEmail)?.passwordHash).toBeNull();
  });

  it("does not take over an unverified account that has no password", async () => {
    const email = uniqueEmail();
    await seedUser({ email, emailVerified: null, passwordHash: null });

    const result = await signUp({ email });

    expect(result.status).toBe("error");
    expect(db.user.rows[0]?.passwordHash).toBeNull();
    expect(sendCode).not.toHaveBeenCalled();
  });

  it("re-signup over an unverified account replaces pending credentials and sends a new code", async () => {
    const email = uniqueEmail();
    await signUp({
      email,
      name: "Attacker",
      password: "AttackerPass123",
      confirmPassword: "AttackerPass123"
    });
    const oldHash = db.user.rows[0]?.passwordHash as string;
    const oldCode = lastCode();
    advance(61_000);

    const second = await signUp({ email, name: "Real Owner" });

    expect(second).toMatchObject({ status: "success", step: "verify-email", email });
    expect(db.user.rows).toHaveLength(1);
    const user = db.user.rows[0];
    expect(user?.name).toBe("Real Owner");
    expect(user?.passwordHash).not.toBe(oldHash);
    expect(await verify(user?.passwordHash as string, GOOD_PASSWORD)).toBe(true);
    expect(await verify(user?.passwordHash as string, "AttackerPass123")).toBe(false);
    expect(user?.emailVerified).toBeNull();
    expect(sendCode).toHaveBeenCalledTimes(2);
    expect(db.emailVerificationCode.rows.filter((c) => c.usedAt === null)).toHaveLength(1);

    if (oldCode !== lastCode()) {
      expect((await verifyEmailCode(email, oldCode)).status).toBe("error");
    }
  });

  it("re-signup inside the 60s cooldown replaces credentials but sends no second email", async () => {
    const email = uniqueEmail();
    await signUp({ email });

    const second = await signUp({
      email,
      password: "AnotherGood123x",
      confirmPassword: "AnotherGood123x"
    });

    expect(second.status).toBe("success");
    expect(sendCode).toHaveBeenCalledTimes(1);
    expect(await verify(db.user.rows[0]?.passwordHash as string, "AnotherGood123x")).toBe(true);
  });

  it("rate limits to 3 sign-ups per hour per email", async () => {
    const email = uniqueEmail();
    for (let i = 0; i < 3; i++) {
      expect((await signUp({ email })).message).not.toMatch(/too many/i);
    }

    expect(await signUp({ email })).toEqual({
      status: "error",
      message: "Too many attempts. Please wait and try again."
    });
  });

  it("rate limit is per email and expires after an hour", async () => {
    const email = uniqueEmail();
    for (let i = 0; i < 4; i++) await signUp({ email });

    expect((await signUp()).status).toBe("success");
    advance(60 * MINUTE + 1);
    expect((await signUp({ email })).message).not.toMatch(/too many/i);
  });

  it("rate limit key is case-insensitive", async () => {
    const email = uniqueEmail();
    for (let i = 0; i < 3; i++) await signUp({ email });

    expect((await signUp({ email: email.toUpperCase() })).message).toMatch(/too many/i);
  });

  it("rate limits before touching the database", async () => {
    const email = uniqueEmail();
    for (let i = 0; i < 3; i++) await signUp({ email });
    const spy = vi.spyOn(db.user, "findUnique");

    await signUp({ email });

    expect(spy).not.toHaveBeenCalled();
  });

  it("reports a send failure without pretending a code was sent", async () => {
    sendCode.mockResolvedValueOnce(false);

    const result = await signUp();

    expect(result).toEqual({
      status: "error",
      message: "We could not send the verification email. Please try again in a minute."
    });
    expect(db.emailVerificationCode.rows.every((c) => c.usedAt !== null)).toBe(true);
  });

  it("maps a unique-constraint race (P2002) to the generic error", async () => {
    vi.spyOn(db.user, "create").mockRejectedValueOnce(
      Object.assign(new Error("dup"), { code: "P2002" })
    );

    expect(await signUp()).toEqual({
      status: "error",
      message: "Unable to create an account with those details."
    });
  });

  it.each(["P1001", "P2021", "P2022"])(
    "maps database availability/schema error %s to a generic message",
    async (code) => {
      vi.spyOn(db.user, "create").mockRejectedValueOnce(Object.assign(new Error("db"), { code }));

      expect(await signUp()).toEqual({
        status: "error",
        message: "Unable to create an account right now. Try again in a moment."
      });
    }
  );

  it("rethrows unexpected errors instead of swallowing them", async () => {
    vi.spyOn(db.user, "create").mockRejectedValueOnce(new Error("boom"));
    await expect(signUp()).rejects.toThrow("boom");
  });
});

const GENERIC_CODE_ERROR = { status: "error", message: "That code is invalid or has expired." };

describe("verify email code", () => {
  it("accepts the correct code, sets emailVerified and consumes every code", async () => {
    const { email, code } = await registerUnverified();

    const result = await verifyEmailCode(email, code);

    expect(result).toEqual({
      status: "success",
      verified: true,
      email,
      message: "Email verified. You can sign in now."
    });
    expect(db.user.rows[0]?.emailVerified).toEqual(START);
    expect(db.emailVerificationCode.rows.every((c) => c.usedAt !== null)).toBe(true);
  });

  it("normalizes the email and trims whitespace around the code", async () => {
    const { email, code } = await registerUnverified();
    const result = await verifyEmailCode(` ${email.toUpperCase()} `, ` ${code} `);
    expect(result.verified).toBe(true);
  });

  it("a wrong code fails generically and increments attempts", async () => {
    const { email, code } = await registerUnverified();

    expect(await verifyEmailCode(email, wrongCodeFor(code))).toEqual(GENERIC_CODE_ERROR);
    expect(db.emailVerificationCode.rows[0]).toMatchObject({ attempts: 1, usedAt: null });
    expect(db.user.rows[0]?.emailVerified).toBeNull();
  });

  it("the 5th wrong attempt kills the code; the correct code then also fails", async () => {
    const { email, code } = await registerUnverified();

    for (let i = 0; i < 5; i++) {
      expect(await verifyEmailCode(email, wrongCodeFor(code))).toEqual(GENERIC_CODE_ERROR);
    }

    expect(db.emailVerificationCode.rows[0]?.usedAt).not.toBeNull();
    expect(await verifyEmailCode(email, code)).toEqual(GENERIC_CODE_ERROR);
    expect(db.user.rows[0]?.emailVerified).toBeNull();
  });

  it("the correct code still works on the 5th attempt (4 wrong before)", async () => {
    const { email, code } = await registerUnverified();
    for (let i = 0; i < 4; i++) await verifyEmailCode(email, wrongCodeFor(code));

    expect((await verifyEmailCode(email, code)).verified).toBe(true);
  });

  it("parallel guesses cannot exceed the 5-attempt cap", async () => {
    const { email, code } = await registerUnverified();

    await Promise.all(Array.from({ length: 9 }, () => verifyEmailCode(email, wrongCodeFor(code))));

    expect(db.emailVerificationCode.rows[0]?.attempts).toBeLessThanOrEqual(5);
    expect(await verifyEmailCode(email, code)).toEqual(GENERIC_CODE_ERROR);
  });

  it("rejects an expired code (after 10 minutes)", async () => {
    const { email, code } = await registerUnverified();
    advance(10 * MINUTE + 1000);

    expect(await verifyEmailCode(email, code)).toEqual(GENERIC_CODE_ERROR);
    expect(db.user.rows[0]?.emailVerified).toBeNull();
  });

  it("accepts the code just before it expires", async () => {
    const { email, code } = await registerUnverified();
    advance(10 * MINUTE - 1000);

    expect((await verifyEmailCode(email, code)).verified).toBe(true);
  });

  it("rejects an already-used code (replay)", async () => {
    const { email, code } = await registerUnverified();
    await verifyEmailCode(email, code);

    expect(await verifyEmailCode(email, code)).toEqual(GENERIC_CODE_ERROR);
  });

  it("rejects a code whose record was already marked used", async () => {
    const { email, code } = await registerUnverified();
    await db.emailVerificationCode.updateMany({ data: { usedAt: new Date() } });

    expect(await verifyEmailCode(email, code)).toEqual(GENERIC_CODE_ERROR);
  });

  it.each(["12345", "1234567", "abcdef", "12345a", "12 456", "", "123.56"])(
    "rejects malformed code %j without counting an attempt",
    async (bad) => {
      const { email } = await registerUnverified();

      const result = await verifyEmailCode(email, bad);

      expect(result.status).toBe("error");
      expect(result.fieldErrors?.code).toEqual(["Enter the 6-digit code."]);
      expect(db.emailVerificationCode.rows[0]?.attempts).toBe(0);
    }
  );

  it("rejects a malformed email", async () => {
    const result = await verifyEmailCode("nope", "123456");
    expect(result.fieldErrors?.email).toBeDefined();
  });

  it("a code for a different email does not verify that other account", async () => {
    const a = await registerUnverified();
    advance(1000);
    const b = await registerUnverified();

    const result = await verifyEmailCode(
      b.email,
      a.code === b.code ? wrongCodeFor(a.code) : a.code
    );

    expect(result).toEqual(GENERIC_CODE_ERROR);
    expect(db.user.rows.find((u) => u.email === b.email)?.emailVerified).toBeNull();
    expect(db.user.rows.find((u) => u.email === a.email)?.emailVerified).toBeNull();
    expect((await verifyEmailCode(a.email, a.code)).verified).toBe(true);
  });

  it("unknown email, verified email and wrong code give identical responses (no enumeration)", async () => {
    const { email, code } = await registerUnverified();
    const verifiedEmail = uniqueEmail();
    await seedUser({ email: verifiedEmail, emailVerified: new Date() });

    const wrong = await verifyEmailCode(email, wrongCodeFor(code));

    expect(await verifyEmailCode(uniqueEmail(), "123456")).toEqual(wrong);
    expect(await verifyEmailCode(verifiedEmail, "123456")).toEqual(wrong);
  });

  it("does not verify an account that has no active code", async () => {
    const email = uniqueEmail();
    await seedUser({ email });

    expect(await verifyEmailCode(email, "123456")).toEqual(GENERIC_CODE_ERROR);
  });

  it("rate limits verification attempts to 10 per 15 minutes per email", async () => {
    const email = uniqueEmail();
    for (let i = 0; i < 10; i++) {
      expect(await verifyEmailCode(email, "123456")).toEqual(GENERIC_CODE_ERROR);
    }

    expect(await verifyEmailCode(email, "123456")).toEqual({
      status: "error",
      message: "Too many attempts. Please wait and try again."
    });
    advance(15 * MINUTE + 1);
    expect(await verifyEmailCode(email, "123456")).toEqual(GENERIC_CODE_ERROR);
  });

  it("rate limiting also blocks the correct code", async () => {
    const { email, code } = await registerUnverified();
    for (let i = 0; i < 10; i++) await verifyEmailCode(email, wrongCodeFor(code));
    advance(61_000);
    await resendVerificationCode(email);
    await flushAfter();
    const fresh = lastCode();

    const blocked = await verifyEmailCode(email, fresh);
    expect(blocked.message).toMatch(/too many/i);
    expect(blocked.verified).toBeUndefined();
    expect(db.user.rows[0]?.emailVerified).toBeNull();
  });

  it("verification signs nothing in (sign-in is a separate step)", async () => {
    const { email, code } = await registerUnverified();
    await verifyEmailCode(email, code);
    expect(signInMock).not.toHaveBeenCalled();
  });
});

describe("resend verification code", () => {
  const GENERIC = (email: string) => ({
    status: "success",
    step: "verify-email",
    email,
    message: "If that account needs verification, a new code will be sent.",
    cooldownSeconds: 60
  });

  it("sends a new code for an unverified password account and invalidates the old one", async () => {
    const { email, code: oldCode } = await registerUnverified();
    advance(61_000);

    const result = await resendVerificationCode(email);
    expect(sendCode).toHaveBeenCalledTimes(1); // deferred via after()
    await flushAfter();

    expect(result).toEqual(GENERIC(email));
    expect(sendCode).toHaveBeenCalledTimes(2);
    const newCode = lastCode();
    if (newCode !== oldCode) {
      expect(await verifyEmailCode(email, oldCode)).toEqual(GENERIC_CODE_ERROR);
    }
    expect((await verifyEmailCode(email, newCode)).verified).toBe(true);
  });

  it("within the 60s cooldown returns the same generic response and sends nothing", async () => {
    const { email } = await registerUnverified();
    advance(30_000);

    const result = await resendVerificationCode(email);
    await flushAfter();

    expect(result).toEqual(GENERIC(email));
    expect(sendCode).toHaveBeenCalledTimes(1);
  });

  it("stops sending after 5 codes in an hour but keeps the same response", async () => {
    const { email } = await registerUnverified();
    for (let i = 0; i < 4; i++) {
      advance(61_000);
      await resendVerificationCode(email);
      await flushAfter();
    }
    expect(sendCode).toHaveBeenCalledTimes(5);

    advance(61_000);
    const result = await resendVerificationCode(email);
    await flushAfter();

    expect(result).toEqual(GENERIC(email));
    expect(sendCode).toHaveBeenCalledTimes(5);
  });

  it("gives an identical response for unknown, verified and Google-only accounts, sending nothing", async () => {
    const verified = uniqueEmail();
    const google = uniqueEmail();
    const unknown = uniqueEmail();
    await seedUser({ email: verified, emailVerified: new Date(), passwordHash: "h" });
    await seedUser({ email: google, emailVerified: null, passwordHash: null });

    for (const email of [verified, google, unknown]) {
      expect(await resendVerificationCode(email)).toEqual(GENERIC(email));
    }
    await flushAfter();

    expect(sendCode).not.toHaveBeenCalled();
  });

  it("rate limits at 10 requests per hour with the same generic response", async () => {
    const { email } = await registerUnverified();
    for (let i = 0; i < 10; i++) await resendVerificationCode(email);

    expect(await resendVerificationCode(email)).toEqual(GENERIC(email));
  });

  it("rejects an invalid email with field errors", async () => {
    const result = await resendVerificationCode("nope");
    expect(result.fieldErrors?.email).toBeDefined();
  });
});
