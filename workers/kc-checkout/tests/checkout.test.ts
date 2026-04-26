import { describe, it, expect } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/types";

const baseEnv: Env = {
  ENV: "test",
  STRIPE_PRICE_ID: "price_test_xxx",
  SUCCESS_URL: "https://kcultureelite.com/success.html?session_id={CHECKOUT_SESSION_ID}",
  CANCEL_URL: "https://kcultureelite.com/?cancelled=true",
  APPS_SCRIPT_WEBHOOK_URL: "",
  STRIPE_SECRET_KEY: "sk_test_dummy",
  STRIPE_WEBHOOK_SECRET: "whsec_dummy",
  APPS_SCRIPT_TOKEN: "test_token",
};

describe("kc-checkout worker", () => {
  it("returns 200 on /health", async () => {
    const req = new Request("https://example.com/health");
    const res = await worker.fetch(req, baseEnv);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; service: string };
    expect(json.status).toBe("ok");
    expect(json.service).toBe("kc-checkout");
  });

  it("returns 404 for unknown route", async () => {
    const req = new Request("https://example.com/nope");
    const res = await worker.fetch(req, baseEnv);
    expect(res.status).toBe(404);
  });

  it("rejects non-POST on /create-checkout-session", async () => {
    const req = new Request("https://example.com/create-checkout-session", {
      method: "GET",
    });
    const res = await worker.fetch(req, baseEnv);
    expect(res.status).toBe(405);
  });

  it("rejects invalid json on /create-checkout-session", async () => {
    const req = new Request("https://example.com/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const res = await worker.fetch(req, baseEnv);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("invalid json");
  });

  it("rejects invalid input on /create-checkout-session", async () => {
    const req = new Request("https://example.com/create-checkout-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId: "not-a-uuid", email: "bad", fullName: "" }),
    });
    const res = await worker.fetch(req, baseEnv);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("invalid input");
  });

  it("rejects /webhook without signature header", async () => {
    const req = new Request("https://example.com/webhook", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await worker.fetch(req, baseEnv);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("missing stripe-signature header");
  });

  it("handles OPTIONS preflight", async () => {
    const req = new Request("https://example.com/create-checkout-session", {
      method: "OPTIONS",
      headers: { origin: "https://kcultureelite.com" },
    });
    const res = await worker.fetch(req, baseEnv);
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://kcultureelite.com");
  });
});
