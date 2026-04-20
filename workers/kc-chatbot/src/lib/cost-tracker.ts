import type { Env } from "../types";

const RATES = {
  input: 1.0 / 1_000_000,
  cacheRead: 0.1 / 1_000_000,
  cacheCreation: 1.25 / 1_000_000,
  output: 5.0 / 1_000_000,
};

export interface Usage {
  inputTokens: number;
  cacheRead: number;
  cacheCreation: number;
  outputTokens: number;
}

export function estimateCost(u: Usage): number {
  return (
    u.inputTokens * RATES.input +
    u.cacheRead * RATES.cacheRead +
    u.cacheCreation * RATES.cacheCreation +
    u.outputTokens * RATES.output
  );
}

function monthKey(d: Date = new Date()): string {
  return `monthly_cost:${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function addCost(env: Env, usd: number): Promise<number> {
  const key = monthKey();
  const cur = parseFloat((await env.RATE_LIMIT.get(key)) ?? "0");
  const next = cur + usd;
  // 한 달 유지 (31 × 86400)
  await env.RATE_LIMIT.put(key, next.toString(), { expirationTtl: 2_678_400 });
  return next;
}

export async function checkBudget(env: Env): Promise<boolean> {
  const cur = parseFloat((await env.RATE_LIMIT.get(monthKey())) ?? "0");
  const cap = parseFloat(env.MONTHLY_BUDGET_USD);
  return cur < cap;
}
