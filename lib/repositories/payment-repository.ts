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
  kind: "booking" | "invoice";
  credited: boolean;
  amount_cents: string;
}

export async function preparePayment(target: PaymentTarget, provider: string) {
  const db = await createClient();
  const { data, error } = await db.rpc("prepare_payment_checkout", {
    target_booking: target.bookingId ?? null,
    target_invoice: target.invoiceId ?? null,
    target_provider: provider,
  });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { attempt_id: string; provider_reference: string; amount_cents: string } | null;
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
