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

export function assertRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
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
