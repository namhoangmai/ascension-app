import { equalsIgnoreCase } from "@/lib/db/equals-ignore-case";
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

  // Case-insensitive to match the uniqueness rule enforced on write (see
  // `UserProfile_username_lower_key` and `src/features/profile/server.ts`) — "Bob" and "bob"
  // are the same account. `equalsIgnoreCase` escapes `%`/`_` (Prisma's insensitive `equals` is an
  // unescaped ILIKE, so `%` would otherwise match any account).
  const matches = await prisma.userProfile.findMany({
    where: { username: equalsIgnoreCase(trimmed) },
    select: { username: true, user: { select: identifierUserSelect } },
    take: 2
  });

  // The lower(username) unique index makes a second match impossible once it exists. Until it is
  // applied, legacy data may hold "Bob" and "bob": never guess between them, only an exact-case
  // match resolves an ambiguous name (as it did before names were case-insensitive).
  const match = matches.length > 1 ? matches.find((m) => m.username === trimmed) : matches[0];

  return match?.user ?? null;
}
