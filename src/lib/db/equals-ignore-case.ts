/**
 * Filter for a case-insensitive *equality* match on user-supplied text.
 *
 * Prisma compiles `{ equals, mode: "insensitive" }` on PostgreSQL to `ILIKE $1` and does NOT
 * escape `%`, `_` or `\` in the value (checked against Prisma 7 + adapter-pg): `equals: "%"`
 * matches every row and `equals: "john_doe"` also matches "johnxdoe". For a sign-in lookup that
 * means wildcard identifiers resolve to arbitrary accounts (and dodge the per-identifier rate
 * limit), so always route such values through here.
 */
export function equalsIgnoreCase(value: string) {
  return { equals: value.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" } as const;
}
