import { z } from "zod";
import type { Env } from "../types";
import { getStripe } from "../lib/stripe";

const requestSchema = z.object({
  applicationId: z.string().uuid(),
  email: z.string().email().max(254),
  fullName: z.string().min(1).max(200),
});

function jsonError(message: string, status: number, details?: string): Response {
  const body: { error: string; details?: string } = { error: message };
  if (details) body.details = details;
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function handleCreateCheckoutSession(
  req: Request,
  env: Env,
): Promise<Response> {
  if (req.method !== "POST") {
    return jsonError("method not allowed", 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid json", 400);
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("invalid input", 400, parsed.error.message);
  }

  const { applicationId, email, fullName } = parsed.data;

  if (!env.STRIPE_SECRET_KEY) {
    return jsonError("server misconfigured", 500, "missing stripe secret");
  }
  if (!env.STRIPE_PRICE_ID) {
    return jsonError("server misconfigured", 500, "missing price id");
  }

  const stripe = getStripe(env.STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
      customer_email: email,
      success_url: env.SUCCESS_URL,
      cancel_url: env.CANCEL_URL,
      client_reference_id: applicationId,
      metadata: {
        applicationId,
        applicantEmail: email,
        applicantName: fullName,
      },
      payment_intent_data: {
        metadata: {
          applicationId,
          applicantEmail: email,
        },
      },
    });

    if (!session.url) {
      return jsonError("checkout session created without url", 500);
    }

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[checkout] stripe error:", message);
    return jsonError("checkout session creation failed", 502, message);
  }
}
