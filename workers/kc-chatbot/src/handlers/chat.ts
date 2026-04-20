import type { Env, ChatRequest, ChatResponse } from "../types";
import { hashIP, scrubPII, normalizeIP } from "../lib/privacy";
import { checkRateLimit } from "../lib/rate-limit";
import { checkBudget, addCost, estimateCost } from "../lib/cost-tracker";
import { callClaude } from "../lib/anthropic";
import { buildSystemPrompt } from "../lib/system-prompt";

const LIMIT_MSG =
  "I've answered quite a few questions already today. For detailed inquiries, please email global@badaglobal-bli.com — our team will get back to you personally.";
const BUDGET_MSG =
  "Our assistant is resting for the month. Please email global@badaglobal-bli.com for any questions — we'll get right back to you.";
const UPSTREAM_ERR_MSG =
  "Our assistant is temporarily unavailable. Please try again in a moment, or email global@badaglobal-bli.com for immediate help.";
const MAX_MESSAGES_PER_REQUEST = 40;

function json(body: unknown, status = 200): Response {
  // CORS headers는 index.ts 라우터에서 origin allowlist 기반으로 덮어씀
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
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
  if (payload.messages.length > MAX_MESSAGES_PER_REQUEST) {
    return json({ error: `max ${MAX_MESSAGES_PER_REQUEST} messages per request` }, 400);
  }
  const latest = payload.messages[payload.messages.length - 1];
  if (!latest.content || latest.content.length > 2000) {
    return json({ error: "message length must be 1..2000" }, 400);
  }
  // 마지막 메시지는 반드시 user 역할 (클라이언트가 fake assistant turn 주입하는 것 방지)
  if (latest.role !== "user") {
    return json({ error: "last message must be user role" }, 400);
  }

  const ip = normalizeIP(req.headers.get("cf-connecting-ip") ?? "0.0.0.0");
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

  // Claude 호출 시에는 PII 스크러빙하지 않음 — 사용자가 자기 이메일을 공유한
  // 맥락을 Claude가 이해하고 자연스럽게 응답할 수 있어야 하기 때문.
  // PII 스크러빙은 questions_log D1 저장 시점에만 적용 (아래 INSERT 참고).
  let claude;
  try {
    claude = await callClaude({
      apiKey: env.ANTHROPIC_API_KEY,
      systemPrompt: buildSystemPrompt(),
      messages: payload.messages,
      maxTokens: parseInt(env.MAX_OUTPUT_TOKENS, 10),
    });
  } catch (e) {
    console.error("claude upstream failed", e);
    const reply: ChatResponse = { reply: UPSTREAM_ERR_MSG, language: "en" };
    return json(reply, 200);
  }

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
