import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Shared HMAC helper for every "6-digit code stored as a hash" flow (email verification,
 * password change, …). Each caller supplies its own `purpose` string so codes from different
 * flows are never interchangeable even if the same 6-digit value and salt were ever reused.
 */
export function hmacSecret() {
  const secret = process.env.AUTH_SECRET;

  // Fail closed: a code HMAC keyed with the public development fallback is not a secret.
  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("AUTH_SECRET is required in production.");
  }

  return secret ?? "development-only-auth-secret-change-before-production";
}

export function hashCodeWithPurpose(code: string, salt: string, userId: string, purpose: string) {
  return createHmac("sha256", hmacSecret())
    .update(`${purpose}:${salt}:${userId}:${code}`)
    .digest("hex");
}

export function codeMatchesWithPurpose(
  code: string,
  salt: string,
  userId: string,
  purpose: string,
  expectedHash: string
) {
  const actual = Buffer.from(hashCodeWithPurpose(code, salt, userId, purpose), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
