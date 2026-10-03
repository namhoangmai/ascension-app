# Ascension

Ascension is a fitness-tracking web app built with Next.js 15 (App Router, React 19).

- Auth, user profiles and the Strength workout log are stored in PostgreSQL through Prisma and Server Actions.
- Nutrition, Body tracking and the AI Coach are client-side only. They keep their data in the browser's `localStorage`. The Prisma schema has models for them, but the running app does not use those models.

## Tech stack

- Next.js 15, React 19, TypeScript
- Tailwind CSS, shadcn/ui-style components
- PostgreSQL 16 with Prisma 7
- Auth.js v5 (beta) with JWT sessions and Argon2id password hashing
- Resend for transactional email (verification codes, password reset links, password-change codes)
- Zod validation, Recharts, Motion, Vitest
- Docker (multi-stage, `output: "standalone"`, for local dev only — see Deploy), GitHub Actions, Vercel

## Features

- **Authentication and profile:** sign up, sign in (email or username, or Google), password reset, profile setup.
- **Profile settings and feedback:** the `/profile` page has a Settings panel (username, date of birth, change or set a password with the current password or an emailed code) and a Feedback & Recommendations form. Feedback is submit-only: there is no admin view, you read it in Supabase. See [docs/feedback-guide.md](docs/feedback-guide.md). (`/settings` just redirects to `/profile`.)
- **Theme:** Apple-style monochrome design with light and dark modes and a theme toggle.
- **Strength:** log workouts with a session flow of Add Exercise, Continue Workout, End Workout and Cancel Workout. Only one workout can be in progress at a time. Finished workouts are saved to the database.
- **Nutrition:** food logging and macro goals (localStorage).
- **Body tracking:** progress tracking (localStorage).
- **AI Coach:** insights computed on the client from the data you allow it to read (localStorage).

## Run locally

### Prerequisites

- Node.js 22
- Docker (for PostgreSQL)

### Steps

```bash
cp .env.example .env        # then set AUTH_SECRET (e.g. openssl rand -base64 32)
docker compose up -d db     # Postgres, published on host port 5433
npm install
npm run db:generate
npm run db:migrate
npm run dev                 # http://localhost:3000
```

Postgres is published on host port **5433**, not 5432. This is intentional, so it does not collide with a local Postgres install. Do not change it back. `.env.example` already points `DATABASE_URL` at port 5433.

Check where your own `.env` points. `npm run dev`, `db:migrate`, `db:deploy` and `db:studio` all act on whatever `DATABASE_URL` says, and that may be a remote (for example dev/staging Supabase) database rather than the local Docker one. Only `DATABASE_URL` is read; `DIRECT_URL` is not used by any code. In development the app sends real email through Resend when both `RESEND_API_KEY` and `EMAIL_FROM` are set. See [docs/feedback-guide.md](docs/feedback-guide.md) section 5.

Check the database with `docker compose ps` and `docker compose logs -f db`.

### Run the full stack with Docker Compose

```bash
docker compose up --build
```

The Dockerfile makes the app listen on `PORT=10000`. This is only used for local prod-like testing via Docker Compose — the deployed app on Vercel does not use the Dockerfile at all (see Deploy). Compose maps host `3000` to container `10000`, so open http://localhost:3000. Inside the compose network the app talks to Postgres at `db:5432`. The compose file contains local-only development credentials and secret.

The Dockerfile's builder stage also accepts a `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` build arg (see "Environment variables" below). `docker-compose.yml` doesn't pass one, so a plain Compose rebuild mints a fresh key each time — harmless for one-off local testing, but pass `--build-arg NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$(openssl rand -base64 32)` (kept stable across builds) if you're using Compose to reproduce the "stale Server Action after redeploy" bug described there.

You need to apply migrations to the compose database yourself. The runtime image does not include the Prisma CLI. From the host, run `npm run db:deploy` with `DATABASE_URL` pointing at `localhost:5433` (the default in `.env`).

### Verify before committing

```bash
npm run verify   # typecheck + lint + format:check, same as CI
npm test         # Vitest unit tests, same as CI
npm run format   # auto-fix formatting
npm run build    # also run this after touching prisma/schema.prisma
```

`npm test` runs `src/**/*.test.ts` with Vitest. The tests use an in-memory fake database and mocked email, so they need no `.env` and no database. Anything that needs a real browser, real Google or real email is listed in [docs/TESTING-AUTH.md](docs/TESTING-AUTH.md) as manual cases. A Playwright setup (`playwright.config.ts`, `tests/`) is being added separately and is not part of `npm test`.

### Project layout

