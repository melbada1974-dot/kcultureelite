export interface Env {
  ENV: string;
  STRIPE_PRICE_ID: string;
  SUCCESS_URL: string;
  CANCEL_URL: string;
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
  url: string;
  sessionId: string;
}

export interface ErrorResponse {
  error: string;
  details?: string;
}
