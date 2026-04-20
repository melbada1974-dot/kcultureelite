import { describe, it, expect } from "vitest";
import { hashIP, scrubPII, normalizeIP } from "./privacy";

describe("hashIP", () => {
  it("produces the same hash for the same IP + salt", async () => {
    const a = await hashIP("203.0.113.42", "salt");
    const b = await hashIP("203.0.113.42", "salt");
    expect(a).toBe(b);
    expect(a).toHaveLength(64); // SHA-256 hex
  });

  it("differs for different IPs", async () => {
    const a = await hashIP("203.0.113.1", "salt");
    const b = await hashIP("203.0.113.2", "salt");
    expect(a).not.toBe(b);
  });

  it("differs when salt differs", async () => {
    const a = await hashIP("203.0.113.1", "salt-a");
    const b = await hashIP("203.0.113.1", "salt-b");
    expect(a).not.toBe(b);
  });
});

describe("scrubPII", () => {
  it("removes email addresses from free text", () => {
    const input = "My email is foo@example.com and I have a question.";
    const out = scrubPII(input);
    expect(out).not.toContain("foo@example.com");
    expect(out).toContain("[email]");
  });

  it("removes Korean phone numbers", () => {
    const input = "Call me at 010-1234-5678 please.";
    const out = scrubPII(input);
    expect(out).not.toContain("010-1234-5678");
    expect(out).toContain("[phone]");
  });

  it("removes Korean resident registration numbers", () => {
    const input = "My RRN is 900101-1234567 — is that needed?";
    const out = scrubPII(input);
    expect(out).not.toContain("900101-1234567");
    expect(out).toContain("[rrn]");
  });

  it("removes Korean landline numbers", () => {
    const input = "Our office is 02-123-4567.";
    const out = scrubPII(input);
    expect(out).not.toContain("02-123-4567");
    expect(out).toContain("[phone]");
  });

  it("passes through clean text unchanged", () => {
    expect(scrubPII("Tell me about K-Beauty track.")).toBe("Tell me about K-Beauty track.");
  });
});

describe("normalizeIP", () => {
  it("preserves IPv4 as-is", () => {
    expect(normalizeIP("203.0.113.42")).toBe("203.0.113.42");
  });

  it("truncates IPv6 to /64 prefix (first 4 groups)", () => {
    expect(normalizeIP("2001:db8:abcd:1234:5678:aaaa:bbbb:cccc"))
      .toBe("2001:db8:abcd:1234");
  });

  it("normalizes two different IPs in same /64 to same prefix", () => {
    const a = normalizeIP("2001:db8:abcd:1234:1::1");
    const b = normalizeIP("2001:db8:abcd:1234:2::2");
    expect(a).toBe(b);
  });
});
