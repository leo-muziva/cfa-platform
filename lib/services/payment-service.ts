// Online payment flow, shared by lessons, invoices, shop orders and
// memberships:
//   1. startPayment: the database prices the item and creates a payment
//      attempt (only the account payer is allowed).
//   2. buildCheckout: the payment provider (PayFast, or the sandbox) turns
//      the attempt into a hosted checkout page.
//   3. receivePaymentNotification: the provider's webhook reports the
//      result; the database settles the item, then emails go out.
// Amounts never come from the browser; they are always read from the
// database.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getPaymentGateway, getPaymentOrigin, paymentSetupIssues } from "@/lib/payments/registry";
import type { CheckoutResponse } from "@/lib/payments/gateway";
import { claimPaymentReceipt, claimShopOrderConfirmation, findCheckout, findPaymentStatus, preparePayment, recordPaymentEvent, releasePaymentReceipt, releaseShopOrderConfirmation } from "@/lib/repositories/payment-repository";
import { paymentReceiptEmail, shopOrderConfirmationEmail } from "@/lib/providers/resend-email";
import { getEmailTransport, sendEmail } from "@/lib/providers/email-transport";
import type { PreparePaymentErrorCode } from "@/lib/repositories/payment-repository";
import { paymentAttemptSchema, paymentEventSchema, paymentTargetSchema } from "@/lib/validations/payment.schema";

type Failure = { ok: false; error: string };

export type StartPaymentResult =
  | { ok: true; attemptId: string; pricesChanged: boolean }
  | { ok: false; error: string; code?: PreparePaymentErrorCode };

// User-facing messages for checkout errors, per kind of item being paid.
const ORDER_MESSAGES: Partial<Record<PreparePaymentErrorCode, string>> = {
  forbidden: "Only the account payer can pay for this order. Ask your guardian to pay.",
  empty_order: "Your cart is empty.",
  product_unavailable: "An item in your cart is no longer available. Remove it and try again.",
};

const MEMBERSHIP_MESSAGES: Partial<Record<PreparePaymentErrorCode, string>> = {
  forbidden: "Only the account payer can pay for this membership. Ask your guardian to pay.",
  checkout_unavailable: "This membership is no longer waiting for payment. Refresh to see its status.",
};

// Cheap sign-in check; the RPCs do the real authorization.
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

/**
 * Creates a payment attempt for one lesson, invoice, order or membership.
 * `pricesChanged` is true when a shop price moved since the item was added
 * to the cart, so the UI can warn before sending the payer to checkout.
 */
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

/**
 * Asks the attempt's provider for a checkout form or redirect. The provider
 * returns to /protected/payments/[attemptId] and notifies our webhook route.
 */
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
      // Sandbox providers share the real provider's webhook route.
      notifyUrl: `${origin}/api/payments/${provider.name.replace(/_sandbox$/, "")}/webhook`,
    });
    return { ok: true, checkout };
  } catch {
    return { ok: false, error: "Checkout could not be prepared. Please try again." };
  }
}

/** Current status of a payment attempt, for the "payment processing" page. */
export async function getPaymentStatus(attemptId: unknown) {
  const id = paymentAttemptSchema.safeParse(attemptId);
  if (!id.success || !await isSignedIn()) return null;
  return findPaymentStatus(id.data);
}

/**
 * Handles a provider webhook. Returns the HTTP status for the route to send:
 * 404 unknown provider, 400 bad or mismatched event, 503 so the provider
 * retries when recording failed, 200 once the event is stored.
 */
export async function receivePaymentNotification(providerName: string, input: { body: string; headers: Headers; url: string }): Promise<200 | 400 | 404 | 503> {
  const provider = getPaymentGateway(providerName);
  if (!provider) return 404;
  try {
    const event = await provider.verifyWebhook(input);
    const parsed = paymentEventSchema.safeParse(event);
    if (!parsed.success || parsed.data.provider !== provider.name) return 400;
    if (!await recordPaymentEvent(parsed.data)) return 503;
    if (parsed.data.status === "succeeded") {
      await confirmShopOrder(parsed.data.provider, parsed.data.reference);
      await sendPaymentReceipt(parsed.data.provider, parsed.data.reference);
    }
    return 200;
  } catch {
    return 503;
  }
}

// The payment is already recorded, so an email problem must never fail the
// webhook. The database claim makes provider retries send at most once.
async function confirmShopOrder(provider: string, reference: string): Promise<void> {
  const transport = getEmailTransport();
  if (!transport) return;
  try {
    const claim = await claimShopOrderConfirmation(provider, reference);
    if (!claim) return;
    const origin = getPaymentOrigin();
    const result = await sendEmail(transport, shopOrderConfirmationEmail({
      to: claim.recipient_email,
      recipientName: claim.recipient_name,
      items: claim.items.map((item) => ({ ...item, lineCents: String(item.lineCents) })),
      totalCents: String(claim.total_cents),
      ordersUrl: origin ? `${origin}/protected/shop/orders` : null,
    }));
    if (!result.ok) await releaseShopOrderConfirmation(claim.order_id);
  } catch {
    // Leave the claim in place: retrying an unknown failure could double-send.
  }
}

// Same rules as the shop confirmation: never fail the webhook, send at most once.
async function sendPaymentReceipt(provider: string, reference: string): Promise<void> {
  const transport = getEmailTransport();
  if (!transport) return;
  try {
    const claim = await claimPaymentReceipt(provider, reference);
    if (!claim) return;
    const origin = getPaymentOrigin();
    const result = await sendEmail(transport, paymentReceiptEmail({
      to: claim.recipient_email,
      recipientName: claim.recipient_name,
      kind: claim.kind,
      description: claim.description,
      amountCents: String(claim.amount_cents),
      receiptNumber: claim.receipt_number,
      credited: claim.credited,
      billingUrl: origin ? `${origin}/protected/billing` : null,
    }));
    if (!result.ok) await releasePaymentReceipt(claim.attempt_id);
  } catch {
    // Leave the claim in place: retrying an unknown failure could double-send.
  }
}
