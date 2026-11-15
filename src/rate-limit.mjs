// Un limitador independiente por ruta. Acota la memoria incluso ante muchas IP únicas.
export function rateLimit(maxRequests, windowMs, { now = Date.now } = {}) {
  const buckets = new Map();
  const maxBuckets = 10_000;
  const cleaner = setInterval(() => {
    const current = now();
    for (const [key, times] of buckets) {
      const recent = times.filter((time) => current - time < windowMs);
      if (recent.length) buckets.set(key, recent);
      else buckets.delete(key);
    }
  }, Math.max(windowMs, 60_000));
  cleaner.unref?.();
  return (req, res, next) => {
    const key = req.ip || "unknown";
    const current = now();
    const recent = (buckets.get(key) || []).filter((time) => current - time < windowMs);
    if (recent.length >= maxRequests) return res.status(429).json({ error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." });
    recent.push(current);
    if (!buckets.has(key) && buckets.size >= maxBuckets) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey !== undefined) buckets.delete(oldestKey);
    }
    buckets.set(key, recent);
    next();
  };
}