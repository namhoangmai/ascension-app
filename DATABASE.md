# Database guide

This app has **two separate "databases"** in practice, not one. Which domain uses which is not obvious from the Prisma schema alone — several models are defined but unused. See [ARCHITECTURE_ESSENTIALS.md](ARCHITECTURE_ESSENTIALS.md) for the full gotcha list this file summarizes the access side of.

| #   | Store                                            | Backs                                                                          | Live? |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------ | ----- |
| 1   | PostgreSQL via Prisma                            | Auth, user profile, Strength session log, password-change codes, user feedback | Yes   |
| 2   | Browser `localStorage` (per-device, per-browser) | Nutrition, Body tracking, AI Coach, Strength templates/draft                   | Yes   |

Supabase is not a third store the app talks to: there is no Supabase code path in `src/`, and its env vars are unused placeholders (see below). But Supabase can **host the Postgres** in #1 (the maintainer's dev/staging database does), and then its dashboard is how you browse the data and its REST API is something you have to secure (Row Level Security). See [docs/feedback-guide.md](docs/feedback-guide.md).

---

## 1. PostgreSQL (Prisma) — the real database

### Where it lives

- **Schema**: [prisma/schema.prisma](prisma/schema.prisma)
- **Migrations**: [prisma/migrations/](prisma/migrations/) (7, in order: `phase_1_initial`, `phase_2_auth`, `user_profile_onboarding`, `email_verification_codes`, `profile_settings_feedback`, `username_case_insensitive_unique`, `revoke_public_api_roles_new_tables`). All 7 are applied to local Docker Postgres and to the maintainer's dev/staging Supabase database. Production may be a different database and is not migrated until someone runs `migrate deploy` there (see the runbook in [docs/feedback-guide.md](docs/feedback-guide.md)).
- **Client singleton**: [src/lib/db/prisma.ts](src/lib/db/prisma.ts) — `PrismaClient` with the `@prisma/adapter-pg` driver adapter over `pg`, reading `DATABASE_URL`
- **Local runtime**: `docker compose up -d db` → [docker-compose.yml](docker-compose.yml), Postgres 16 in a container named `ascension-postgres`

### Connection details (local dev)

```
Host (from your machine):        localhost
Port (from your machine):        5433   ← NOT 5432, intentional (avoids colliding with a local Postgres install)
Port (container-to-container):   5432   (inside docker-compose, app→db uses 5432 internally)
User:                            postgres
Password:                        postgres
Database name:                   ascension
```

Connection string (from [.env.example](.env.example)):

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ascension?schema=public
DIRECT_URL=postgresql://postgres:postgres@localhost:5433/ascension?schema=public
```

Copy `.env.example` to `.env` and fill in real secrets (`AUTH_SECRET`, etc.) — `DATABASE_URL`/`DIRECT_URL` already point at the local Docker container out of the box.

**Check your own `.env`.** Only `DATABASE_URL` is read (by `prisma.config.ts` and `src/lib/db/prisma.ts`); `DIRECT_URL` is not used by any code. The maintainer's `.env` `DATABASE_URL` points at the **dev/staging Supabase** project (a pooler host on port 5432), not the Docker container above, so `npm run dev`, `db:migrate`, `db:deploy` and `db:studio` all act on dev/staging there. `prisma migrate dev` against a remote database can offer to reset it on drift: never accept that.

### How to access it

**A. Through the app** — the only way product code talks to Postgres:

```bash
docker compose up -d db
npm install
npm run db:generate   # generates the Prisma client from schema.prisma
npm run db:migrate     # applies migrations (dev)
npm run dev
```

All reads/writes go through Server Actions (`actions.ts` → `server.ts` in `src/features/<domain>/`) using the `prisma` export from [src/lib/db/prisma.ts](src/lib/db/prisma.ts). There are no REST/GraphQL routes for product data.

**B. Prisma Studio** (GUI browser for the tables):

```bash
npm run db:studio     # same as `npx prisma studio`
```

Opens at `http://localhost:5555`, reads `DATABASE_URL` from `.env` — so it shows whichever database `.env` points at (dev/staging Supabase on the maintainer's machine, see above). Studio can edit and delete rows.

**C. `psql` / any Postgres client** directly against the container:

```bash
docker exec -it ascension-postgres psql -U postgres -d ascension
```

or from the host, if you have a `psql` client installed:

```bash
psql "postgresql://postgres:postgres@localhost:5433/ascension?schema=public"
```

**D. Any GUI client** (TablePlus, DBeaver, pgAdmin, etc.) — use the connection details table above.

