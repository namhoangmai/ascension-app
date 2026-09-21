type RateLimitKey = `auth:${string}:${string}`;

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  key: RateLimitKey;
  limit: number;
  windowMs: number;
}

const buckets = new Map<RateLimitKey, RateLimitBucket>();

export class RateLimitError extends Error {
  constructor() {
    super("Too many attempts. Please wait and try again.");
    this.name = "RateLimitError";
  }
}

export function getRateLimitKey(scope: string, identifier: string): RateLimitKey {
  return `auth:${scope}:${identifier.toLowerCase()}`;
}

const MAX_BUCKETS = 10_000;

// Keeps memory bounded (keys include user-supplied emails). In-memory and per-process:
// valid for Render's single instance only; resets on restart/deploy.
function pruneBuckets(now: number) {
  if (buckets.size < MAX_BUCKETS) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  if (buckets.size >= MAX_BUCKETS) {
    buckets.clear();
  }
}

export function assertRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  pruneBuckets(now);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    throw new RateLimitError();
  }

  bucket.count += 1;
}

export function clearRateLimit(key: RateLimitKey) {
  buckets.delete(key);
}
