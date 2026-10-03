import { randomBytes, randomInt } from "node:crypto";

import { prisma } from "@/lib/db/prisma";
import { sendPasswordChangeCodeEmail } from "@/lib/services/email";

import { codeMatchesWithPurpose, hashCodeWithPurpose } from "./code-hash";

export const CODE_TTL_MINUTES = 10;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_CODES_PER_HOUR = 5;
export const MAX_CODE_ATTEMPTS = 5;

/**
 * Distinguishes this module's codes from other 6-digit code purposes (e.g. email verification)
 * in the HMAC input, so a value that happens to match numerically cannot be replayed across
 * flows.
 */
const PURPOSE = "password-change";

function hashCode(code: string, salt: string, userId: string) {
  return hashCodeWithPurpose(code, salt, userId, PURPOSE);
}

export function passwordChangeCodeMatches(
  code: string,
  salt: string,
  userId: string,
  expectedHash: string
) {
  return codeMatchesWithPurpose(code, salt, userId, PURPOSE, expectedHash);
}

export type IssueResult = "sent" | "cooldown" | "capped" | "send_failed";

/**
 * Creates a fresh password-change code (invalidating older ones) and emails it to the user's own
 * current address. Enforces the 60s cooldown and hourly cap using DB state so limits survive
 * restarts. Does not check the user's eligibility.
 */
export async function issuePasswordChangeCode(user: {
  id: string;
  email: string;
}): Promise<IssueResult> {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recent = await prisma.passwordChangeCode.findMany({
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
    await tx.passwordChangeCode.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now }
    });

    return tx.passwordChangeCode.create({
      data: {
        userId: user.id,
        salt,
        codeHash: hashCode(code, salt, user.id),
        expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000)
      },
      select: { id: true }
    });
  });

  const delivered = await sendPasswordChangeCodeEmail(user.email, code, CODE_TTL_MINUTES);

  if (!delivered) {
    // Burn the unusable code; the cooldown still applies to the next request.
    await prisma.passwordChangeCode.update({
      where: { id: created.id },
      data: { usedAt: new Date() }
    });
    return "send_failed";
  }

  return "sent";
}
