import "server-only";
import type { PaymentGateway } from "./gateway";
import { createPayFastGateway } from "./payfast";

export function getPaymentOrigin(): string | null {
  try {
    const url = new URL(process.env.PAYMENT_PUBLIC_ORIGIN ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getPaymentGateway(provider: string | undefined = process.env.PAYMENT_PROVIDER): PaymentGateway | null {
  if (provider !== "payfast_sandbox" || process.env.PAYFAST_SANDBOX_ENABLED !== "true") return null;
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  if (!merchantId?.trim() || !merchantKey?.trim() || !passphrase?.trim()) return null;
  return createPayFastGateway({ merchantId, merchantKey, passphrase });
}
