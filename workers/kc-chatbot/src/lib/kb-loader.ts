// Wrangler는 확장자 import를 텍스트로 번들링 (fetch + build 시점)
// https://developers.cloudflare.com/workers/wrangler/bundling/
import kbText from "../../knowledge-base.md";

export function getKnowledgeBase(): string {
  return kbText as unknown as string;
}
