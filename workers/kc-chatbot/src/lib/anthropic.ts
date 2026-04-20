export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeReply {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheCreation: number;
}

export interface CallClaudeOpts {
  apiKey: string;
  systemPrompt: string;
  messages: ClaudeMessage[];
  maxTokens: number;
  fetchImpl?: typeof fetch;
}

const MODEL_ID = "claude-haiku-4-5-20251001";

export async function callClaude(opts: CallClaudeOpts): Promise<ClaudeReply> {
  const fetcher = opts.fetchImpl ?? fetch;
  const body = {
    model: MODEL_ID,
    max_tokens: opts.maxTokens,
    system: [
      {
        type: "text",
        text: opts.systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: opts.messages,
  };

  const res = await fetcher("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${text}`);
  }

  const json: any = await res.json();
  const text = (json.content ?? [])
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("");

  return {
    text,
    inputTokens: json.usage?.input_tokens ?? 0,
    outputTokens: json.usage?.output_tokens ?? 0,
    cacheRead: json.usage?.cache_read_input_tokens ?? 0,
    cacheCreation: json.usage?.cache_creation_input_tokens ?? 0,
  };
}
