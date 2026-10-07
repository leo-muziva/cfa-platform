import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentKind, RefundablePayment, RefundMethod, RefundRequest, RefundStatus } from "@/types/domain";

// Codes the refund RPCs raise (0031_refunds.sql). The Postgres message is the
// bare code; anything else is reported as "unknown".
export type RefundErrorCode =
  | "forbidden"
  | "invalid_input"
  | "payment_not_found"
  | "payment_not_refundable"
  | "amount_exceeds_refundable"
  | "refund_not_found"
  | "refund_already_decided"
  | "note_required"
  | "provider_refund_unavailable"
  | "invalid_amount"
  | "reference_required"
  | "refund_not_ready"
  | "admin_unavailable"
  | "unknown";

export type RepoResult<T> = { ok: true; data: T } | { ok: false; code: RefundErrorCode };

const KNOWN_CODES: readonly RefundErrorCode[] = [
  "forbidden", "invalid_input", "payment_not_found", "payment_not_refundable", "amount_exceeds_refundable",
  "refund_not_found", "refund_already_decided", "note_required", "provider_refund_unavailable",
  "invalid_amount", "reference_required", "refund_not_ready",
];

function toCode(message: string | undefined): RefundErrorCode {
  const code = message?.trim() ?? "";
  return (KNOWN_CODES as readonly string[]).includes(code) ? code as RefundErrorCode : "unknown";
}

