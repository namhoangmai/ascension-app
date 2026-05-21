# Ascension

Production-grade fitness web app for strength training, calorie tracking, progressive overload, AI meal suggestions, body progress, and mobile-first PWA usage.

## Phase 1 Scope

This repository currently contains the Phase 1 foundation only:

- Feature-first Next.js App Router architecture
- Prisma PostgreSQL schema
- Route and folder structure
- Shared UI system baseline
- Docker local Postgres setup
- CI/CD validation workflow
- PWA manifest baseline
- Environment variable contract

Authentication and product features begin in later phases.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Start Postgres with Docker:

```bash
docker compose up -d db
```

The local Docker database is published on host port `5433` to avoid collisions with a system PostgreSQL install on `5432`.

3. Install dependencies:

```bash
npm install
```

4. Generate Prisma client and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

5. Start the app:

```bash
npm run dev
```

Architecture notes live in [docs/phase-1-architecture.md](docs/phase-1-architecture.md).
