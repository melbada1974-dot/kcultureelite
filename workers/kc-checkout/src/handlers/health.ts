export function handleHealth(): Response {
  return new Response(
    JSON.stringify({ status: "ok", service: "kc-checkout" }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
