import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/db/prisma";
import { sendVerificationCodeEmail } from "@/lib/services/email";

export const CODE_TTL_MINUTES = 10;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_CODES_PER_HOUR = 5;
export const MAX_CODE_ATTEMPTS = 5;

function hmacSecret() {
  return process.env.AUTH_SECRET ?? "development-only-auth-secret-change-before-production";
}

function hashCode(code: string, salt: string, userId: string) {
  return createHmac("sha256", hmacSecret()).update(`${salt}:${userId}:${code}`).digest("hex");
}

export function codeMatches(code: string, salt: string, userId: string, expectedHash: string) {
  const actual = Buffer.from(hashCode(code, salt, userId), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type IssueResult = "sent" | "cooldown" | "capped" | "send_failed";

/**
 * Creates a fresh code (invalidating older ones) and emails it. Enforces the 60s cooldown and
 * hourly cap using DB state so limits survive restarts. Does not check the user's eligibility.
 */
export async function issueVerificationCode(user: {
  id: string;
  email: string;
}): Promise<IssueResult> {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recent = await prisma.emailVerificationCode.findMany({
    where: { userId: user.id, createdAt: { gt: hourAgo } },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" }
  });

  const latest = recent[0];
  if (latest && now.getTime() - latest.createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
    return "cooldown";
  }

  if (recent.length >= MAX_CODES_PER_HOUR) {
    return "capped";
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const salt = randomBytes(16).toString("hex");

  const created = await prisma.$transaction(async (tx) => {
    await tx.emailVerificationCode.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now }
    });

    return tx.emailVerificationCode.create({
      data: {
        userId: user.id,
        salt,
        codeHash: hashCode(code, salt, user.id),
        expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000)
      },
      select: { id: true }
    });
  });

  const delivered = await sendVerificationCodeEmail(user.email, code, CODE_TTL_MINUTES);

  if (!delivered) {
    // Burn the unusable code; the cooldown still applies to the next request.
    await prisma.emailVerificationCode.update({
      where: { id: created.id },
      data: { usedAt: new Date() }
    });
    return "send_failed";
  }

  return "sent";
}
