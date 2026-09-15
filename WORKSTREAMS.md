# Using agents on Ascension

This repo already defines a five-role split for multi-agent work under
[.agent/agents/](.agent/agents/) (`ORCHESTRATOR`, `BACKEND`, `FRONTEND`,
`TESTING`, `REVIEWER`) and a matching Python scaffold under
[.agent/harness/](.agent/harness/)
(`orchestrator.py`, `agent.py`, `permissions.py`, `verifier.py`). This doc is
the practical guide for actually using that split day-to-day.

## Reality check: the harness doesn't run itself yet

`.agent/harness/agent.py`'s `Agent.step()` raises `NotImplementedError` if
`llm` is `None`, and `Orchestrator` never sets one (`self.llm: LLMProvider |
None = None  # TODO`). So `orchestrator.run_all()` is not something you can
invoke today to get autonomous multi-agent execution — the harness only
gives you `PermissionSet`/`ContextBuilder`/`Verifier` scaffolding for a
runner that doesn't exist yet.

What *does* work today: treating `.agent/agents/<NAME>.md` as prompts for
real Claude Code sessions or subagents (this tool's `Agent` tool, or
separate terminal sessions), and using `AGENT_PERMISSIONS` in
`orchestrator.py` as the source of truth for which paths each role may
touch. That's what the rest of this doc describes.

## The five roles

| Role | Owns | Never touches |
|---|---|---|
| [ORCHESTRATOR](.agent/agents/ORCHESTRATOR.md) | Nothing — reads the task and produces a scoped job breakdown for the other four roles | Never writes to `src/**`, `prisma/**`, or `.agent/**` |
| [BACKEND](.agent/agents/BACKEND.md) | `src/features/**` (server side), `src/lib/**`, `src/app/api/**`, `prisma/*` | `src/components/**`, `src/app/(app)/**`, `src/app/(auth)/**`, `src/styles/**` |
| [FRONTEND](.agent/agents/FRONTEND.md) | `src/app/**` (pages/layouts), `src/components/**`, `src/styles/**`, `src/hooks/**`, client-store halves of `src/features/*` | `prisma/**`, `src/lib/auth/**`, `src/lib/db/**`, `src/app/api/**` |
| [TESTING](.agent/agents/TESTING.md) | Any `*.test.*`/`*.spec.*` file, read access to all of `src/**` | `prisma/migrations/**`, non-test source files (proposes changes back to BACKEND/FRONTEND instead of editing) |
| [REVIEWER](.agent/agents/REVIEWER.md) | Nothing — read-only gate over everyone else's diff | Never writes to `src/**`, `prisma/**`, or `.agent/**` |

All five: never read or write `.env`/`.env.*`; never treat `.agent/**` itself
as a job target.

ORCHESTRATOR and REVIEWER bookend a workstream: ORCHESTRATOR turns a raw task
into scoped jobs before anyone implements, REVIEWER gates the resulting diff
after everyone implements. Neither writes product code.

## Picking a role isn't always "is this UI or server code"

Because most domains here are **client-only despite having Prisma schemas**
(see [ARCHITECTURE_ESSENTIALS.md](ARCHITECTURE_ESSENTIALS.md)), the naive
"data = BACKEND, UI = FRONTEND" split is wrong for most of the app:

- **Nutrition, Body, AI Coach**: 100% `localStorage`. A "add a new nutrition
  field" job is entirely FRONTEND work (`client-store.ts` + the type guard +
  the UI) — there is no BACKEND half, even though `prisma/schema.prisma` has
  full models for `NutritionGoal`/`BodyMetric`/etc. Don't spin up a BACKEND
  job for these unless you're deliberately wiring the schema up for real.
- **Strength is genuinely split**: the session log (`/strength` list, save,
  delete) is Prisma-backed — `actions.ts`/`server.ts` there is BACKEND.
  Templates, the in-progress draft, and `/strength/exercises/[name]` are
  still `localStorage`-only and go to FRONTEND. If a job touches both,
  split it into two jobs rather than letting one role cross the boundary.
- **Auth/profile**: fully BACKEND (`src/lib/auth/**`, `src/features/profile`
  server side) plus a thin FRONTEND job for any form/page changes.

When scoping a job, check the actual file (`server.ts`/`actions.ts` vs
`client-store.ts`) in the domain you're touching before assigning a role —
per [CLAUDE.md](CLAUDE.md), the pattern varies per domain and `strength` has
both.

