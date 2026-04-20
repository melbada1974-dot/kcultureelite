const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const KR_PHONE_RE = /\b01[016789][-. ]?\d{3,4}[-. ]?\d{4}\b/g;
const INTL_PHONE_RE = /\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/g;

export async function hashIP(ip: string, salt: string): Promise<string> {
  const buf = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function scrubPII(text: string): string {
  return text
    .replace(EMAIL_RE, "[email]")
    .replace(KR_PHONE_RE, "[phone]")
    .replace(INTL_PHONE_RE, "[phone]");
}
