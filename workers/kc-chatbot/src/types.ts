export interface Env {
  DB: D1Database;
  RATE_LIMIT: KVNamespace;
  ANTHROPIC_API_KEY: string;
  IP_HASH_SALT: string;
  ENV: string;
  MONTHLY_BUDGET_USD: string;
  MAX_MESSAGES_PER_HOUR: string;
  MAX_MESSAGES_PER_DAY: string;
  MAX_OUTPUT_TOKENS: string;
}

export type ConsentType = "admissions_contact" | "updates_notification";

export interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  language_hint?: string;
}

export interface ChatResponse {
  reply: string;
  language: string;
  suggest_lead_capture?: boolean;
}

export interface LeadRequest {
  email: string;
  name: string;
  interested_track?: string;
  language_pref?: string;
  consent_type: ConsentType;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: "hourly" | "daily" | "budget";
  retryAfterSeconds?: number;
}