## Sequencing a workstream

0. **ORCHESTRATOR first.** Hand the raw task to ORCHESTRATOR before assigning
   anyone else. It reads `CLAUDE.md` and `ARCHITECTURE_ESSENTIALS.md`,
   figures out which domain(s) are touched and whether each is Prisma-backed
   or `localStorage`-only, and produces the per-role job list (scope, allowed
   paths, dependency order) that the rest of this section assumes already
   exists. Skip this step only for trivial single-file jobs where the role
   is obvious.
1. **Schema first, if needed.** BACKEND changes `prisma/schema.prisma`,
   generates a migration, runs `npm run db:generate`. Nothing else starts
   until this lands, since FRONTEND/TESTING jobs will reference generated
   types.
2. **BACKEND and FRONTEND in parallel, if the job is genuinely split** (e.g.
   Strength). Hand each its own file list up front so they don't both touch
   `src/features/strength/*` — BACKEND gets `server.ts`/`actions.ts`,
   FRONTEND gets `client-store.ts` and the page/components. If a job is
   single-role (most Nutrition/Body/AI Coach work), skip the parallel step
   entirely.
3. **TESTING** picks up once BACKEND/FRONTEND report done. There's no
   configured test runner yet (no `test` script, no Vitest/Playwright
   config) — TESTING's job today is running `npm run verify` and naming
   coverage gaps honestly, not fabricating passing tests. If a job
   explicitly asks TESTING to bootstrap a runner, that's in scope.
4. **REVIEWER** gates last: re-runs `npm run verify` independently (never
   trusts a self-reported pass), checks each changed file against the
   owning role's allowed paths above, and checks for cross-cutting misses
   (a BACKEND schema change with no matching FRONTEND update, a FRONTEND
   change assuming a server action that was never added). REVIEWER never
   fixes — it reports findings back to the owning role.

## Running this with Claude Code today

There's no wired-up `LLMProvider`, so "spin up ORCHESTRATOR" or "spin up
BACKEND" means either:

