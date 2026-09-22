import { prisma } from "@/lib/db/prisma";

/** Shared field set covering what both `authorize()` and the email-not-verified path need. */
const identifierUserSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  emailVerified: true,
  passwordHash: true,
  passwordUpdatedAt: true
} as const;

export interface IdentifierUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  emailVerified: Date | null;
  passwordHash: string | null;
  passwordUpdatedAt: Date | null;
}

/**
 * Resolves a sign-in identifier that may be an email address or a username.
 * Emails are matched via `User.email`; usernames via `UserProfile.username`, which only exists
 * for users who finished `/profile/setup` onboarding.
 */
export async function findUserByIdentifier(identifier: string): Promise<IdentifierUser | null> {
  const trimmed = identifier.trim();

  if (trimmed.includes("@")) {
    return prisma.user.findUnique({
      where: { email: trimmed.toLowerCase() },
      select: identifierUserSelect
    });
  }

  const result = await prisma.userProfile.findFirst({
    where: { username: trimmed },
    select: { user: { select: identifierUserSelect } }
  });

  return result?.user ?? null;
}
