interface Bucket {
  tokens: number;
  updated: number;
}

export interface RateLimiter {
  readonly take: (key: string, now?: number) => { readonly allowed: boolean; readonly retryAfterSeconds: number };
  readonly size: () => number;
  readonly prune: (now?: number) => void;
}

const MAX_BUCKETS = 20_000;

export function createRateLimiter(capacity: number, refillPerSecond: number): RateLimiter {
  const buckets = new Map<string, Bucket>();
  const fullAfterMs = (capacity / refillPerSecond) * 1000;

  const refill = (bucket: Bucket, now: number): void => {
    const elapsed = Math.max(0, now - bucket.updated) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerSecond);
    bucket.updated = now;
  };

  const prune = (now = Date.now()): void => {
    for (const [key, bucket] of buckets) {
      if (now - bucket.updated >= fullAfterMs) {
        buckets.delete(key);
      }
    }
  };

  return {
    take(key, now = Date.now()) {
      let bucket = buckets.get(key);
      if (bucket === undefined) {
        if (buckets.size >= MAX_BUCKETS) {
          prune(now);
          if (buckets.size >= MAX_BUCKETS) {
            const oldest = buckets.keys().next().value;
            if (oldest !== undefined) {
              buckets.delete(oldest);
            }
          }
        }
        bucket = { tokens: capacity, updated: now };
        buckets.set(key, bucket);
      } else {
        refill(bucket, now);
      }

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return { allowed: true, retryAfterSeconds: 0 };
      }
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerSecond)) };
    },
    size: () => buckets.size,
    prune,
  };
}
