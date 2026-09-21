# Ascension

Ascension is a fitness-tracking web app built with Next.js 15 (App Router, React 19).

- Auth, user profiles and the Strength workout log are stored in PostgreSQL through Prisma and Server Actions.
- Nutrition, Body tracking and the AI Coach are client-side only. They keep their data in the browser's `localStorage`. The Prisma schema has models for them, but the running app does not use those models.

## Tech stack

- Next.js 15, React 19, TypeScript
- Tailwind CSS, shadcn/ui-style components
- PostgreSQL 16 with Prisma 7
- Auth.js v5 (beta) with JWT sessions and Argon2id password hashing
- Zod validation, Recharts, Motion
- Docker (multi-stage, `output: "standalone"`), GitHub Actions, Render

## Features

- **Authentication and profile:** sign up, sign in, password reset, profile setup.
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

Check the database with `docker compose ps` and `docker compose logs -f db`.

### Run the full stack with Docker Compose

```bash
docker compose up --build
```

The Dockerfile makes the app listen on `PORT=10000` (the port Render uses). Compose maps host `3000` to container `10000`, so open http://localhost:3000. Inside the compose network the app talks to Postgres at `db:5432`. The compose file contains local-only development credentials and secret.

You need to apply migrations to the compose database yourself. The runtime image does not include the Prisma CLI. From the host, run `npm run db:deploy` with `DATABASE_URL` pointing at `localhost:5433` (the default in `.env`).

### Verify before committing

```bash
npm run verify   # typecheck + lint + format:check, same as CI
npm run format   # auto-fix formatting
npm run build    # also run this after touching prisma/schema.prisma
```

There is no automated test suite in this repo.

### Project layout

- `src/app/(app)/**`, `src/app/(auth)/**`: pages and layouts. The `(app)` layout calls `requireUser()`, which is the real auth boundary.
- `src/app/api/**`: NextAuth handlers, `/api/health`, and a server-only FatSecret proxy.
- `src/components/**`: UI components, with `ui/` for primitives.
- `src/features/<domain>/`: domain logic (Prisma-backed or localStorage client stores).
- `src/lib/auth/**`: all Auth.js usage.
- `prisma/`: schema and migrations.
- `docs/`: design notes. See also `ARCHITECTURE_ESSENTIALS.md` and `ARCHITECTURE.md`.

## Deploy

Every push to GitHub triggers automation:

1. **CI** (`.github/workflows/ci.yml`) runs on every pull request and on pushes to `main`. It starts a Postgres service, then runs `npm ci`, `db:generate`, typecheck, lint, format check and `npm run build`. It does not apply migrations.
2. **Render** builds the repository `Dockerfile` and deploys when `main` is pushed (auto-deploy on the Render service). No `render.yaml` exists in this repo, so the service is configured in the Render dashboard. Check that setting there.

### Container

- Dockerfile: multi-stage `node:22-alpine`, runs `node server.js` as a non-root user.
- Port: `10000` (`EXPOSE 10000`, `ENV PORT=10000`). Set the Render service to the same port.
- Health check path: `/api/health`. It returns `{"status":"ok"}` and deliberately does not query the database. A DB check previously caused a Render restart loop.

### Environment variables

Set these in the Render dashboard (names only, never commit values):

- Required: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`
- Optional OAuth: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_FACEBOOK_ID`, `AUTH_FACEBOOK_SECRET`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`
- Optional features: `FATSECRET_ACCESS_TOKEN` (food lookup), `OPENFOODFACTS_BASE_URL`
- Listed in `.env.example` but not read by the current code: `EMAIL_FROM`, `SMTP_*`, `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

`NEXT_PUBLIC_*` values are inlined at build time. The Dockerfile only sets placeholder `DATABASE_URL` and `AUTH_SECRET` for the build. Changing a `NEXT_PUBLIC_*` value requires a rebuild.

### Keep-alive

`.github/workflows/keep-alive.yml` pings the health endpoint every 3 days (and on manual dispatch) to keep a free-tier instance warm. It requires the GitHub repository variable `APP_HEALTH_URL` (Settings, Secrets and variables, Actions, Variables), for example `https://<your-service>.onrender.com/api/health`. Without it the job fails.

### Database migrations in production

Neither CI nor the Docker image applies migrations. Run them against the production database whenever a push adds a migration under `prisma/migrations`:

```bash
DATABASE_URL="<production connection string>" npm run db:deploy   # prisma migrate deploy
```

Do this from a trusted machine or the Render shell, before or right after the deploy. Never use `prisma migrate dev` or `migrate reset` against production.

### Manual deploy and rollback

- Manual deploy: Render dashboard, choose the service, Manual Deploy, Deploy latest commit (or "Clear build cache & deploy").
- Rollback: Render dashboard, Events or Deploys, pick a previous successful deploy and choose Rollback. This restores the previous image only. It does not undo database migrations, so keep migrations backward compatible.

## Troubleshooting

- **Cannot reach the app at localhost:3000 with `docker compose up`:** the container listens on 10000 and compose maps `3000:10000`. If you edited the mapping, restore it.
- **Prisma cannot connect locally:** confirm `.env` uses port `5433` and `docker compose ps` shows the db as healthy.
- **Port 5433 already in use:** stop whatever holds it. Do not switch to 5432.
- **Render deploy loops or restarts:** check the health path is `/api/health` and the service port is 10000.
- **Tables or columns missing in production:** migrations were not applied. Run `npm run db:deploy` against the production DB.
- **Sign-in fails in production:** check `AUTH_SECRET`, `AUTH_TRUST_HOST=true` and `NEXT_PUBLIC_APP_URL`.
- **Keep-alive workflow fails:** `APP_HEALTH_URL` repository variable is missing or wrong.
- **CI fails on format:** run `npm run format` and commit.
- **Build fails after schema change:** run `npm run db:generate`.

## Security notes

- Never commit `.env` or real secrets. `.env.example` holds placeholders only.
- Generate a strong `AUTH_SECRET` per environment. The values in `docker-compose.yml` and the Dockerfile are local/build-time placeholders only.
- The auth boundary is `requireUser()` in the `(app)` layout. Middleware only does a cookie-presence check for faster redirects.
- Sessions are JWTs and cannot be revoked server-side on demand. Password reset invalidates existing sessions.
- Passwords are hashed with Argon2id.
- localStorage-backed features (Nutrition, Body, AI Coach) store data unencrypted in the browser and are not synced across devices.
- Password-reset emails are not sent in production yet, because no email provider is wired up.
- Restrict production database access and keep `DATABASE_URL` only in the Render dashboard.
