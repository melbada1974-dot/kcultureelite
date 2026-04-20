const EMAIL_RE = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/;
const NAME_PATTERNS: RegExp[] = [
  /\bI['']?m\s+([A-Z][A-Za-z'-]{1,30})/,
  /\bmy name is\s+([A-Z][A-Za-z'-]{1,30})/i,
  /\bI am\s+([A-Z][A-Za-z'-]{1,30})/,
];

export interface LeadDetection {
  email: string;
  name: string | null;
}

export function detectLead(text: string): LeadDetection | null {
  const match = text.match(EMAIL_RE);
  if (!match) return null;

  const email = match[0].toLowerCase();
  let name: string | null = null;

  for (const re of NAME_PATTERNS) {
    const m = text.match(re);
    if (m) {
      name = m[1];
      break;
    }
  }

  return { email, name };
}