// Money columns come back as bigint text; every club amount fits a JS number.
function cents(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toKind(value: string): PaymentKind {
  return value === "booking" || value === "order" || value === "membership" ? value : "invoice";
}

interface RefundablePaymentRow {
  attempt_id: string;
  payer_id: string;
  payer_name: string | null;
  kind: string;
  provider: string | null;
  amount_cents: string;
  refundable_cents: string;
  completed_at: string | null;
  receipt_number: string | null;
  order_id: string | null;
  invoice_number: string | null;
}

interface RefundRequestRow {
  id: string;
  refund_number: string;
  payment_attempt_id: string;
  payer_id: string;
  payer_name: string | null;
  kind: string;
  payment_amount_cents: string;
  refundable_cents: string;
  amount_cents: string;
  reason: string;
  status: RefundStatus;
  method: RefundMethod | null;
  decision_note: string | null;
  external_reference: string | null;
  failure_reason: string | null;
  provider: string | null;
  has_provider_payment: boolean;
  created_at: string;
  decided_at: string | null;
  processed_at: string | null;
}

export interface StartedProviderRefund {
  refundId: string;
  provider: string | null;
  providerPaymentId: string | null;
  amountCents: string;
  reason: string;
}

interface StartedProviderRefundRow {
  refund_id: string;
  provider: string | null;
  provider_payment_id: string | null;
  amount_cents: string;
  reason: string;
}

function toRefundablePayment(row: RefundablePaymentRow): RefundablePayment {
  return {
    attemptId: row.attempt_id,
    payerId: row.payer_id,
    payerName: row.payer_name ?? "",
    kind: toKind(row.kind),
    provider: row.provider,
    amountCents: cents(row.amount_cents),
    refundableCents: cents(row.refundable_cents),
    completedAt: row.completed_at,
    receiptNumber: row.receipt_number,
    orderId: row.order_id,
    invoiceNumber: row.invoice_number,
  };
}

function toRefundRequest(row: RefundRequestRow): RefundRequest {
  return {
    id: row.id,
    refundNumber: row.refund_number,
    paymentAttemptId: row.payment_attempt_id,
    payerId: row.payer_id,
    payerName: row.payer_name ?? "",
    kind: toKind(row.kind),
    paymentAmountCents: cents(row.payment_amount_cents),
    refundableCents: cents(row.refundable_cents),
    amountCents: cents(row.amount_cents),
    reason: row.reason,
    status: row.status,
    method: row.method,
    decisionNote: row.decision_note,
    externalReference: row.external_reference,
    failureReason: row.failure_reason,
    provider: row.provider,
    hasProviderPayment: row.has_provider_payment === true,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    processedAt: row.processed_at,
  };
}

export async function listRefundablePayments(): Promise<RepoResult<RefundablePayment[]>> {
  const db = await createClient();
  const { data, error } = await db.rpc("list_refundable_payments");
  if (error) return { ok: false, code: toCode(error.message) };
  return { ok: true, data: ((data ?? []) as RefundablePaymentRow[]).map(toRefundablePayment) };
}

export async function listRefundRequests(): Promise<RepoResult<RefundRequest[]>> {
  const db = await createClient();
  const { data, error } = await db.rpc("list_refund_requests");
  if (error) return { ok: false, code: toCode(error.message) };
  return { ok: true, data: ((data ?? []) as RefundRequestRow[]).map(toRefundRequest) };
}

export async function requestRefund(attemptId: string, amountCents: number, reason: string): Promise<RepoResult<string>> {
  const db = await createClient();
  const { data, error } = await db.rpc("request_refund", {
    target_attempt: attemptId,
    target_amount_cents: amountCents,
    target_reason: reason,
  });
  if (error) return { ok: false, code: toCode(error.message) };
  if (typeof data !== "string") return { ok: false, code: "unknown" };
  return { ok: true, data };
}

export async function decideRefund(input: {
  refundId: string;
  approve: boolean;
  method: RefundMethod | null;
  note: string | null;
  amountCents: number | null;
}): Promise<RepoResult<true>> {
  const db = await createClient();
  const { error } = await db.rpc("decide_refund", {
    target_refund: input.refundId,
    target_approve: input.approve,
    target_method: input.method,
    target_note: input.note,
    target_amount_cents: input.amountCents,
  });
  if (error) return { ok: false, code: toCode(error.message) };
  return { ok: true, data: true };
}

// data is false when the refund was already processed (idempotent retry).
export async function completeManualRefund(refundId: string, reference: string): Promise<RepoResult<boolean>> {
  const db = await createClient();
  const { data, error } = await db.rpc("complete_manual_refund", {
    target_refund: refundId,
    target_reference: reference,
  });
  if (error) return { ok: false, code: toCode(error.message) };
  return { ok: true, data: data === true };
}

export async function resolveProcessingRefund(input: {
  refundId: string;
  processed: boolean;
  reference: string | null;
  note: string;
}): Promise<RepoResult<boolean>> {
  const db = await createClient();
  const { error } = await db.rpc("resolve_processing_refund", {
    target_refund: input.refundId,
    target_processed: input.processed,
    target_reference: input.reference,
    target_note: input.note,
  });
  if (error) return { ok: false, code: toCode(error.message) };
  return { ok: true, data: true };
}

export async function startProviderRefund(refundId: string): Promise<RepoResult<StartedProviderRefund>> {
  const db = await createClient();
  const { data, error } = await db.rpc("start_provider_refund", { target_refund: refundId });
  if (error) return { ok: false, code: toCode(error.message) };
  const row = (Array.isArray(data) ? data[0] : data) as StartedProviderRefundRow | null | undefined;
  if (!row?.refund_id) return { ok: false, code: "unknown" };
  return {
    ok: true,
    data: {
      refundId: row.refund_id,
      provider: row.provider,
      providerPaymentId: row.provider_payment_id,
      amountCents: row.amount_cents,
      reason: row.reason,
    },
  };
}

// finish_provider_refund is granted to service_role only, so this runs with
// the admin client. Callers must already have authorised the staff member.
export async function finishProviderRefund(input: {
  refundId: string;
  success: boolean;
  providerReference: string | null;
  failureReason: string | null;
}): Promise<RepoResult<boolean>> {
  const db = createAdminClient();
  if (!db) return { ok: false, code: "admin_unavailable" };
  const { data, error } = await db.rpc("finish_provider_refund", {
    target_refund: input.refundId,
    target_success: input.success,
    target_provider_reference: input.providerReference,
    target_failure_reason: input.failureReason,
  });
  if (error) return { ok: false, code: toCode(error.message) };
  return { ok: true, data: data === true };
}
