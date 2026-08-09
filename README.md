# Ascension

## Local Setup

1. Copy `.env.example` to `.env`.
2. Start Postgres with Docker:

```bash
docker compose up -d db
```

3. Verify Docker and DB health:

```bash
docker info
docker compose ps
docker compose logs -f db
```

4. Install dependencies:

```bash
npm install
```

5. Generate Prisma client and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

6. Start the app:

```bash
npm run dev
```