- `src/app/(app)/**`, `src/app/(auth)/**`: pages and layouts. The `(app)` layout calls `requireUser()`, which is the real auth boundary.
- `src/app/api/**`: NextAuth handlers, `/api/health`, and a server-only FatSecret proxy.
- `src/components/**`: UI components, with `ui/` for primitives.
- `src/features/<domain>/`: domain logic (Prisma-backed or localStorage client stores).
- `src/lib/auth/**`: all Auth.js usage.
- `prisma/`: schema and migrations.
- `docs/`: design notes, the [feedback and production rollout guide](docs/feedback-guide.md) and the [manual auth test matrix](docs/TESTING-AUTH.md). See also `ARCHITECTURE_ESSENTIALS.md` and `ARCHITECTURE.md`.

## Deploy

The app is deployed on **Vercel**, not on the `Dockerfile`/Docker Compose setup described above. Every push to GitHub triggers automation:

1. **CI** (`.github/workflows/ci.yml`) runs on every pull request and on pushes to `main`. It starts a Postgres service, then runs `npm ci`, `db:generate`, typecheck, lint, format check, `npm test` and `npm run build`. It does not apply migrations.
2. **Vercel** builds and deploys directly from the repository via its GitHub integration — pushing to `main` auto-deploys to production. Vercel runs its own build (`next build`) and serves the app as serverless/edge functions; it does **not** use the repository's `Dockerfile`, `docker-compose.yml`, or `output: "standalone"` for the deployed app. There is no server port to configure — Vercel handles that itself. The Dockerfile/Compose setup is for local development only (see "Run the full stack with Docker Compose" above).

### Environment variables

Set these in the Vercel project dashboard (Settings → Environment Variables; names only, never commit values):

- Required: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (build-time — see below), `RESEND_API_KEY`, `EMAIL_FROM`
  - `RESEND_API_KEY` and `EMAIL_FROM` (a sender or domain verified in Resend) are needed for sign-up codes, password-reset links and password-change codes. If either is missing in production, sending fails closed (the user sees "We could not send the code").
  - Keep `AUTH_SECRET` stable. It signs sessions and keys the emailed-code hashes, so rotating it signs everyone out and invalidates outstanding codes. The app throws in production if it is unset.
