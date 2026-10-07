import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getPaymentGateway, getPaymentOrigin, paymentSetupIssues } from "@/lib/payments/registry";
import type { CheckoutResponse } from "@/lib/payments/gateway";
import { findCheckout, findPaymentStatus, preparePayment, recordPaymentEvent } from "@/lib/repositories/payment-repository";
import type { PreparePaymentErrorCode } from "@/lib/repositories/payment-repository";
import { paymentAttemptSchema, paymentEventSchema, paymentTargetSchema } from "@/lib/validations/payment.schema";

type Failure = { ok: false; error: string };

export type StartPaymentResult =
  | { ok: true; attemptId: string; pricesChanged: boolean }
  | { ok: false; error: string; code?: PreparePaymentErrorCode };

const ORDER_MESSAGES: Partial<Record<PreparePaymentErrorCode, string>> = {
  forbidden: "Only the account payer can pay for this order. Ask your guardian to pay.",
  empty_order: "Your cart is empty.",
  product_unavailable: "An item in your cart is no longer available. Remove it and try again.",
};

const MEMBERSHIP_MESSAGES: Partial<Record<PreparePaymentErrorCode, string>> = {
  forbidden: "Only the account payer can pay for this membership. Ask your guardian to pay.",
  checkout_unavailable: "This membership is no longer waiting for payment. Refresh to see its status.",
};

async function isSignedIn() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  return Boolean(user);
}

// Lets the UI hide pay buttons when this environment cannot take payments.
export function onlinePaymentsAvailable(): boolean {
  return Boolean(getPaymentGateway() && getPaymentOrigin());
}

// Setting names only; the admin payments page shows these to staff.
export function getPaymentSetupIssues(): string[] {
  return paymentSetupIssues();
}

export async function startPayment(raw: unknown): Promise<StartPaymentResult> {
  const target = paymentTargetSchema.safeParse(raw);
  if (!target.success) return { ok: false, error: "Choose one valid lesson, invoice, order or membership to pay." };
  if (!await isSignedIn()) return { ok: false, error: "Please sign in before starting a payment." };
  const provider = getPaymentGateway();
  if (!provider || !getPaymentOrigin()) return { ok: false, error: "Online payments are not configured for this environment." };
  const result = await preparePayment(target.data, provider.name);
  if (!result.ok) {
    const error = target.data.orderId
      ? ORDER_MESSAGES[result.code] ?? "This order can't be paid right now. Refresh and try again."
      : target.data.membershipApplicationId
        ? MEMBERSHIP_MESSAGES[result.code] ?? "This membership can't be paid right now. Refresh and try again."
        : "This payment is unavailable. Refresh to check the balance or lesson hold.";
    return { ok: false, error, code: result.code };
  }
  return { ok: true, attemptId: result.attempt.attempt_id, pricesChanged: result.attempt.prices_changed };
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
