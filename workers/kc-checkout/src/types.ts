export interface Env {
  ENV: string;
  STRIPE_PRICE_ID: string;
  RETURN_URL: string;
  APPS_SCRIPT_WEBHOOK_URL: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  APPS_SCRIPT_TOKEN: string;
}

export interface CheckoutSessionRequest {
  applicationId: string;
  email: string;
  fullName: string;
}

export interface CheckoutSessionResponse {
  clientSecret: string;
  sessionId: string;
}

export interface ErrorResponse {
  error: string;
  details?: string;
}
