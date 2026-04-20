import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { checkRateLimit } from "./rate-limit";

const e = env as unknown as {
  RATE_LIMIT: KVNamespace;
  MAX_MESSAGES_PER_HOUR: string;
  MAX_MESSAGES_PER_DAY: string;
};

describe("checkRateLimit", () => {
  beforeEach(async () => {
    // KV 정리 (테스트 격리)
    const keys = await e.RATE_LIMIT.list();
    for (const k of keys.keys) await e.RATE_LIMIT.delete(k.name);
  });

  it("allows first request for a new IP", async () => {
    const r = await checkRateLimit("hash-a", e as any);
    expect(r.allowed).toBe(true);
  });

  it("blocks after hourly limit is reached", async () => {
    const max = parseInt(e.MAX_MESSAGES_PER_HOUR);
    for (let i = 0; i < max; i++) {
      await checkRateLimit("hash-b", e as any);
    }
    const blocked = await checkRateLimit("hash-b", e as any);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("hourly");
  });

  it("counts different IPs independently", async () => {
    const max = parseInt(e.MAX_MESSAGES_PER_HOUR);
    for (let i = 0; i < max; i++) await checkRateLimit("hash-c", e as any);
    const other = await checkRateLimit("hash-d", e as any);
    expect(other.allowed).toBe(true);
  });
});
