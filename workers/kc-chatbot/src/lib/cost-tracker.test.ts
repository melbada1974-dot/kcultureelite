import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { addCost, checkBudget, estimateCost } from "./cost-tracker";

const e = env as unknown as {
  RATE_LIMIT: KVNamespace;
  MONTHLY_BUDGET_USD: string;
};

describe("estimateCost", () => {
  it("charges input, cache-read, and output at correct rates", () => {
    // 1M input, 1M cache read, 1M output
    const cost = estimateCost({
      inputTokens: 1_000_000,
      cacheRead: 1_000_000,
      cacheCreation: 0,
      outputTokens: 1_000_000,
    });
    // 1 + 0.10 + 0 + 5 = 6.10
    expect(cost).toBeCloseTo(6.1, 2);
  });
});

describe("budget tracking", () => {
  beforeEach(async () => {
    const keys = await e.RATE_LIMIT.list();
    for (const k of keys.keys) await e.RATE_LIMIT.delete(k.name);
  });

  it("allows requests under budget", async () => {
    await addCost(e as any, 5.0);
    expect(await checkBudget(e as any)).toBe(true);
  });

  it("blocks requests over budget", async () => {
    await addCost(e as any, 100.0);
    expect(await checkBudget(e as any)).toBe(false);
  });
});
