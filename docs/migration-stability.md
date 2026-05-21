# Migration Stability

## Root Cause

Prisma migration commands were pointed at `localhost:5432`, but that port was owned by a local Windows PostgreSQL process, not the Docker Postgres container used by this project.

Direct `docker exec ... psql` checks succeeded because they connected inside the container over the local socket path. Prisma's schema engine connects from Windows over TCP, so it reached the wrong server and failed authentication. The Prisma CLI surfaced this as a blank `Schema engine error`; invoking `schema-engine-windows.exe cli ... can-connect-to-database` exposed the underlying `P1000` authentication failure.

There was also a secondary issue: the generated migration file had a UTF-8 BOM from PowerShell `Out-File -Encoding utf8`. The migration file has been rewritten as UTF-8 without BOM.

## Fix

- Publish the Docker database on host port `5433`.
- Update `.env.example` to use `localhost:5433`.
- Keep container-internal app connections on `db:5432`.
- Add `prisma/migrations/migration_lock.toml`.
- Rewrite `migration.sql` as UTF-8 without BOM.

## Verification

Run these from the repository root:

```bash
docker compose up -d db
npx prisma migrate reset
npx prisma migrate dev
npx prisma migrate deploy
npx prisma generate
npx prisma validate
```

All commands should use:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ascension?schema=public
DIRECT_URL=postgresql://postgres:postgres@localhost:5433/ascension?schema=public
```
