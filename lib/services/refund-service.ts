import "server-only";
import { getRefundClient, providerRefundsEnabled as registryProviderRefundsEnabled } from "@/lib/payments/registry";
import type { ProviderRefundResult } from "@/lib/payments/payfast-refunds";
import { validationFailure, type FieldErrors } from "@/lib/validations/form-errors";
import {
  completeManualRefund as completeManualRefundRow,
  decideRefund as decideRefundRow,
  finishProviderRefund,
  listRefundablePayments,
  listRefundRequests,
  requestRefund as requestRefundRow,
  resolveProcessingRefund as resolveProcessingRefundRow,
  startProviderRefund,
} from "@/lib/repositories/refund-repository";
import type { RefundErrorCode } from "@/lib/repositories/refund-repository";
import { getCurrentProfile, requireStaff } from "@/lib/services/MemberService";
import {
  completeManualRefundSchema,
  decideRefundSchema,
  providerRefundSchema,
  requestRefundSchema,
  resolveProcessingRefundSchema,
} from "@/lib/validations/refund.schema";
import type { RefundablePayment, RefundRequest } from "@/types/domain";

export type RefundFailure = { ok: false; error: string; code?: RefundErrorCode; fieldErrors?: FieldErrors };
export type RefundResult<T> = { ok: true; data: T } | RefundFailure;

export type ProviderRefundOutcome =
  | { status: "processed"; reference: string | null }
  | { status: "failed"; reason: string }
  | { status: "pending_check" };

const PROVIDER_DISABLED_MESSAGE = "PayFast refunds are not enabled in this environment. Refund manually instead.";
const PROVIDER_UNCERTAIN_MESSAGE =
  "PayFast did not confirm the refund in time. Check the PayFast dashboard, then record the outcome on the Refunds page.";

const ERROR_MESSAGES: Record<RefundErrorCode, string> = {
  forbidden: "Only the account payer can request or view refunds. Ask your guardian to request it.",
  invalid_input: "Check the refund details and try again.",
  payment_not_found: "That payment could not be found.",
  payment_not_refundable: "Only completed payments can be refunded.",
  amount_exceeds_refundable: "That is more than can still be refunded for this payment.",
  refund_not_found: "That refund request could not be found.",
  refund_already_decided: "This refund has already been approved or rejected.",
  note_required: "Add a note explaining why the refund is rejected.",
  provider_refund_unavailable: "This payment was not made through PayFast, so refund it by bank transfer instead.",
  invalid_amount: "The approved amount must be more than R0 and no more than the requested amount.",
  reference_required: "Enter the bank transfer reference.",
  refund_not_ready: "This refund is not ready for that step. Refresh to see its current status.",
  admin_unavailable: "Refund processing is not configured for this environment.",
  unknown: "The refund could not be updated. Please try again.",
};

const STAFF_FORBIDDEN = "Only active staff can manage refunds.";

export function refundErrorMessage(code: RefundErrorCode): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.unknown;
}

function fail(code: RefundErrorCode, staff = false): RefundFailure {
  return { ok: false, error: staff && code === "forbidden" ? STAFF_FORBIDDEN : refundErrorMessage(code), code };
}

async function currentProfileId(): Promise<string | null> {
  const profile = await getCurrentProfile();
  return profile?.id ?? null;
}

async function staffGuard(): Promise<RefundFailure | null> {
  const staff = await requireStaff();
  if ("error" in staff) return { ok: false, error: STAFF_FORBIDDEN, code: "forbidden" };
  return null;
}

// Mirrors the registry so pages can hide the "Send via PayFast" button.
export function providerRefundsEnabled(): boolean {
  return registryProviderRefundsEnabled();
}

// ---------------------------------------------------------------------------
// Payer side. The RPCs return everyone's rows to staff, so these filter to
// the signed-in account: a staff member using the payer pages sees only
// their own payments.
// ---------------------------------------------------------------------------

export async function listMyRefundablePayments(): Promise<RefundResult<RefundablePayment[]>> {
  const profileId = await currentProfileId();
  if (!profileId) return { ok: false, error: "Please sign in to view refunds.", code: "forbidden" };
  const result = await listRefundablePayments();
  if (!result.ok) return fail(result.code);
  return { ok: true, data: result.data.filter((payment) => payment.payerId === profileId) };
}

export async function listMyRefundRequests(): Promise<RefundResult<RefundRequest[]>> {
  const profileId = await currentProfileId();
  if (!profileId) return { ok: false, error: "Please sign in to view refunds.", code: "forbidden" };
  const result = await listRefundRequests();
  if (!result.ok) return fail(result.code);
  return { ok: true, data: result.data.filter((refund) => refund.payerId === profileId) };
}

export async function getMyRefundablePayment(attemptId: string): Promise<RefundResult<RefundablePayment | null>> {
  const result = await listMyRefundablePayments();
  if (!result.ok) return result;
  return { ok: true, data: result.data.find((payment) => payment.attemptId === attemptId) ?? null };
}

export async function requestRefund(raw: unknown): Promise<RefundResult<{ refundId: string }>> {
  const parsed = requestRefundSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...validationFailure(parsed.error), code: "invalid_input" };
  const payment = await getMyRefundablePayment(parsed.data.attemptId);
  if (!payment.ok) return payment;
  if (!payment.data) return fail("payment_not_found");
  if (payment.data.refundableCents <= 0) return fail("amount_exceeds_refundable");
  const result = await requestRefundRow(parsed.data.attemptId, parsed.data.amountCents, parsed.data.reason);
  if (!result.ok) return fail(result.code);
  return { ok: true, data: { refundId: result.data } };
}

