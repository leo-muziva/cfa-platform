import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getPaymentGateway, getPaymentOrigin } from "@/lib/payments/registry";
import type { CheckoutResponse } from "@/lib/payments/gateway";
import { findCheckout, findPaymentStatus, preparePayment, recordPaymentEvent } from "@/lib/repositories/payment-repository";
import { paymentAttemptSchema, paymentEventSchema, paymentTargetSchema } from "@/lib/validations/payment.schema";

type Failure = { ok: false; error: string };

async function isSignedIn() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  return Boolean(user);
}

export async function startPayment(raw: unknown): Promise<{ ok: true; attemptId: string } | Failure> {
  const target = paymentTargetSchema.safeParse(raw);
  if (!target.success) return { ok: false, error: "Choose one valid lesson or invoice to pay." };
  if (!await isSignedIn()) return { ok: false, error: "Please sign in before starting a payment." };
  const provider = getPaymentGateway();
  if (!provider || !getPaymentOrigin()) return { ok: false, error: "Online payments are not configured for this environment." };
  const attempt = await preparePayment(target.data, provider.name);
  if (!attempt) return { ok: false, error: "This payment is unavailable. Refresh to check the balance or lesson hold." };
  return { ok: true, attemptId: attempt.attempt_id };
}

export async function buildCheckout(attemptId: unknown): Promise<{ ok: true; checkout: CheckoutResponse } | Failure> {
  const id = paymentAttemptSchema.safeParse(attemptId);
  if (!id.success || !await isSignedIn()) return { ok: false, error: "Checkout unavailable." };
  const attempt = await findCheckout(id.data);
  if (!attempt) return { ok: false, error: "Checkout unavailable. The payment may be complete or the hold may have expired." };
  const provider = getPaymentGateway(attempt.provider);
  const origin = getPaymentOrigin();
  if (!provider || !origin) return { ok: false, error: "This payment provider is unavailable." };
  const returnUrl = `${origin}/protected/payments/${id.data}`;
  try {
    const checkout = await provider.createCheckout({
      reference: attempt.provider_reference,
      amountCents: attempt.amount_cents,
      currency: attempt.currency,
      description: attempt.description,
      returnUrl,
      cancelUrl: `${returnUrl}?cancelled=1`,
      notifyUrl: `${origin}/api/payments/${provider.name.replace(/_sandbox$/, "")}/webhook`,
    });
    return { ok: true, checkout };
  } catch {
    return { ok: false, error: "Checkout could not be prepared. Please try again." };
  }
}

export async function getPaymentStatus(attemptId: unknown) {
  const id = paymentAttemptSchema.safeParse(attemptId);
  if (!id.success || !await isSignedIn()) return null;
  return findPaymentStatus(id.data);
}

export async function receivePaymentNotification(providerName: string, input: { body: string; headers: Headers; url: string }): Promise<200 | 400 | 404 | 503> {
  const provider = getPaymentGateway(providerName);
  if (!provider) return 404;
  try {
    const event = await provider.verifyWebhook(input);
    const parsed = paymentEventSchema.safeParse(event);
    if (!parsed.success || parsed.data.provider !== provider.name) return 400;
    return await recordPaymentEvent(parsed.data) ? 200 : 503;
  } catch {
    return 503;
  }
}
