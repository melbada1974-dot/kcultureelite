const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const KR_PHONE_RE = /\b01[016789][-. ]?\d{3,4}[-. ]?\d{4}\b/g;
const INTL_PHONE_RE = /\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/g;
const KR_RRN_RE = /\b\d{6}[-]\d{7}\b/g;
const KR_LANDLINE_RE = /\b0[2-6]\d?[-. ]?\d{3,4}[-. ]?\d{4}\b/g;

/**
 * IPv6는 /64 prefix만 유지한 채 잘라낸다. 한 사용자가 ISP에서 받는
 * 기본 블록이 /64이므로 그 안에서 주소 회전으로 rate limit을 우회하는
 * 공격을 차단한다. IPv4는 원본 유지.
 */
export function normalizeIP(ip: string): string {
  if (!ip.includes(":")) return ip;
  const groups = ip.split(":");
  return groups.slice(0, 4).join(":");
}

export async function hashIP(ip: string, salt: string): Promise<string> {
  const buf = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function scrubPII(text: string): string {
  return text
    .replace(KR_RRN_RE, "[rrn]")
    .replace(EMAIL_RE, "[email]")
    .replace(KR_PHONE_RE, "[phone]")
    .replace(INTL_PHONE_RE, "[phone]")
    .replace(KR_LANDLINE_RE, "[phone]");
}
