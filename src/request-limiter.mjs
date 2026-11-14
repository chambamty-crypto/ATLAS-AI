export function createRateLimiter({ maxKeys = 5_000, cleanupEvery = 128, now = Date.now } = {}) {
  if (!Number.isInteger(maxKeys) || maxKeys < 1) throw new TypeError("maxKeys must be a positive integer");
  if (!Number.isInteger(cleanupEvery) || cleanupEvery < 1) throw new TypeError("cleanupEvery must be a positive integer");

  const buckets = new Map();
  let requests = 0;

  function pruneExpired(timestamp) {
    for (const [key, bucket] of buckets) {
      const recent = bucket.timestamps.filter((value) => timestamp - value < bucket.windowMs);
      if (!recent.length) buckets.delete(key);
      else if (recent.length !== bucket.timestamps.length) buckets.set(key, { ...bucket, timestamps: recent });
    }
  }

  return {
    isAllowed(key, limit, windowMs) {
      if (typeof key !== "string" || !key || !Number.isInteger(limit) || limit < 1 ||
          !Number.isFinite(windowMs) || windowMs < 1) {
        throw new TypeError("Invalid rate-limit parameters");
      }

      const timestamp = now();
      requests += 1;
      if (requests % cleanupEvery === 0) pruneExpired(timestamp);

      const existing = buckets.get(key);
      const timestamps = existing
        ? existing.timestamps.filter((value) => timestamp - value < windowMs)
        : [];

      if (timestamps.length >= limit) {
        buckets.delete(key);
        buckets.set(key, { timestamps, windowMs });
        return false;
      }

      timestamps.push(timestamp);
      if (existing) buckets.delete(key);
      else if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value);
      buckets.set(key, { timestamps, windowMs });
      return true;
    },
    get size() {
      return buckets.size;
    },
    prune() {
      pruneExpired(now());
    }
  };
}