- Optional OAuth: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Optional features: `FATSECRET_ACCESS_TOKEN` (food lookup), `OPENFOODFACTS_BASE_URL`
- Listed in `.env.example` (or set by CI and Compose) but not read by the current code: `DIRECT_URL` (only `DATABASE_URL` is read, by both Prisma and the app), `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

`NEXT_PUBLIC_*` values are inlined at build time. Changing a `NEXT_PUBLIC_*` value requires a rebuild (redeploy) on Vercel. The Dockerfile only sets placeholder `DATABASE_URL` and `AUTH_SECRET` for its own (local) build and is unrelated to the Vercel build's environment variables.

#### `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`

Next.js encrypts Server Action IDs with a key that's randomly generated at build time unless this is set — so every fresh build (every Vercel deploy, or every `docker build`/Render deploy of the Dockerfile below) mints a different key and invalidates every Server Action ID any already-loaded client JS still references. A browser with a tab open from before the deploy (or a stale cached chunk) then gets `UnrecognizedActionError: Server Action "..." was not found on the server` on the next action call — this is what broke the "Continue with Google" button (`signInWithGoogleAction`) after a deploy; it is a build-config issue, not an OAuth config issue.

Fix: set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to a stable base64-encoded AES key (16, 24, or 32 bytes) as a **build-time** environment variable, and never change it:

```bash
openssl rand -base64 32
```

- **Vercel:** add it in Settings → Environment Variables. Vercel exposes environment variables to the build by default, which is what's needed here — just make sure it's defined for the Production environment and is not removed/regenerated on a later edit.
- **Docker / Render:** the Dockerfile declares `ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` in the builder stage; pass the same value as a build arg every time (Render forwards dashboard-configured build-time environment variables to matching Dockerfile `ARG`s automatically — confirm this in the Render dashboard for this service if you rely on it).

Generate the value once, store it in your password manager or the platform's secret store, and reuse the exact same value for every future build. Rotating it isn't dangerous in itself, but it has the identical effect of not setting it at all — anyone with an open tab across the rotation hits the same error — so only rotate deliberately and treat it as a breaking change communicated to active users, not a routine secret rotation.

### Database migrations in production

Neither CI nor Vercel's build applies migrations. Run them against the production database whenever a push adds a migration under `prisma/migrations`:

```bash
DATABASE_URL="<production connection string>" npm run db:deploy   # prisma migrate deploy
```

Do this from a trusted machine, **before** you push the code that needs the migration (Vercel does not provide a shell into its serverless functions). Migrations first, code second: new code that needs a table errors without it, while old code ignores tables it does not know about. Never use `prisma migrate dev` or `migrate reset` against production. On Windows PowerShell the inline `DATABASE_URL="..." cmd` form does not work; use the copy-paste runbook in [docs/feedback-guide.md](docs/feedback-guide.md), which also keeps the connection string out of shell history and out of files. Use a direct or session-mode connection (port 5432) for migrations, not a transaction-mode pooler (port 6543); this is commonly recommended but unverified here, so check the Supabase docs.

The profile settings and feedback release adds three migrations, applied in this order:

1. `20260930111956_profile_settings_feedback`: tables `PasswordChangeCode` and `Feedback` (with Row Level Security enabled, no policies).
2. `20260930112045_username_case_insensitive_unique`: unique index on `lower(username)`. It fails if two usernames differ only by case, so run the pre-flight query in the guide first.
3. `20260930211216_revoke_public_api_roles_new_tables`: revokes the Supabase `anon`/`authenticated` grants on the two new tables (a no-op on plain Postgres).

They are applied to the maintainer's dev/staging database and to local Docker Postgres. Production may be a different database and is not migrated until you do it; [docs/feedback-guide.md](docs/feedback-guide.md) section 3 covers how to check that, the pre-flight SQL, `prisma migrate status` and `migrate deploy`, post-deploy checks and rollback. That guide also has an RLS audit query to run on every Supabase project, because no migration enables Row Level Security on the older tables.

### Manual deploy and rollback

- Manual deploy: Vercel dashboard, Deployments tab, redeploy the latest (or a specific) commit.
- Rollback: Vercel dashboard, Deployments tab, pick a previous successful deployment and promote it to production. This restores the previous build only. It does not undo database migrations, so keep migrations backward compatible.

## Troubleshooting

- **Cannot reach the app at localhost:3000 with `docker compose up`:** the container listens on 10000 and compose maps `3000:10000`. If you edited the mapping, restore it.
- **Prisma cannot connect locally:** confirm `.env` uses port `5433` and `docker compose ps` shows the db as healthy.
- **Port 5433 already in use:** stop whatever holds it. Do not switch to 5432.
- **Tables or columns missing in production:** migrations were not applied. Run `npm run db:deploy` against the production DB.
- **Sign-in fails in production:** check `AUTH_SECRET`, `AUTH_TRUST_HOST=true` and `NEXT_PUBLIC_APP_URL` in the Vercel project's environment variables.
- **"We could not send the code" or "We could not send the verification email" in production:** `RESEND_API_KEY` or `EMAIL_FROM` is missing in Vercel, or `EMAIL_FROM` is not a sender verified in Resend. Fix the variables and redeploy.
- **"Continue with Google" (or any Server Action) fails with `UnrecognizedActionError: Server Action "..." was not found on the server`:** `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is missing or was changed on the latest build, so previously issued Server Action IDs no longer decrypt. Set it as a stable build-time env var and redeploy — see "Environment variables" above. Existing open tabs from before the fix still need a hard reload.
- **CI fails on format:** run `npm run format` and commit.
- **Build fails after schema change:** run `npm run db:generate`.

## Security notes

- Never commit `.env` or real secrets. `.env.example` holds placeholders only.
- Generate a strong `AUTH_SECRET` per environment. The values in `docker-compose.yml` and the Dockerfile are local/build-time placeholders only.
- The auth boundary is `requireUser()` in the `(app)` layout. Middleware only does a cookie-presence check for faster redirects.
- Sessions are JWTs and cannot be revoked server-side on demand. Instead, a password reset or change stamps `User.passwordUpdatedAt`, and any session whose token predates it is signed out on its next request. The device that made a password change keeps its session.
- Passwords are hashed with Argon2id.
- localStorage-backed features (Nutrition, Body, AI Coach) store data unencrypted in the browser and are not synced across devices.
- Emails (sign-up codes, password-reset links, password-change codes, the welcome email) go through Resend. In production, if `RESEND_API_KEY` or `EMAIL_FROM` is missing, sending fails closed and codes and links are never logged.
- The in-memory rate limiter (`src/lib/auth/rate-limit.ts`) is per serverless instance on Vercel, so it is best-effort only. The database-backed limits (code issuance, code attempts, feedback) are the ones that hold across instances.
- Restrict production database access and keep `DATABASE_URL` only in the Vercel project's Environment Variables (never in `NEXT_PUBLIC_*`).
- If Postgres is hosted on Supabase, tables in the `public` schema can be reachable through Supabase's REST API with the project's anon key unless Row Level Security is enabled on them. The app is expected to connect as the `postgres` role, which bypasses RLS, so it is unaffected either way (the guide shows how to confirm the role in your `DATABASE_URL`). Run the RLS audit in [docs/feedback-guide.md](docs/feedback-guide.md) section 4 on every Supabase project. No migration in this repo enables RLS on the older tables.