// ---------------------------------------------------------------------------
// Staff side. requireStaff() gives a friendly early answer; the RPCs enforce
// active staff again in the database.
// ---------------------------------------------------------------------------

export async function listRefundQueue(): Promise<RefundResult<RefundRequest[]>> {
  const denied = await staffGuard();
  if (denied) return denied;
  const result = await listRefundRequests();
  return result.ok ? result : fail(result.code, true);
}

export async function listRefundablePaymentsForStaff(): Promise<RefundResult<RefundablePayment[]>> {
  const denied = await staffGuard();
  if (denied) return denied;
  const result = await listRefundablePayments();
  return result.ok ? result : fail(result.code, true);
}

export async function raiseRefundForPayer(raw: unknown): Promise<RefundResult<{ refundId: string }>> {
  const denied = await staffGuard();
  if (denied) return denied;
  const parsed = requestRefundSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...validationFailure(parsed.error), code: "invalid_input" };
  const result = await requestRefundRow(parsed.data.attemptId, parsed.data.amountCents, parsed.data.reason);
  if (!result.ok) return fail(result.code, true);
  return { ok: true, data: { refundId: result.data } };
}

export async function decideRefund(raw: unknown): Promise<RefundResult<{ decision: "approve" | "reject" }>> {
  const denied = await staffGuard();
  if (denied) return denied;
  const parsed = decideRefundSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...validationFailure(parsed.error), code: "invalid_input" };
  const approve = parsed.data.decision === "approve";
  const result = await decideRefundRow({
    refundId: parsed.data.refundId,
    approve,
    method: approve ? parsed.data.method ?? null : null,
    note: parsed.data.note ?? null,
    amountCents: approve ? parsed.data.amountCents ?? null : null,
  });
  if (!result.ok) return fail(result.code, true);
  return { ok: true, data: { decision: parsed.data.decision } };
}

export async function completeManualRefund(raw: unknown): Promise<RefundResult<{ alreadyProcessed: boolean }>> {
  const denied = await staffGuard();
  if (denied) return denied;
  const parsed = completeManualRefundSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...validationFailure(parsed.error), code: "invalid_input" };
  const result = await completeManualRefundRow(parsed.data.refundId, parsed.data.reference);
  if (!result.ok) return fail(result.code, true);
  return { ok: true, data: { alreadyProcessed: !result.data } };
}

export async function resolveProcessingRefund(raw: unknown): Promise<RefundResult<{ outcome: "processed" | "failed" }>> {
  const denied = await staffGuard();
  if (denied) return denied;
  const parsed = resolveProcessingRefundSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...validationFailure(parsed.error), code: "invalid_input" };
  const { refundId, outcome, reference, note } = parsed.data;
  const result = await resolveProcessingRefundRow({
    refundId, processed: outcome === "processed", reference: reference || null, note,
  });
  if (!result.ok) return fail(result.code, true);
  return { ok: true, data: { outcome } };
}

// Claims the refund (status 'processing'), asks the provider, then records the
// answer with the service-role RPC. A definite provider rejection releases the
// amount ('failed'); an uncertain one (timeout, network) stays 'processing' so
// the money is never sent twice.
export async function sendProviderRefund(raw: unknown): Promise<RefundResult<ProviderRefundOutcome>> {
  const denied = await staffGuard();
  if (denied) return denied;
  const parsed = providerRefundSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, ...validationFailure(parsed.error), code: "invalid_input" };

  // Check the provider client before claiming, so a disabled environment
  // leaves the refund 'approved' for a manual transfer.
  const queue = await listRefundRequests();
  if (!queue.ok) return fail(queue.code, true);
  const refund = queue.data.find((item) => item.id === parsed.data.refundId);
  if (!refund) return fail("refund_not_found", true);
  if (refund.status !== "approved" || refund.method !== "provider") return fail("refund_not_ready", true);
  // Pass "" rather than undefined so a missing provider never falls back to the env default.
  const client = getRefundClient(refund.provider ?? "");
  if (!client) return { ok: false, error: PROVIDER_DISABLED_MESSAGE, code: "provider_refund_unavailable" };

  const started = await startProviderRefund(refund.id);
  if (!started.ok) return fail(started.code, true);

  let answer: ProviderRefundResult;
  if (!started.data.providerPaymentId) {
    answer = { ok: false, error: "The payment has no PayFast payment id.", retryable: false };
  } else {
    try {
      answer = await client.refund({
        providerPaymentId: started.data.providerPaymentId,
        amountCents: started.data.amountCents,
        reason: started.data.reason,
      });
    } catch {
      answer = { ok: false, error: "PayFast could not be reached.", retryable: true };
    }
  }

  if (!answer.ok && answer.retryable) {
    return { ok: false, error: PROVIDER_UNCERTAIN_MESSAGE, code: "unknown" };
  }

  const finished = await finishProviderRefund({
    refundId: refund.id,
    success: answer.ok,
    providerReference: answer.ok ? answer.reference : null,
    failureReason: answer.ok ? null : answer.error,
  });
  if (!finished.ok) {
    return {
      ok: false,
      error: answer.ok
        ? "PayFast accepted the refund but it could not be recorded. Check the PayFast dashboard, then mark it refunded manually."
        : "PayFast rejected the refund but it could not be recorded. Refresh and try again.",
      code: finished.code,
    };
  }
  return answer.ok
    ? { ok: true, data: { status: "processed", reference: answer.reference } }
    : { ok: true, data: { status: "failed", reason: answer.error } };
}