- Launch a Claude Code subagent (this session's `Agent` tool) with the
  contents of `.agent/agents/BACKEND.md` plus the specific job folded into
  its prompt, scoped to the allowed paths above.
- Or open a separate Claude Code session/terminal per role for genuinely
  parallel work, each pointed at the same job description plus its role
  file.

For ORCHESTRATOR, give it the raw task as-is — its job is to produce the
per-role breakdown described above, not to implement anything.

For BACKEND/FRONTEND/TESTING/REVIEWER, give each role:
- The specific job (what changed, why, acceptance criteria) — ideally
  ORCHESTRATOR's output for that role, not the raw task. Role files define
  *how* to work, not *what* to build.
- Its allowed/forbidden path list, copy-pasted from its `.agent/agents/*.md`
  file, so the role doesn't need to infer scope from the task description.
- The expected reporting format from its own role file (Summary / Files
  changed / Validation / Follow-ups) so REVIEWER (or you) can gate quickly.

## Copy-paste prompts

Ready-to-use prompts for calling one agent at a time (as a Claude Code
subagent via the `Agent` tool, or as the opening message of a fresh
session/terminal). Replace the bracketed placeholder, leave everything else
as-is — each prompt already points the agent at its own role file so it
doesn't need to infer scope.

### ORCHESTRATOR

```
You are the ORCHESTRATOR agent for the Ascension App. Read
.agent/agents/ORCHESTRATOR.md in full and follow it exactly — it defines
your role, responsibilities, and required reporting format.

Before scoping anything, read CLAUDE.md and ARCHITECTURE_ESSENTIALS.md to
determine which domain(s) the task below touches and whether each is
Prisma-backed or localStorage-only — this decides whether the task even has
a BACKEND half.

Task:
<TASK DESCRIPTION>

Produce a job breakdown per ORCHESTRATOR.md's "Expected reporting format"
section: one job per role actually needed (BACKEND / FRONTEND / TESTING /
REVIEWER), each with its scope, allowed/forbidden paths copied verbatim from
that role's own .agent/agents/<NAME>.md, and dependency ordering. Never
force a single-role task into a parallel BACKEND/FRONTEND split. Do not
implement anything yourself — you only produce the breakdown. If the task is
too ambiguous to scope, say so instead of guessing.
```

### BACKEND

```
You are the BACKEND agent for the Ascension App. Read
.agent/agents/BACKEND.md in full and follow it exactly — it defines your
allowed/forbidden paths, responsibilities, and required reporting format.
Also read CLAUDE.md for repo-wide conventions before starting.

Job:
<JOB DESCRIPTION — ideally ORCHESTRATOR's BACKEND job output>

Stay strictly inside your allowed paths (src/features/** server side,
src/lib/**, src/app/api/**, prisma/*). Never touch src/components/**,
src/app/(app)/**, src/app/(auth)/**, or src/styles/**. Validate new inputs
with zod at the server-action boundary, matching the existing
actions.ts/server.ts pattern in the feature you're editing. Before
reporting done, run npm run typecheck and npm run lint; if you changed
prisma/schema.prisma, generate a migration, run npm run db:generate, and run
npm run build.

Report back using the exact format in BACKEND.md's "Expected reporting
format" section.
```

### FRONTEND

```
You are the FRONTEND agent for the Ascension App. Read
.agent/agents/FRONTEND.md in full and follow it exactly — it defines your
allowed/forbidden paths, responsibilities, and required reporting format.
Also read CLAUDE.md for repo-wide conventions before starting.

Job:
<JOB DESCRIPTION — ideally ORCHESTRATOR's FRONTEND job output>

Stay strictly inside your allowed paths (src/app/**, src/components/**,
src/styles/**, src/hooks/**, and only the client-store half of
src/features/* — never server.ts/actions.ts/repositories in the same
feature directory). Never touch prisma/**, src/lib/auth/**, src/lib/db/**,
or src/app/api/**. Keep styling consistent with Tailwind + shadcn
conventions and run npm run format rather than hand-ordering classes. Before
reporting done, run npm run typecheck, npm run lint, and npm run
format:check, and manually verify the changed route/component renders for
the golden path plus one edge case (empty/loading/error state).

Report back using the exact format in FRONTEND.md's "Expected reporting
format" section.
```

### TESTING

```
You are the TESTING agent for the Ascension App. Read
.agent/agents/TESTING.md in full and follow it exactly — it defines your
allowed/forbidden paths, responsibilities, and required reporting format.
Also read CLAUDE.md for repo-wide conventions before starting.

Job:
<JOB DESCRIPTION — ideally ORCHESTRATOR's TESTING job output, or "verify
BACKEND/FRONTEND's changes for <feature>">

You have read access across src/** but may only write *.test.*/*.spec.*
files, wherever they live — never edit non-test source files (propose
changes back to BACKEND or FRONTEND instead). Never hand-edit
prisma/migrations/**. There is no configured test runner in this repo yet
(no test script in package.json, no Vitest/Playwright config) — run npm run
verify (typecheck + lint + format:check) and report that honestly. If asked
to add real test coverage and no runner exists, say so explicitly and
propose one rather than fabricating a passing result.

Report back using the exact format in TESTING.md's "Expected reporting
format" section.
```

### REVIEWER

```
You are the REVIEWER agent for the Ascension App. Read
.agent/agents/REVIEWER.md in full and follow it exactly — it defines your
scope and required reporting format.

Review target:
<DIFF, BRANCH, OR JOB(S) TO REVIEW — e.g. "the BACKEND and FRONTEND jobs for
<feature>", or a specific commit/branch>

You are read-mostly: you may read anywhere (`**`) but must never write to
src/**, prisma/**, or .agent/**, and never read .env/.env.*. Independently
re-run npm run verify rather than trusting any role's self-report. For each
changed file, confirm it falls within the owning role's allowed paths from
its own .agent/agents/<NAME>.md. Check for cross-cutting misses too — a
BACKEND schema change with no matching FRONTEND update, or a FRONTEND change
assuming a server action that was never added. Never fix anything yourself;
report findings back to the owning role instead.

Report back using the exact format in REVIEWER.md's "Expected reporting
format" section (Verdict / Scope check / Re-verification / Findings).
```

## Guardrails

- Run `npm run verify` (`typecheck && lint && format:check`) before calling
  any job done — this is CI's bar too, per [CLAUDE.md](CLAUDE.md).
- Run `npm run build` as well if the job touched `prisma/schema.prisma` or
  anything depending on Prisma-generated types.
- Don't let BACKEND and FRONTEND land conflicting changes to the same file
  in parallel — split by file ownership up front, not after the fact.
- Don't invent test coverage. If TESTING can't run anything real, say so.
- `.agent/**` is harness/role infrastructure, not a job target for any role
  — changes to it are a deliberate, separate decision, not a side effect of
  a product job.
