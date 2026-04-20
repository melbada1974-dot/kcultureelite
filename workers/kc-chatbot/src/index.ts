import type { Env } from "./types";
import { handleChat } from "./handlers/chat";
import { handleLead } from "./handlers/lead";
import { handleHealth } from "./handlers/health";

const ALLOWED_ORIGINS = [
  "https://kcultureelite.com",
  "https://www.kcultureelite.com",
  "https://kcultureelite.pages.dev",
  "http://localhost:8765",
  "http://localhost:8787",
];

function cors(origin: string | null): HeadersInit {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get("origin");
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    const url = new URL(req.url);
    let res: Response;
    switch (url.pathname) {
      case "/chat":
        res = await handleChat(req, env);
        break;
      case "/lead":
        res = await handleLead(req, env);
        break;
      case "/health":
        res = handleHealth();
        break;
      default:
        res = new Response("not found", { status: 404 });
    }
    // CORS 헤더 덮어쓰기
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors(origin))) h.set(k, v as string);
    return new Response(res.body, { status: res.status, headers: h });
  },
};
