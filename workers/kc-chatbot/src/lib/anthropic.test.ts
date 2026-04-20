import { describe, it, expect, vi } from "vitest";
import { callClaude } from "./anthropic";

describe("callClaude", () => {
  it("passes system prompt with cache_control and returns reply text", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) ?? "{}");
      // 캐시 제어 확인
      expect(body.system[0].cache_control).toEqual({ type: "ephemeral" });
      expect(body.model).toContain("claude-haiku-4-5");
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: "Hello Sarah!" }],
          usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const reply = await callClaude({
      apiKey: "test-key",
      systemPrompt: "SYS",
      messages: [{ role: "user", content: "Hi" }],
      maxTokens: 500,
      fetchImpl: fetchMock as any,
    });

    expect(reply.text).toBe("Hello Sarah!");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws on non-200 response", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "bad" }), { status: 500 }),
    );
    await expect(
      callClaude({
        apiKey: "k",
        systemPrompt: "s",
        messages: [{ role: "user", content: "q" }],
        maxTokens: 100,
        fetchImpl: fetchMock as any,
      }),
    ).rejects.toThrow(/Anthropic API error: 500/);
  });
});
