# Phase 2 Authentication

## Implemented

- Auth.js v5 isolated under `src/lib/auth`.
- Prisma Adapter wired to PostgreSQL.
- Email/password signup and login with Argon2id hashing.
- Google OAuth provider wiring, enabled when Google env vars are present.
- Logout.
- Forgot password and reset password with hashed, single-use, expiring reset tokens.
- JWT sessions with server-side password timestamp validation.
- Protected product routes and public auth routes.
- Mobile-first dark auth UI with inline validation, loading states, and password visibility toggles.

## Auth Boundary

Feature code must not import Auth.js internals. Use:

- `requireUser()`
- `getCurrentUser()`
- ownership guards in `src/lib/auth/access-control.ts`

Auth.js config, providers, validation, rate limiting, and session shaping stay inside `src/lib/auth`.

## Session Strategy

Auth.js v5 requires JWT sessions for credentials authentication. The app uses JWT sessions and mitigates stale tokens by checking `passwordUpdatedAt` in `requireUser()`.

Middleware checks for the presence of an auth cookie only for quick redirects. It is not the security boundary.

## Password Reset

Reset tokens are generated with secure random bytes and stored only as SHA-256 hashes. Tokens expire after 30 minutes and are single-use. In development, the reset link is rendered after a request; production must send it through an email provider.

## Remaining Production Work Before Launch

- Add a real email provider for password reset and future verification.
- Replace in-memory rate limiting with Redis or Upstash.
- Configure Google OAuth credentials in deployment.
- Add automated integration tests for auth flows.
