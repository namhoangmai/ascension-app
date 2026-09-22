# USER.md

A map of every page a user can navigate to and every action they can take on it, as of the current build. Everyone gets the same access today — there is no subscription/paywall logic anywhere in the app yet.

**Tier column key:**
- `Free` — will stay free after subscriptions ship (my current best guess, not a firm decision)
- `Free (current)` — available to everyone today; a plausible candidate to move behind a paywall later, not yet decided
- Nothing is actually gated right now — every row below is reachable by any signed-in user regardless of tier.

Update the Tier column when subscription gating is actually designed — this file only tracks what exists today.

---

## Public / unauthenticated

| Page | Route | What's there | Actions | Tier |
| --- | --- | --- | --- | --- |
| Landing | `/` | Marketing/landing view. Redirects signed-in users straight to Dashboard. | Go to Sign up, Go to Sign in | Free |
| Sign up | `/sign-up` | Create-account form | Create account with name/email/password; "Remember this device" checkbox; continue with Google (OAuth); redirects to email verification if required | Free |
| Sign in | `/sign-in` | Sign-in form | Sign in with email-or-username + password; "Remember me"; continue with Google (OAuth); link to Forgot password; redirects to email verification if required | Free |
| Verify email | (inline step on sign-up/sign-in) | 6-digit code entry | Submit verification code; resend code (60s cooldown); go back and use a different email | Free |
| Forgot password | `/forgot-password` | Request a reset link | Submit email to request a password-reset link | Free |
| Reset password | `/reset-password` | Set a new password from a reset link | Submit new password | Free |

## Authenticated — onboarding

| Page | Route | What's there | Actions | Tier |
| --- | --- | --- | --- | --- |
| Profile setup | `/profile/setup` | First-run intake form (also reused for editing, via `?edit=1`) | Set profile photo, name, username, DOB, gender, height/weight, main fitness goal, training experience/frequency/style, target weight, bio | Free |

A signed-in user with an incomplete profile is required to finish this before reaching the app shell (`requireUser()` + profile-completion check in `(app)/layout.tsx`).

## Authenticated — main app (inside the app shell, bottom/side nav)

| Page | Route | What's there | Actions | Tier |
| --- | --- | --- | --- | --- |
| Dashboard | `/dashboard` | Weekly session count vs. target, current weight vs. goal, focus/experience summary, profile-completion %, last workout summary, nutrition snapshot, quick links into other features | Read-only overview; links out to Strength/Nutrition/Body/AI Coach | Free (current) |
| Strength | `/strength` | Workout session log (Prisma-backed — the one live server-persisted product feature besides auth/profile) | Start/log a workout session, add exercises and sets (weight/reps/completed), save session ("continue" or "end"), resume an in-progress session, cancel an in-progress session, delete a past session, use/save workout templates (localStorage) | Free (current) |
| Strength → exercise detail | `/strength/exercises/[exerciseName]` | Per-exercise history and progress graphs (localStorage-sourced — see note below) | View charts and past sets for one exercise | Free (current) |
| Nutrition | `/nutrition` | Daily calorie/macro tracker (localStorage) | Pick a date, quick-log a food by grams, view/edit daily macro goals, view calories remaining, delete a logged item, jump to "Log food" | Free (current) |
| Nutrition → log food | `/nutrition/log-food` | Food database + meal builder (localStorage) | Create/edit/delete custom foods (with optional photo), browse the seeded Dutch food database by category, build and save a meal from multiple foods, log a saved meal in one action | Free (current) |
| AI Coach | `/ai-coach` | Rule-based coaching (no LLM call; reads other domains' localStorage per a permission toggle) | View insights, AI meal plan (shopping list, meal-prep suggestions, rationale), workout recommendation, weekly consistency report, AI chat, set dietary/workout preferences and available equipment | Free (current) |
| Body | `/body` | Body progress tracking (localStorage, photos AES-GCM encrypted client-side) | Add a check-in (weight, measurements, mood), add a private journal entry, upload/compare progress photos, view weight trend chart, view latest measurements/journal/photos | Free (current) |
| Analytics | `/analytics` | Placeholder ("Phase 10" — not implemented) | None yet | — |
| Workouts | `/workouts` | Placeholder ("Phase 3" — program/schedule builder, not implemented) | None yet | — |
| Profile | `/profile` | Read view of the user's own profile + completion % | Edit profile (links to `/profile/setup?edit=1`) | Free (current) |
| Settings | `/settings` | Account/security settings | Change password (or set one, if the account only has Google OAuth) | Free (current) |
| Sign out | (button in app header) | — | Sign out of the current session | Free |

---

## Notes for subscription-gating planning

- **No gating exists yet** — this is purely an inventory of today's all-access state, to use as a checklist when tiering is actually designed.
- **Prisma-backed vs. localStorage-only matters for gating design**: Strength's session log (and auth/profile) are server-persisted and enforce ownership server-side; Nutrition, Body, and AI Coach are 100% client-side `localStorage` with no server involvement at all. A `localStorage` feature can't be server-gated the same way (there's no request to intercept) — it would need a client-side entitlement check instead, which is weaker than a server check. See [ARCHITECTURE_ESSENTIALS.md](ARCHITECTURE_ESSENTIALS.md) for the full breakdown of what's actually live vs. schema-only.
- **The real auth boundary is `requireUser()`** in [src/app/(app)/layout.tsx](src/app/(app)/layout.tsx), not `src/middleware.ts`. Any future subscription check should hook in near there (or per-feature) rather than relying on the middleware.
- `/analytics` and `/workouts` are unbuilt placeholders — worth deciding their tier before they're built rather than after.
