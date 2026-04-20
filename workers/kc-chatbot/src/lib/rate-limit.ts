import type { Env, RateLimitResult } from "../types";

function hourKey(hash: string, d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `ip:${hash}:hour:${y}${m}${day}${h}`;
}

function dayKey(hash: string, d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `ip:${hash}:day:${y}${m}${day}`;
}

async function inc(
  kv: KVNamespace,
  key: string,
  ttl: number,
): Promise<number> {
  const cur = parseInt((await kv.get(key)) ?? "0", 10);
  const next = cur + 1;
  await kv.put(key, String(next), { expirationTtl: ttl });
  return next;
}

export async function checkRateLimit(
  ipHash: string,
  env: Env,
): Promise<RateLimitResult> {
  const now = new Date();
  const hourCount = await inc(env.RATE_LIMIT, hourKey(ipHash, now), 3600);
  const dayCount = await inc(env.RATE_LIMIT, dayKey(ipHash, now), 86400);
  const hourMax = parseInt(env.MAX_MESSAGES_PER_HOUR, 10);
  const dayMax = parseInt(env.MAX_MESSAGES_PER_DAY, 10);

  if (hourCount > hourMax) {
    return { allowed: false, reason: "hourly", retryAfterSeconds: 3600 };
  }
  if (dayCount > dayMax) {
    return { allowed: false, reason: "daily", retryAfterSeconds: 86400 };
  }
  return { allowed: true };
}
