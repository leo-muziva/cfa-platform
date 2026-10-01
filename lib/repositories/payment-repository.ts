import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentTarget } from "@/lib/validations/payment.schema";
import type { VerifiedPaymentEvent } from "@/lib/payments/gateway";

export interface CheckoutRow {
  attempt_id: string;
  provider: string;
  provider_reference: string;
  amount_cents: string;
  currency: "ZAR";
  description: string;
}

export interface PaymentStatusRow {
  attempt_id: string;
  status: "pending" | "succeeded" | "failed";
  kind: "booking" | "invoice" | "order";
  credited: boolean;
  amount_cents: string;
}

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

export async function preparePayment(target: PaymentTarget, provider: string): Promise<PreparePaymentResult> {
  const db = await createClient();
  const { data, error } = target.orderId
    ? await db.rpc("prepare_order_checkout", {
      target_order: target.orderId,
      target_provider: provider,
      target_notes: target.notes ?? null,
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

export async function findCheckout(attemptId: string): Promise<CheckoutRow | null> {
  const db = await createClient();
  const { data, error } = await db.rpc("get_payment_checkout", { target_attempt: attemptId });
  return error ? null : (Array.isArray(data) ? data[0] ?? null : data) as CheckoutRow | null;
}

export async function findPaymentStatus(attemptId: string): Promise<PaymentStatusRow | null> {
  const db = await createClient();
  const { data, error } = await db.rpc("get_payment_status", { target_attempt: attemptId });
  return error ? null : (Array.isArray(data) ? data[0] ?? null : data) as PaymentStatusRow | null;
}

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
