import type { Env, LeadRequest } from "../types";
import { hashIP, normalizeIP } from "../lib/privacy";
import { checkRateLimit } from "../lib/rate-limit";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const TRACK_ALLOWLIST = [
  "K-Pop Business",
  "K-Performance",
  "K-Beauty Business",
  "K-Fusion Media & Content",
  "Global Entertainment Startup",
];

export async function handleLead(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // Rate limit — /lead는 /chat과 동일한 IP별 쿼터 공유로 스팸 방지
  const ip = normalizeIP(req.headers.get("cf-connecting-ip") ?? "0.0.0.0");
  const ipHash = await hashIP(ip, env.IP_HASH_SALT);
  const rl = await checkRateLimit(ipHash, env);
  if (!rl.allowed) {
    return json({ error: "too many requests" }, 429);
  }

  let payload: LeadRequest;
  try {
    payload = (await req.json()) as LeadRequest;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (!EMAIL_RE.test(payload.email ?? "") || payload.email.length > 254) {
    return json({ error: "invalid email" }, 400);
  }
  if (!payload.name || payload.name.length > 120) {
    return json({ error: "name required (max 120 chars)" }, 400);
  }
  if (
    payload.consent_type !== "admissions_contact" &&
    payload.consent_type !== "updates_notification"
  ) {
    return json({ error: "invalid consent_type" }, 400);
  }
  if (
    payload.interested_track &&
    !TRACK_ALLOWLIST.includes(payload.interested_track)
  ) {
    return json({ error: "invalid interested_track" }, 400);
  }
  if (payload.language_pref && payload.language_pref.length > 10) {
    return json({ error: "invalid language_pref" }, 400);
  }

  const country = req.headers.get("cf-ipcountry") ?? null;
  const id = crypto.randomUUID();

  try {
    await env.DB.prepare(
      `INSERT INTO leads (id, email, name, interested_track, language_pref,
                          consent_type, country_code)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         interested_track = COALESCE(excluded.interested_track, leads.interested_track),
         language_pref    = COALESCE(excluded.language_pref, leads.language_pref),
         consent_type     = excluded.consent_type`,
    )
      .bind(
        id,
        payload.email.toLowerCase(),
        payload.name.trim(),
        payload.interested_track ?? null,
        payload.language_pref ?? null,
        payload.consent_type,
        country,
      )
      .run();
  } catch (e) {
    console.error("lead insert failed", e);
    return json({ error: "storage error" }, 500);
  }

  return json({ ok: true }, 200);
}
