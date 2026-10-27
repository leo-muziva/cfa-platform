// Data access for payments. Checkout preparation runs as the signed-in user
// so the database can check they are the payer. Webhook work (recording
// events, claiming emails) has no user session, so it uses the service-role
// client.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentTarget } from "@/lib/validations/payment.schema";
import type { VerifiedPaymentEvent } from "@/lib/payments/gateway";

// What a provider needs to build a checkout for one attempt.
export interface CheckoutRow {
  attempt_id: string;
  provider: string;
  provider_reference: string;
  amount_cents: string;
  currency: "ZAR";
  description: string;
}

// Status of an attempt as shown on the payment result page.
export interface PaymentStatusRow {
  attempt_id: string;
  status: "pending" | "succeeded" | "failed";
  kind: "booking" | "invoice" | "order" | "membership";
  credited: boolean;
  amount_cents: string;
  receipt_number: string | null;
}

// A newly created payment attempt.
export interface PreparedPaymentRow {
  attempt_id: string;
  provider_reference: string;
  amount_cents: string;
  prices_changed: boolean;
}

export type PreparePaymentErrorCode = "forbidden" | "empty_order" | "product_unavailable" | "checkout_unavailable" | "unknown";

export type PreparePaymentResult =
  | { ok: true; attempt: PreparedPaymentRow }
  | { ok: false; code: PreparePaymentErrorCode };

const KNOWN_PREPARE_CODES: readonly PreparePaymentErrorCode[] = ["forbidden", "empty_order", "product_unavailable", "checkout_unavailable"];

// The checkout RPCs raise bare codes (raise exception 'forbidden'), so the
// Postgres message is the code. Anything else is reported as unknown.
function toPrepareCode(message: string | undefined): PreparePaymentErrorCode {
  const code = message?.trim() ?? "";
  return (KNOWN_PREPARE_CODES as readonly string[]).includes(code) ? code as PreparePaymentErrorCode : "unknown";
}

/**
 * Creates a payment attempt with the RPC that matches the target: a shop
 * order, a membership application, or a lesson booking / invoice.
 */
export async function preparePayment(target: PaymentTarget, provider: string): Promise<PreparePaymentResult> {
  const db = await createClient();
  const { data, error } = target.orderId
    ? await db.rpc("prepare_order_checkout", {
      target_order: target.orderId,
      target_provider: provider,
      target_notes: target.notes ?? null,
    })
    : target.membershipApplicationId
      ? await db.rpc("prepare_membership_checkout", {
        target_application: target.membershipApplicationId,
        target_provider: provider,
      })
      : await db.rpc("prepare_payment_checkout", {
      target_booking: target.bookingId ?? null,
      target_invoice: target.invoiceId ?? null,
      target_provider: provider,
    });
  if (error) return { ok: false, code: toPrepareCode(error.message) };
  const row = (Array.isArray(data) ? data[0] : data) as Partial<PreparedPaymentRow> | null | undefined;
  if (!row?.attempt_id || !row.provider_reference || !row.amount_cents) return { ok: false, code: "unknown" };
  return {
    ok: true,
    attempt: {
      attempt_id: row.attempt_id,
      provider_reference: row.provider_reference,
      amount_cents: row.amount_cents,
      prices_changed: row.prices_changed === true,
    },
  };
}

/** Checkout details for an attempt that is still payable, otherwise null. */
export async function findCheckout(attemptId: string): Promise<CheckoutRow | null> {
  const db = await createClient();
  const { data, error } = await db.rpc("get_payment_checkout", { target_attempt: attemptId });
  return error ? null : (Array.isArray(data) ? data[0] ?? null : data) as CheckoutRow | null;
}

/** Status of an attempt the signed-in user may see, otherwise null. */
export async function findPaymentStatus(attemptId: string): Promise<PaymentStatusRow | null> {
  const db = await createClient();
  const { data, error } = await db.rpc("get_payment_status", { target_attempt: attemptId });
  return error ? null : (Array.isArray(data) ? data[0] ?? null : data) as PaymentStatusRow | null;
}

// Data for the shop order confirmation email.
export interface ShopOrderConfirmationRow {
  order_id: string;
  recipient_email: string;
  recipient_name: string;
  items: Array<{ name: string; quantity: number; size: string | null; handedness: "right" | "left" | null; lineCents: number | string }>;
  total_cents: number | string;
}

// Claims the one confirmation email for a settled order. Empty when the
// payment is not a paid shop order or the email was already claimed.
export async function claimShopOrderConfirmation(provider: string, reference: string): Promise<ShopOrderConfirmationRow | null> {
  const db = createAdminClient();
  if (!db) return null;
  const { data, error } = await db.rpc("claim_shop_order_confirmation", { target_provider: provider, target_reference: reference });
  if (error) return null;
  return ((data ?? []) as ShopOrderConfirmationRow[])[0] ?? null;
}

/** Gives the claim back after a failed send so a later retry can try again. */
export async function releaseShopOrderConfirmation(orderId: string): Promise<void> {
  const db = createAdminClient();
  if (!db) return;
  await db.rpc("release_shop_order_confirmation", { target_order: orderId });
}

/**
 * Stores a verified provider event and settles the payment. The RPC ignores
 * an event id it has already seen, so provider retries are safe.
 */
export async function recordPaymentEvent(event: VerifiedPaymentEvent): Promise<boolean> {
  const db = createAdminClient();
  if (!db) return false;
  const { error } = await db.rpc("record_payment_event", {
    target_provider: event.provider,
    target_event_id: event.eventId,
    target_payment_id: event.paymentId,
    target_reference: event.reference,
    target_status: event.status,
    target_amount_cents: event.amountCents,
    target_currency: event.currency,
  });
  return !error;
}

// Data for the payment receipt email.
export interface PaymentReceiptRow {
  attempt_id: string;
  kind: "membership" | "booking" | "invoice";
  recipient_email: string;
  recipient_name: string;
  amount_cents: number | string;
  receipt_number: string | null;
  description: string;
  credited: boolean;
}

// Claims the one receipt email for a settled payment. Empty for shop orders,
// which get their own confirmation, and when the email was already claimed.
export async function claimPaymentReceipt(provider: string, reference: string): Promise<PaymentReceiptRow | null> {
  const db = createAdminClient();
  if (!db) return null;
  const { data, error } = await db.rpc("claim_payment_receipt", { target_provider: provider, target_reference: reference });
  if (error) return null;
  return ((data ?? []) as PaymentReceiptRow[])[0] ?? null;
}

/** Gives the receipt claim back after a failed send. */
export async function releasePaymentReceipt(attemptId: string): Promise<void> {
  const db = createAdminClient();
  if (!db) return;
  await db.rpc("release_payment_receipt", { target_attempt: attemptId });
}
