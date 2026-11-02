// Best-effort, per-instance rate limits. Serverless instances don't share memory, so this only
// blunts scripted spam or code-guessing from one source; it is not a hard security boundary.
// Limits are generous because a whole classroom usually shares one Wi-Fi IP address.
const buckets = new Map();

export function tooMany(key, limit, windowMs) {
  const b = buckets.get(key);
  return !!b && Date.now() - b.start < windowMs && b.count >= limit;
}

export function record(key, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start >= windowMs) {
    b = { start: now, count: 0 };
    buckets.set(key, b);
  }
  b.count++;
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (now - v.start >= windowMs) buckets.delete(k);
  }
}
