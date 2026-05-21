# Phase 2 Authentication Decision

## Decision

Use **Auth.js v5 (`next-auth@5.0.0-beta`) with Prisma Adapter** for Phase 2.

Use **JWT sessions** for Phase 2 because Auth.js v5 credentials authentication does not support database sessions. This is a hard Auth.js constraint for email/password support.

## Why This Is The Best Fit

- It is the forward path for Auth.js with the Next.js App Router.
- It supports Google OAuth cleanly.
- It supports credentials login for email/password when paired with our own password hashing and validation.
- It integrates with the Prisma schema already present in Phase 1.
- It keeps session handling inside the Next.js server boundary, which matches the current architecture.

## Production Caveat

Auth.js v5 is still beta. That is a real public-use risk. The mitigation is to keep all Auth.js usage behind `src/lib/auth/*` helpers and avoid importing provider/session APIs directly across feature code. If v5 becomes unstable for this app before launch, the adapter boundary lets us fall back to stable NextAuth v4 or Supabase Auth with less surface-area damage.

JWT sessions trade off easy server-side session revocation for compatibility with credentials login. To mitigate that:

- JWTs include the user's `passwordUpdatedAt` timestamp.
- `requireUser()` re-checks the user record server-side.
- Password reset updates `passwordUpdatedAt`.
- Any stale token issued before the password change is rejected by protected server helpers.
- Middleware is only a navigation convenience, not the security boundary.

## Rejected Option: Supabase Auth

Supabase Auth is production-stable and would pair naturally with Supabase-hosted Postgres and Storage. It is not the best Phase 2 choice here because the required stack explicitly names Auth.js, and using Supabase Auth would split product authentication away from that requirement.

## Rejected Option: Custom Auth

Custom auth would avoid beta dependency risk but would increase security burden for sessions, OAuth, account linking, CSRF, callback handling, and token rotation. That is not a good trade for this product.

## Phase 2 Requirements

- Keep session access behind `auth()` and typed helper functions.
- Use `bcryptjs` or a stronger compatible password hash policy for credentials.
- Add middleware or route-level guards for all product routes.
- Never expose Prisma user/account/session rows directly to client components.
- Use repository ownership guards for every user-scoped query.
