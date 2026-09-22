# Database guide

This app has **two separate "databases"** in practice, not one. Which domain uses which is not obvious from the Prisma schema alone — several models are defined but unused. See [ARCHITECTURE_ESSENTIALS.md](ARCHITECTURE_ESSENTIALS.md) for the full gotcha list this file summarizes the access side of.

| # | Store | Backs | Live? |
|---|-------|-------|-------|
| 1 | PostgreSQL via Prisma | Auth, user profile, Strength session log | Yes |
| 2 | Browser `localStorage` (per-device, per-browser) | Nutrition, Body tracking, AI Coach, Strength templates/draft | Yes |

A third thing — Supabase — appears only as unused env var placeholders (see below); there is no Supabase code path in `src/`.

---

## 1. PostgreSQL (Prisma) — the real database

### Where it lives

- **Schema**: [prisma/schema.prisma](prisma/schema.prisma)
- **Migrations**: [prisma/migrations/](prisma/migrations/) (4 applied: `phase_1_initial`, `phase_2_auth`, `user_profile_onboarding`, `email_verification_codes`)
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
npx prisma studio
```
Opens at `http://localhost:5555`, reads `DATABASE_URL` from `.env`.

**C. `psql` / any Postgres client** directly against the container:
```bash
docker exec -it ascension-postgres psql -U postgres -d ascension
```
or from the host, if you have a `psql` client installed:
```bash
psql "postgresql://postgres:postgres@localhost:5433/ascension?schema=public"
```

**D. Any GUI client** (TablePlus, DBeaver, pgAdmin, etc.) — use the connection details table above.

### What's actually stored here vs. schema-only

Not every model in `schema.prisma` has live code reading/writing it. Confirmed **live** (has real Server Action callers):

- `User`, `Account`, `Session`, `VerificationToken`, `PasswordResetToken`, `EmailVerificationCode`, `Authenticator` — Auth.js + custom auth flows (isolated behind `src/lib/auth/**`)
- `UserProfile` — onboarding intake
- `UserPreference` — created empty at signup, not editable in UI yet
- `WorkoutSession`, `SessionExercise`, `WorkoutSet`, `ProgressiveOverloadSuggestion` — Strength's session log (`/strength` list/save/delete)
- `Exercise`, `ExerciseSecondaryMuscle`, `ExerciseRestPreference` — auto-created per free-text exercise name typed into a workout

Defined in the schema but **schema-only / not read or written by any code path today**:

- `WorkoutProgram`, `WorkoutDay`, `ProgramSchedule`, `WorkoutDayExercise` — workout planning/scheduling, nothing built on it
- `NutritionGoal`, `Food`, `FoodLog`, `SavedMeal`, `SavedMealItem` — Nutrition is 100% `localStorage` in practice (see below)
- `BodyMetric`, `BodyMeasurement`, `BodyPhoto` — Body tracking is 100% `localStorage` in practice (see below)

Don't assume a model being in `schema.prisma` means the feature is database-backed — check `src/features/<domain>/` for `server.ts` + `actions.ts` (Prisma-backed) vs. `client-store.ts` (localStorage-backed) first.

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

| Domain | File | Storage keys |
|---|---|---|
| Nutrition | [src/features/nutrition/client-store.ts](src/features/nutrition/client-store.ts) | `nutrition.foodLog.v2`, `nutrition.foodDatabase.v2`, `nutrition.savedMeals.v1`, `nutrition.macroGoals.v1`, `nutrition.foodOverrides.v1`, `nutrition.deletedFoodIds.v1` |
| Body tracking | [src/features/body/client-store.ts](src/features/body/client-store.ts) | `bodyProgress.checkIns.v1`, `bodyProgress.photos.v1`, `bodyProgress.journal.v1`, `bodyProgress.checkInDraft.v1`, `bodyProgress.journalDraft.v1`, `bodyProgress.photoSecret.v1` |
| AI Coach | [src/features/ai/client-store.ts](src/features/ai/client-store.ts) | `aiCoach.profile.v1`, `aiCoach.chat.v1` |
| Strength (templates/draft only — session log itself is Postgres, see above) | [src/features/strength/client-store.ts](src/features/strength/client-store.ts) | `strength.workouts.v1`*, `strength.templates.v1`, `strength.activeDraft.v1` |

\* `strength.workouts.v1` is a separate, non-authoritative localStorage copy used by the `/strength/exercises/[name]` detail page — it is **not** guaranteed to match what's actually saved in Postgres via the session-log Server Actions. This mismatch is a known gap, not a bug you should silently "fix" without checking with whoever's driving that work.

Body photos add a client-side AES-GCM encryption layer — both the encryption key and ciphertext are stored in `localStorage` (`bodyProgress.photoSecret.v1` + the photo record). This protects against casual inspection or server-side exposure, not against XSS on the same origin.

### How to access it

There's no CLI or server tool for this — it only exists inside a specific user's browser profile.

**A. Browser DevTools (any Chromium/Firefox browser), while the app is open:**
1. Open DevTools (F12) → **Application** tab (Chrome/Edge) or **Storage** tab (Firefox)
2. Expand **Local Storage** → select the app's origin (e.g. `http://localhost:3000`)
3. Keys/values are listed there; each value is a JSON string — use "Copy value" then pretty-print it, or run in the DevTools Console:
   ```js
   JSON.parse(localStorage.getItem("nutrition.foodLog.v2"))
   ```

**B. From the app's own Console**, for any key above:
```js
localStorage.getItem("strength.templates.v1")
```

**C. In code**, import the relevant `client-store.ts` functions rather than touching `localStorage` directly — they already do the JSON parsing, validation, and versioning.

There is no seed/import/export tooling for this data today; it lives and dies with the browser profile that created it.

---

## Not a database in this app (env placeholders only)

`.env.example` includes a few env vars that suggest additional data stores but currently have **no code path** using them — don't assume connecting to these will do anything:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — labeled "implemented in body photo phase" but no `supabase` import exists anywhere in `src/`; Body photos actually use the localStorage + AES-GCM approach described above.
- `OPENAI_API_KEY` — labeled "AI meal suggestions"; the live AI Coach is rule-based with no LLM call anywhere in the code.

The one real external data source outside Postgres/localStorage is a **proxy, not a database**: [src/app/api/nutrition/fatsecret/food/route.ts](src/app/api/nutrition/fatsecret/food/route.ts) calls the FatSecret API server-side (keeping `FATSECRET_ACCESS_TOKEN` off the client) and the result is merged into the Nutrition `localStorage` store — it is never written to the `Food` Prisma table.
