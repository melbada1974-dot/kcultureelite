import type Stripe from "stripe";
import type { Env } from "../types";
import { getStripe } from "../lib/stripe";

function ok(message = "ok"): Response {
  return new Response(JSON.stringify({ received: true, message }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function err(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function notifyAppsScript(
  env: Env,
  payload: {
    applicationId: string;
    sessionId: string;
    paymentIntentId: string | null;
    amountTotal: number | null;
    currency: string | null;
    customerEmail: string | null;
  },
): Promise<void> {
  if (!env.APPS_SCRIPT_WEBHOOK_URL) {
    console.warn("[webhook] APPS_SCRIPT_WEBHOOK_URL not configured; skipping notification");
    return;
  }
  if (!env.APPS_SCRIPT_TOKEN) {
    console.error("[webhook] APPS_SCRIPT_TOKEN missing; refusing to call Apps Script unauthenticated");
    return;
  }
  try {
    const url = new URL(env.APPS_SCRIPT_WEBHOOK_URL);
    url.searchParams.set("action", "update");
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: env.APPS_SCRIPT_TOKEN,
        applicationId: payload.applicationId,
        paymentStatus: "paid",
        sessionId: payload.sessionId,
        paymentIntentId: payload.paymentIntentId,
        amountTotal: payload.amountTotal,
        currency: payload.currency,
        customerEmail: payload.customerEmail,
        paidAt: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[webhook] apps script returned", res.status, text);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[webhook] apps script notify failed:", message);
  }
}

export async function handleWebhook(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return err(405, "method not allowed");

  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return err(500, "server misconfigured");
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return err(400, "missing stripe-signature header");

  const rawBody = await req.text();
  const stripe = getStripe(env.STRIPE_SECRET_KEY);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "verification failed";
    console.error("[webhook] signature verification failed:", message);
    return err(400, "signature verification failed");
  }

  if (event.type !== "checkout.session.completed") {
    return ok(`ignored event type ${event.type}`);
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const applicationId =
    session.metadata?.applicationId ?? session.client_reference_id ?? null;

  if (!applicationId) {
    console.error("[webhook] missing applicationId on session", session.id);
    return ok("no application id, nothing to update");
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  await notifyAppsScript(env, {
    applicationId,
    sessionId: session.id,
    paymentIntentId,
    amountTotal: session.amount_total ?? null,
    currency: session.currency ?? null,
    customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
  });

  return ok("payment recorded");
}
