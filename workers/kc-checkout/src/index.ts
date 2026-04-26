import type { Env } from "./types";
import { handleCreateCheckoutSession } from "./handlers/checkout";
import { handleWebhook } from "./handlers/webhook";
import { handleHealth } from "./handlers/health";

const ALLOWED_ORIGINS = [
  "https://kcultureelite.com",
  "https://www.kcultureelite.com",
  "https://kcultureelite.pages.dev",
  "http://localhost:8765",
  "http://localhost:8787",
];

function corsHeaders(origin: string | null): HeadersInit {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "content-type, stripe-signature",
    "access-control-max-age": "86400",
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get("origin");

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(req.url);
    let res: Response;

    switch (url.pathname) {
      case "/create-checkout-session":
        res = await handleCreateCheckoutSession(req, env);
        break;
      case "/webhook":
        // Stripe webhooks don't use CORS; keep raw response.
        return await handleWebhook(req, env);
      case "/health":
        res = handleHealth();
        break;
      default:
        res = new Response("not found", { status: 404 });
    }

    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      headers.set(k, v as string);
    }
    return new Response(res.body, { status: res.status, headers });
  },
};
