// Chooses the payment provider from environment settings. Only the PayFast
// sandbox is wired in so far; with settings missing, online payment is off
// and the UI hides its pay buttons.
import "server-only";
import type { PaymentGateway } from "./gateway";
import { createPayFastGateway } from "./payfast";
import { createPayFastRefundClient, type ProviderRefundClient } from "./payfast-refunds";

/**
 * The public https origin providers send people back to and post webhooks
 * to. Null unless PAYMENT_PUBLIC_ORIGIN is a bare https origin.
 */
export function getPaymentOrigin(): string | null {
  try {
    const url = new URL(process.env.PAYMENT_PUBLIC_ORIGIN ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** The configured payment adapter, or null when payments are not set up. */
export function getPaymentGateway(provider: string | undefined = process.env.PAYMENT_PROVIDER): PaymentGateway | null {
  if (provider !== "payfast_sandbox" || process.env.PAYFAST_SANDBOX_ENABLED !== "true") return null;
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  if (!merchantId?.trim() || !merchantKey?.trim() || !passphrase?.trim()) return null;
  return createPayFastGateway({ merchantId, merchantKey, passphrase });
}

/**
 * Names the settings that stop online payments in this environment, so staff
 * can fix a deployment. Reports setting names only, never their values.
 */
export function paymentSetupIssues(env: NodeJS.ProcessEnv = process.env): string[] {
  const issues: string[] = [];
  if (env.PAYMENT_PROVIDER !== "payfast_sandbox") issues.push("PAYMENT_PROVIDER must be payfast_sandbox");
  if (env.PAYFAST_SANDBOX_ENABLED !== "true") issues.push("PAYFAST_SANDBOX_ENABLED must be true");
  for (const name of ["PAYFAST_MERCHANT_ID", "PAYFAST_MERCHANT_KEY", "PAYFAST_PASSPHRASE", "SUPABASE_SECRET_KEY"] as const) {
    if (!env[name]?.trim()) issues.push(`${name} is not set`);
  }
  try {
    const url = new URL(env.PAYMENT_PUBLIC_ORIGIN ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      issues.push("PAYMENT_PUBLIC_ORIGIN must be a bare https origin, for example https://your-site.vercel.app");
    }
  } catch {
    issues.push("PAYMENT_PUBLIC_ORIGIN is not set");
  }
  if (!env.CRON_SECRET?.trim()) issues.push("CRON_SECRET is not set (scheduled hold expiry and invoicing are disabled)");
  return issues;
}

/** True when PAYFAST_REFUNDS_ENABLED switches on refunds through PayFast. */
export function providerRefundsEnabled(): boolean {
  return process.env.PAYFAST_REFUNDS_ENABLED === "true";
}

// Provider refunds are opt-in and sandbox-only for now. PayFast does not offer refunds in sandbox,
// so this path is unverified against the live API; see lib/payments/payfast-refunds.ts.
export function getRefundClient(provider: string | undefined = process.env.PAYMENT_PROVIDER): ProviderRefundClient | null {
  if (!providerRefundsEnabled() || provider !== "payfast_sandbox") return null;
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  if (!merchantId?.trim() || !passphrase?.trim()) return null;
  return createPayFastRefundClient({ merchantId, passphrase }, { testing: true });
}
