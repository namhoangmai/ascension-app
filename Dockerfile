FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ascension?schema=public"
ENV AUTH_SECRET="build-time-placeholder-auth-secret"
# Unlike AUTH_SECRET above, this must be the real, stable secret on every build (never a
# placeholder) — Next.js uses it to encrypt Server Action IDs, and a different key per build
# invalidates every Server Action a client's already-loaded JS still references (e.g. the
# Google sign-in button), causing "Server Action was not found" errors on stale tabs after a
# deploy. Pass it as a build arg (Render passes dashboard-configured build-time env vars
# through to matching ARGs automatically); generate once with `openssl rand -base64 32` and
# keep it identical across every deploy. See .env.example.
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER nextjs
EXPOSE 10000
ENV PORT=10000
CMD ["node", "server.js"]
