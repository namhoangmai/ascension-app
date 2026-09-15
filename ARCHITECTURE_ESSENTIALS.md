# Ascension — Essentials

> Full detail in `ARCHITECTURE.md` — read that before making a structural change; this file is for quick orientation only.

## Tech stack (one line each)

| Choice                                    | Why                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| Next.js 15 App Router, React 19           | Server-first rendering, small client bundles                             |
| Auth.js v5 beta + `@auth/prisma-adapter`  | Stack requirement; isolated behind `src/lib/auth/*` to contain beta risk |
| JWT sessions                              | Hard Auth.js v5 constraint for credentials login (no DB sessions)        |
| Argon2id (`argon2`)                       | Password hashing; `bcryptjs` is installed but **unused**                 |
| Prisma 7 + `@prisma/adapter-pg` over `pg` | Driver-adapter style, not the classic query engine                       |
| PostgreSQL 16 (Docker locally)            | Relational integrity, `Decimal` for nutrition/weight math                |
| Zod + react-hook-form                     | Auth + profile forms only — not used in Strength/Nutrition/Body stores   |
| Tailwind + shadcn conventions             | Dark-first UI system                                                     |
| `zustand`                                 | **Installed, imported nowhere** — no shared client store exists          |
| `next-pwa`                                | Asset caching/installability only — **no offline write queue**           |

## Data model — domain map, not a field list

- **Auth**: `User` → `Account`/`Session`/`Authenticator` (Auth.js) + `PasswordResetToken` (custom) + `UserProfile` (1:1 intake) + `UserPreference` (created empty at signup, not editable in UI).
- **Workouts (planning)**: `WorkoutProgram → WorkoutDay → {ProgramSchedule, WorkoutDayExercise}`. **Schema only — nothing reads/writes this.**
- **Workouts (session log)**: `WorkoutSession → SessionExercise → WorkoutSet`, `ProgressiveOverloadSuggestion` attached to sessions/exercises. **Prisma-backed and live** — the one exception to "features are client-only." `SessionExercise` snapshots exercise name/muscle/equipment/category so history survives later edits.
- **Exercises**: `Exercise` (seeded-public or user-private via `sourceKey`). Auto-created per free-text name typed into a workout (crude, no true dedup) — the "proper" ownership-guard repo for this exists and is unused.
- **Nutrition**: `NutritionGoal`, `Food`, `FoodLog`, `SavedMeal`/`SavedMealItem`. **Schema only — 100% localStorage in practice** (`nutrition.*.v1/v2` keys), 10-item hardcoded Dutch seed list. One live server bit: `/api/nutrition/fatsecret/food` proxy (result merges into localStorage, not the `Food` table).
- **Body**: `BodyMetric → BodyMeasurement`, `BodyPhoto`. **Schema only — 100% localStorage**, with a real client-side AES-GCM encryption layer for photos (key + ciphertext both in localStorage — protects against casual inspection/server exposure, not XSS).
- **AI Coach**: no DB presence at all. Rule-based (no LLM call anywhere), reads other domains' localStorage per a permission toggle.

## Decisions that would bite someone who didn't know

1. **Strength is a hybrid, not client-only.** Session log (`/strength` list, save, delete) is Prisma-backed via server actions. Templates, the in-progress draft, and the `/strength/exercises/[name]` detail page are still `localStorage`-only — and the detail page reads a _different_ localStorage source than the Prisma-backed list, so its PRs/charts are not guaranteed to reflect what's actually saved to the database.
2. **Nutrition, Body, and AI Coach have zero Prisma involvement** despite full schema support existing for Nutrition and Body. Don't assume `docs/phase-1-architecture.md`'s "computed analytics from indexed tables" plan is reachable yet — there's nothing indexed to compute from in those domains.
3. **`requireUser()` in `(app)/layout.tsx` is the real security boundary**, not `src/middleware.ts` (cookie-presence check only, and its route list is missing `/strength`/`/ai-coach` — cosmetic gap, not a security one).
4. **JWT sessions can't be revoked directly** — password reset works around this via `passwordUpdatedAt` staleness-checking in `requireUser()`, plus deleting all `Session` rows on reset.
5. **No offline write queue exists.** `docs/offline-write-queue.md` is a design doc only — no IndexedDB, no `clientMutationId`, anywhere in `src/`. A failed save today falls back to the separate draft-autosave-to-localStorage mechanism, not a queue.
6. **`saveStrengthWorkout()` deletes and fully recreates all `SessionExercise`/`WorkoutSet` rows on every save** (no diffing, no per-set granularity) — fine for one device, a real conflict risk across two devices/tabs with no optimistic-concurrency check.
7. **Auto-created exercises have no dedup beyond exact slug match** — "Bench Press" vs "Barbell Bench Press" fragment one user's real history across unrelated `Exercise` rows.
8. **Migration host-port is intentionally `5433`, not Postgres's default `5432`**, to avoid colliding with a local Windows Postgres install (`docs/migration-stability.md` — this was a real incident). Container-to-container traffic still uses `5432` internally.
9. **No automated pipeline actually applies migrations** — CI runs `db:generate` only, never `db:migrate`/`db:deploy`, even against its own ephemeral Postgres service.
10. **`zustand` and `bcryptjs` are dead dependencies** — installed, never imported. Don't assume either is doing anything.

## Known risks not yet fixed

See `ARCHITECTURE.md`'s **Known Risks & Open Questions** section for the full list (concurrency across devices, timezone handling in the still-unused scheduling tables, exercise-history fragmentation, the encryption layer's actual threat model, and where `docs/`/the vault are stale — most notably the vault's `Strength`/`Dashboard Page` notes, which predate Strength going Prisma-backed).