**E. Supabase dashboard** (only for databases hosted on Supabase, i.e. dev/staging and possibly production): **Table Editor** (schema `public`; table and column names are case-sensitive quoted identifiers such as `"Feedback"` and `"createdAt"`) and **SQL Editor**. This is how you read user feedback, since the app has no admin view. Ready-made queries, the production rollout runbook and an RLS audit are in [docs/feedback-guide.md](docs/feedback-guide.md).

### What's actually stored here vs. schema-only

Not every model in `schema.prisma` has live code reading/writing it. Confirmed **live** (has real Server Action callers):

- `User`, `Account`, `Session`, `VerificationToken`, `PasswordResetToken`, `EmailVerificationCode`, `PasswordChangeCode`, `Authenticator` — Auth.js + custom auth flows (isolated behind `src/lib/auth/**`). `Session` rows are unused under JWT sessions. `PasswordChangeCode` holds the emailed 6-digit codes for changing or setting a password from `/profile` (only an HMAC of the code is stored; 10-minute lifetime, 5 attempts per code).
- `Feedback` — user-submitted Feedback/Recommendation messages from the last section of `/profile` (`src/features/feedback/`). Submit-only: no in-app reader, you query it in Supabase. See below.
- `UserProfile` — onboarding intake, and the username/date of birth edited in `/profile` Settings
- `UserPreference` — created empty at signup, not editable in UI yet
- `WorkoutSession`, `SessionExercise`, `WorkoutSet`, `ProgressiveOverloadSuggestion` — Strength's session log (`/strength` list/save/delete)
- `Exercise`, `ExerciseSecondaryMuscle`, `ExerciseRestPreference` — auto-created per free-text exercise name typed into a workout

Defined in the schema but **schema-only / not read or written by any code path today**:

- `WorkoutProgram`, `WorkoutDay`, `ProgramSchedule`, `WorkoutDayExercise` — workout planning/scheduling, nothing built on it
- `NutritionGoal`, `Food`, `FoodLog`, `SavedMeal`, `SavedMealItem` — Nutrition is 100% `localStorage` in practice (see below)
- `BodyMetric`, `BodyMeasurement`, `BodyPhoto` — Body tracking is 100% `localStorage` in practice (see below)

Don't assume a model being in `schema.prisma` means the feature is database-backed — check `src/features/<domain>/` for `server.ts` + `actions.ts` (Prisma-backed) vs. `client-store.ts` (localStorage-backed) first.

### Added by the profile settings and feedback release

