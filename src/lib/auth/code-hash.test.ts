import { afterEach, describe, expect, it, vi } from "vitest";

import { codeMatchesWithPurpose, hashCodeWithPurpose, hmacSecret } from "./code-hash";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("hmacSecret", () => {
  it("uses AUTH_SECRET when set", () => {
    vi.stubEnv("AUTH_SECRET", "real-secret");

    expect(hmacSecret()).toBe("real-secret");
  });

  it("falls back to the development secret outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_SECRET", undefined);

    expect(hmacSecret()).toContain("development-only");
  });

  it.each([undefined, ""])(
    "fails closed in production when AUTH_SECRET is %j (never keys codes with the public fallback)",
    (value) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("AUTH_SECRET", value);

      expect(() => hmacSecret()).toThrow("AUTH_SECRET is required in production.");
      expect(() => hashCodeWithPurpose("123456", "salt", "user", "password-change")).toThrow();
    }
  );
});

describe("purpose-tagged code hashes", () => {
  const hash = (purpose: string) => hashCodeWithPurpose("123456", "salt", "user-1", purpose);

  it("differ per purpose, per user, per salt and per code", () => {
    const base = hash("password-change");

    expect(hash("email-verify")).not.toBe(base);
    expect(hashCodeWithPurpose("123456", "salt", "user-2", "password-change")).not.toBe(base);
    expect(hashCodeWithPurpose("123456", "other", "user-1", "password-change")).not.toBe(base);
    expect(hashCodeWithPurpose("654321", "salt", "user-1", "password-change")).not.toBe(base);
  });

  it("matches only the same purpose, and rejects malformed stored hashes without throwing", () => {
    const stored = hash("password-change");

    expect(codeMatchesWithPurpose("123456", "salt", "user-1", "password-change", stored)).toBe(
      true
    );
    expect(codeMatchesWithPurpose("123456", "salt", "user-1", "email-verify", stored)).toBe(false);
    expect(codeMatchesWithPurpose("123456", "salt", "user-1", "password-change", "")).toBe(false);
    expect(codeMatchesWithPurpose("123456", "salt", "user-1", "password-change", "zz")).toBe(false);
  });
});
