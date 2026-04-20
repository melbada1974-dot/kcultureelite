import type { Env, ChatRequest, ChatResponse } from "../types";
import { hashIP, scrubPII } from "../lib/privacy";
import { checkRateLimit } from "../lib/rate-limit";
import { checkBudget, addCost, estimateCost } from "../lib/cost-tracker";
import { callClaude } from "../lib/anthropic";
import { buildSystemPrompt } from "../lib/system-prompt";

const LIMIT_MSG =
  "I've answered quite a few questions already today. For detailed inquiries, please email global@badaglobal-bli.com — our team will get back to you personally.";
const BUDGET_MSG =
  "Our assistant is resting for the month. Please email global@badaglobal-bli.com for any questions — we'll get right back to you.";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

export async function handleChat(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!env.ANTHROPIC_API_KEY) return json({ error: "not configured" }, 500);

  let payload: ChatRequest;
  try {
    payload = (await req.json()) as ChatRequest;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return json({ error: "messages required" }, 400);
  }
  const latest = payload.messages[payload.messages.length - 1];
  if (!latest.content || latest.content.length > 2000) {
    return json({ error: "message length must be 1..2000" }, 400);
  }

  const ip = req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
  const ipHash = await hashIP(ip, env.IP_HASH_SALT);

  const rl = await checkRateLimit(ipHash, env);
  if (!rl.allowed) {
    const reply: ChatResponse = { reply: LIMIT_MSG, language: "en" };
    return json(reply, 200);
  }
  if (!(await checkBudget(env))) {
    const reply: ChatResponse = { reply: BUDGET_MSG, language: "en" };
    return json(reply, 200);
  }

  // 대화 메시지 내 사용자 PII 스크러빙 (개인정보 저장 방지)
  const safeMessages = payload.messages.map((m) => ({
    role: m.role,
    content: scrubPII(m.content),
  }));

  const claude = await callClaude({
    apiKey: env.ANTHROPIC_API_KEY,
    systemPrompt: buildSystemPrompt(),
    messages: safeMessages,
    maxTokens: parseInt(env.MAX_OUTPUT_TOKENS, 10),
  });

  // 비용 기록 (best-effort, 실패해도 응답은 간다)
  try {
    await addCost(env, estimateCost(claude));
  } catch (e) {
    console.error("cost tracking failed", e);
  }

  // 익명 질문 로그 (답변은 저장하지 않음)
  try {
    await env.DB.prepare(
      "INSERT INTO questions_log (id, session_hash, question_text, kb_matched, language) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(
        crypto.randomUUID(),
        ipHash.slice(0, 16), // 세션 단위 축약
        scrubPII(latest.content).slice(0, 500),
        1,
        payload.language_hint ?? null,
      )
      .run();
  } catch (e) {
    console.error("questions_log insert failed", e);
  }

  const response: ChatResponse = {
    reply: claude.text,
    language: payload.language_hint ?? "auto",
  };
  return json(response, 200);
}