| Object                           | Kind                                                                   | Migration                                           | Notes                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PasswordChangeCode`             | table                                                                  | `20260930111956_profile_settings_feedback`          | `id`, `userId` (FK to `User`, cascade delete), `codeHash`, `salt`, `attempts` (default 0), `expiresAt`, `usedAt`, `createdAt`. Indexes on `(userId, createdAt)` and `(expiresAt)`. RLS enabled, no policies. Used and expired rows are never purged.                                                                                               |
| `Feedback`                       | table                                                                  | same                                                | `id`, `userId` (FK to `User`, cascade delete), `category`, `message` (text), `status` (default `NEW`), `createdAt`, `updatedAt`. Indexes on `(userId, createdAt)` and `(status, createdAt)`. RLS enabled, no policies. `updatedAt` is set by the Prisma client, there is no database trigger.                                                      |
| `FeedbackCategory`               | enum                                                                   | same                                                | `FEEDBACK`, `RECOMMENDATION`                                                                                                                                                                                                                                                                                                                       |
| `FeedbackStatus`                 | enum                                                                   | same                                                | `NEW`, `REVIEWED`, `ARCHIVED`                                                                                                                                                                                                                                                                                                                      |
| `UserProfile_username_lower_key` | unique partial index on `lower(username)` where `username IS NOT NULL` | `20260930112045_username_case_insensitive_unique`   | Makes `Bob` and `bob` collide, as a race backstop to the app's own case-insensitive check. The migration fails if existing usernames already collide that way. Not declared in `schema.prisma` (Prisma cannot express it); `prisma migrate diff` of the local database against `schema.prisma` is empty, so Prisma neither drops nor recreates it. |
| Revoked privileges               | `REVOKE ALL` on the two new tables from `anon` and `authenticated`     | `20260930211216_revoke_public_api_roles_new_tables` | Guarded: a no-op on plain Postgres (local Docker, CI) where those roles do not exist.                                                                                                                                                                                                                                                              |

**Row Level Security** is enabled (with no policies) only on `PasswordChangeCode` and `Feedback`. No migration enables it on the older tables, so on a Supabase-hosted database those may be reachable through Supabase's REST API with the project's anon key. The app itself connects as `postgres`, which bypasses RLS, so it is unaffected either way. Run the audit query in [docs/feedback-guide.md](docs/feedback-guide.md) section 4 on every Supabase project and decide what to lock down.

### Reading feedback

Feedback is stored in `"Feedback"` and read directly in Supabase (Table Editor or SQL Editor), not in the app. Quote the identifiers: `"Feedback"`, `"createdAt"`, `"userId"`. For a newest-first list joined to the sender's email and username, status updates and counts, use the queries in [docs/feedback-guide.md](docs/feedback-guide.md) section 2. Deleting a `User` cascades to that user's feedback, and the joined output contains emails, so treat it as personal data.

### Schema changes

```bash
# after editing prisma/schema.prisma:
npm run db:migrate      # generates + applies a new migration in dev
npm run db:generate      # regenerates the Prisma client types
npm run build             # prisma generate && next build — run if you touched schema.prisma
```

No CI pipeline applies migrations automatically — CI runs `db:generate` only.

---

## 2. Browser `localStorage` — client-side "databases"

These are **not a real database**: no server, no shared access across devices/browsers, and cleared if the user clears site data. Each domain owns a `client-store.ts` with plain functions wrapping `localStorage`, validating everything read back out with a hand-written type guard (e.g. `isStrengthWorkout`) before trusting it.

### Where it lives (source)

| Domain                                                                      | File                                                                             | Storage keys                                                                                                                                                                   |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nutrition                                                                   | [src/features/nutrition/client-store.ts](src/features/nutrition/client-store.ts) | `nutrition.foodLog.v2`, `nutrition.foodDatabase.v2`, `nutrition.savedMeals.v1`, `nutrition.macroGoals.v1`, `nutrition.foodOverrides.v1`, `nutrition.deletedFoodIds.v1`         |
| Body tracking                                                               | [src/features/body/client-store.ts](src/features/body/client-store.ts)           | `bodyProgress.checkIns.v1`, `bodyProgress.photos.v1`, `bodyProgress.journal.v1`, `bodyProgress.checkInDraft.v1`, `bodyProgress.journalDraft.v1`, `bodyProgress.photoSecret.v1` |
| AI Coach                                                                    | [src/features/ai/client-store.ts](src/features/ai/client-store.ts)               | `aiCoach.profile.v1`, `aiCoach.chat.v1`                                                                                                                                        |
| Strength (templates/draft only — session log itself is Postgres, see above) | [src/features/strength/client-store.ts](src/features/strength/client-store.ts)   | `strength.workouts.v1`\*, `strength.templates.v1`, `strength.activeDraft.v1`                                                                                                   |

\* `strength.workouts.v1` is a separate, non-authoritative localStorage copy used by the `/strength/exercises/[name]` detail page — it is **not** guaranteed to match what's actually saved in Postgres via the session-log Server Actions. This mismatch is a known gap, not a bug you should silently "fix" without checking with whoever's driving that work.

Body photos add a client-side AES-GCM encryption layer — both the encryption key and ciphertext are stored in `localStorage` (`bodyProgress.photoSecret.v1` + the photo record). This protects against casual inspection or server-side exposure, not against XSS on the same origin.

### How to access it

There's no CLI or server tool for this — it only exists inside a specific user's browser profile.

**A. Browser DevTools (any Chromium/Firefox browser), while the app is open:**

1. Open DevTools (F12) → **Application** tab (Chrome/Edge) or **Storage** tab (Firefox)
2. Expand **Local Storage** → select the app's origin (e.g. `http://localhost:3000`)
3. Keys/values are listed there; each value is a JSON string — use "Copy value" then pretty-print it, or run in the DevTools Console:
   ```js
   JSON.parse(localStorage.getItem("nutrition.foodLog.v2"));
   ```

**B. From the app's own Console**, for any key above:

```js
localStorage.getItem("strength.templates.v1");
```

**C. In code**, import the relevant `client-store.ts` functions rather than touching `localStorage` directly — they already do the JSON parsing, validation, and versioning.

There is no seed/import/export tooling for this data today; it lives and dies with the browser profile that created it.

---

## Not a database in this app (env placeholders only)

`.env.example` includes a few env vars that suggest additional data stores but currently have **no code path** using them — don't assume connecting to these will do anything:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — labeled "implemented in body photo phase" but no `supabase` import exists anywhere in `src/`; Body photos actually use the localStorage + AES-GCM approach described above.
- `OPENAI_API_KEY` — labeled "AI meal suggestions"; the live AI Coach is rule-based with no LLM call anywhere in the code.

The one real external data source outside Postgres/localStorage is a **proxy, not a database**: [src/app/api/nutrition/fatsecret/food/route.ts](src/app/api/nutrition/fatsecret/food/route.ts) calls the FatSecret API server-side (keeping `FATSECRET_ACCESS_TOKEN` off the client) and the result is merged into the Nutrition `localStorage` store — it is never written to the `Food` Prisma table.
