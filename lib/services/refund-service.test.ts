import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getRefundClient = vi.fn();
const providerRefundsEnabledMock = vi.fn();
vi.mock("@/lib/payments/registry", () => ({
  getRefundClient: (...args: unknown[]) => getRefundClient(...args),
  providerRefundsEnabled: () => providerRefundsEnabledMock(),
}));

const repo = {
  listRefundablePayments: vi.fn(),
  listRefundRequests: vi.fn(),
  requestRefund: vi.fn(),
  decideRefund: vi.fn(),
  completeManualRefund: vi.fn(),
  startProviderRefund: vi.fn(),
  finishProviderRefund: vi.fn(),
};
vi.mock("@/lib/repositories/refund-repository", () => ({
  listRefundablePayments: (...a: unknown[]) => repo.listRefundablePayments(...a),
  listRefundRequests: (...a: unknown[]) => repo.listRefundRequests(...a),
  requestRefund: (...a: unknown[]) => repo.requestRefund(...a),
  decideRefund: (...a: unknown[]) => repo.decideRefund(...a),
  completeManualRefund: (...a: unknown[]) => repo.completeManualRefund(...a),
  startProviderRefund: (...a: unknown[]) => repo.startProviderRefund(...a),
  finishProviderRefund: (...a: unknown[]) => repo.finishProviderRefund(...a),
}));

const getCurrentProfile = vi.fn();
const requireStaff = vi.fn();
vi.mock("@/lib/services/MemberService", () => ({
  getCurrentProfile: () => getCurrentProfile(),
  requireStaff: () => requireStaff(),
}));

import {
  completeManualRefund,
  decideRefund,
  getMyRefundablePayment,
  listMyRefundablePayments,
  listMyRefundRequests,
  listRefundQueue,
  providerRefundsEnabled,
  raiseRefundForPayer,
  requestRefund,
  sendProviderRefund,
} from "./refund-service";

const attemptId = "11111111-1111-4111-8111-111111111111";
const otherAttempt = "33333333-3333-4333-8333-333333333333";
const refundId = "22222222-2222-4222-8222-222222222222";

function payment(overrides: Record<string, unknown> = {}) {
  return {
    attemptId, payerId: "payer-1", payerName: "Pat", kind: "order", provider: "payfast_sandbox",
    amountCents: 20000, refundableCents: 20000, completedAt: null, receiptNumber: null, orderId: null, invoiceNumber: null,
    ...overrides,
  };
}

function refund(overrides: Record<string, unknown> = {}) {
  return {
    id: refundId, refundNumber: "RFD-000001", paymentAttemptId: attemptId, payerId: "payer-1", payerName: "Pat",
    kind: "order", paymentAmountCents: 20000, refundableCents: 0, amountCents: 20000, reason: "Cancelled",
    status: "approved", method: "provider", decisionNote: null, externalReference: null, failureReason: null,
    provider: "payfast_sandbox", hasProviderPayment: true, createdAt: "2026-09-01T00:00:00Z", decidedAt: null, processedAt: null,
    ...overrides,
  };
}

const client = { name: "payfast_sandbox", refund: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentProfile.mockResolvedValue({ id: "payer-1", is_staff: false });
  requireStaff.mockResolvedValue({ profile: { id: "staff-1", is_staff: true } });
  getRefundClient.mockReturnValue(client);
  repo.startProviderRefund.mockResolvedValue({
    ok: true,
    data: { refundId, provider: "payfast_sandbox", providerPaymentId: "pf-1", amountCents: "20000", reason: "Cancelled" },
  });
  repo.finishProviderRefund.mockResolvedValue({ ok: true, data: true });
  repo.listRefundRequests.mockResolvedValue({ ok: true, data: [refund()] });
});

describe("payer side", () => {
  it("lists only the signed-in payer's payments and refunds", async () => {
    repo.listRefundablePayments.mockResolvedValue({ ok: true, data: [payment(), payment({ attemptId: otherAttempt, payerId: "someone" })] });
    repo.listRefundRequests.mockResolvedValue({ ok: true, data: [refund(), refund({ id: "x", payerId: "someone" })] });
    const payments = await listMyRefundablePayments();
    const refunds = await listMyRefundRequests();
    expect(payments.ok && payments.data.map((p) => p.attemptId)).toEqual([attemptId]);
    expect(refunds.ok && refunds.data.map((r) => r.id)).toEqual([refundId]);
  });

  it("requires sign-in", async () => {
    getCurrentProfile.mockResolvedValue(null);
    const result = await listMyRefundablePayments();
    expect(result.ok).toBe(false);
    expect(repo.listRefundablePayments).not.toHaveBeenCalled();
  });

  it("maps a forbidden RPC (dependent) to a friendly message", async () => {
    repo.listRefundablePayments.mockResolvedValue({ ok: false, code: "forbidden" });
    const result = await listMyRefundablePayments();
    expect(result).toMatchObject({ ok: false, code: "forbidden" });
    expect(!result.ok && result.error).toMatch(/account payer/);
  });

  it("finds one of my payments or returns null", async () => {
    repo.listRefundablePayments.mockResolvedValue({ ok: true, data: [payment()] });
    expect(await getMyRefundablePayment(attemptId)).toMatchObject({ ok: true, data: { attemptId } });
    expect(await getMyRefundablePayment(otherAttempt)).toEqual({ ok: true, data: null });
  });

  it("requests a refund for my own payment in cents", async () => {
    repo.listRefundablePayments.mockResolvedValue({ ok: true, data: [payment()] });
    repo.requestRefund.mockResolvedValue({ ok: true, data: refundId });
    const result = await requestRefund({ attemptId, amount: "125.50", reason: " Lesson cancelled " });
    expect(result).toEqual({ ok: true, data: { refundId } });
    expect(repo.requestRefund).toHaveBeenCalledWith(attemptId, 12550, "Lesson cancelled");
  });

  it("rejects invalid input before any lookup", async () => {
    const result = await requestRefund({ attemptId, amount: "abc", reason: "x" });
    expect(result.ok).toBe(false);
    expect(repo.listRefundablePayments).not.toHaveBeenCalled();
  });

  it("will not request a refund for someone else's payment", async () => {
    repo.listRefundablePayments.mockResolvedValue({ ok: true, data: [payment({ payerId: "someone" })] });
    const result = await requestRefund({ attemptId, amount: "10", reason: "x" });
    expect(result).toMatchObject({ ok: false, code: "payment_not_found" });
    expect(repo.requestRefund).not.toHaveBeenCalled();
  });

  it("maps amount_exceeds_refundable", async () => {
    repo.listRefundablePayments.mockResolvedValue({ ok: true, data: [payment()] });
    repo.requestRefund.mockResolvedValue({ ok: false, code: "amount_exceeds_refundable" });
    const result = await requestRefund({ attemptId, amount: "10", reason: "x" });
    expect(result).toEqual({ ok: false, code: "amount_exceeds_refundable", error: "That is more than can still be refunded for this payment." });
  });
});

describe("staff side", () => {
  it("blocks non-staff from every staff operation", async () => {
    requireStaff.mockResolvedValue({ error: "Forbidden" });
    for (const result of [
      await listRefundQueue(),
      await raiseRefundForPayer({ attemptId, amount: "10", reason: "x" }),
      await decideRefund({ refundId, decision: "reject", note: "no" }),
      await completeManualRefund({ refundId, reference: "EFT" }),
      await sendProviderRefund({ refundId }),
    ]) {
      expect(result).toMatchObject({ ok: false, code: "forbidden" });
    }
    expect(repo.listRefundRequests).not.toHaveBeenCalled();
    expect(repo.requestRefund).not.toHaveBeenCalled();
    expect(repo.decideRefund).not.toHaveBeenCalled();
    expect(repo.startProviderRefund).not.toHaveBeenCalled();
  });

  it("raises a refund for any payer", async () => {
    repo.requestRefund.mockResolvedValue({ ok: true, data: refundId });
    expect(await raiseRefundForPayer({ attemptId, amount: "20", reason: "Goodwill" })).toEqual({ ok: true, data: { refundId } });
    expect(repo.requestRefund).toHaveBeenCalledWith(attemptId, 2000, "Goodwill");
  });

  it("approves with method and amount, and rejects with a note", async () => {
    repo.decideRefund.mockResolvedValue({ ok: true, data: true });
    await decideRefund({ refundId, decision: "approve", method: "manual_bank", amount: "50" });
    expect(repo.decideRefund).toHaveBeenLastCalledWith({ refundId, approve: true, method: "manual_bank", note: null, amountCents: 5000 });
    await decideRefund({ refundId, decision: "reject", note: "Outside policy", method: "provider", amount: "5" });
    expect(repo.decideRefund).toHaveBeenLastCalledWith({ refundId, approve: false, method: null, note: "Outside policy", amountCents: null });
  });

  it("requires a note to reject without calling the RPC", async () => {
    const result = await decideRefund({ refundId, decision: "reject" });
    expect(result.ok).toBe(false);
    expect(repo.decideRefund).not.toHaveBeenCalled();
  });

  it("maps decide errors", async () => {
    repo.decideRefund.mockResolvedValue({ ok: false, code: "refund_already_decided" });
    const result = await decideRefund({ refundId, decision: "approve", method: "provider" });
    expect(result).toMatchObject({ ok: false, code: "refund_already_decided", error: "This refund has already been approved or rejected." });
  });

  it("completes a manual refund and reports an idempotent repeat", async () => {
    repo.completeManualRefund.mockResolvedValue({ ok: true, data: true });
    expect(await completeManualRefund({ refundId, reference: " EFT-1 " })).toEqual({ ok: true, data: { alreadyProcessed: false } });
    expect(repo.completeManualRefund).toHaveBeenCalledWith(refundId, "EFT-1");
    repo.completeManualRefund.mockResolvedValue({ ok: true, data: false });
    expect(await completeManualRefund({ refundId, reference: "EFT-1" })).toEqual({ ok: true, data: { alreadyProcessed: true } });
  });

  it("passes providerRefundsEnabled through", () => {
    providerRefundsEnabledMock.mockReturnValue(true);
    expect(providerRefundsEnabled()).toBe(true);
  });
});

describe("sendProviderRefund", () => {
  it("does not claim the refund when no provider client is available", async () => {
    getRefundClient.mockReturnValue(null);
    const result = await sendProviderRefund({ refundId });
    expect(result).toEqual({
      ok: false, code: "provider_refund_unavailable",
      error: "PayFast refunds are not enabled in this environment. Refund manually instead.",
    });
    expect(repo.startProviderRefund).not.toHaveBeenCalled();
  });

  it("refuses a refund that is not an approved provider refund", async () => {
    repo.listRefundRequests.mockResolvedValue({ ok: true, data: [refund({ method: "manual_bank" })] });
    expect(await sendProviderRefund({ refundId })).toMatchObject({ ok: false, code: "refund_not_ready" });
    repo.listRefundRequests.mockResolvedValue({ ok: true, data: [] });
    expect(await sendProviderRefund({ refundId })).toMatchObject({ ok: false, code: "refund_not_found" });
    expect(repo.startProviderRefund).not.toHaveBeenCalled();
  });

  it("records a successful provider refund", async () => {
    client.refund.mockResolvedValue({ ok: true, reference: "pf-ref" });
    const result = await sendProviderRefund({ refundId });
    expect(getRefundClient).toHaveBeenCalledWith("payfast_sandbox");
    expect(client.refund).toHaveBeenCalledWith({ providerPaymentId: "pf-1", amountCents: "20000", reason: "Cancelled" });
    expect(repo.finishProviderRefund).toHaveBeenCalledWith({ refundId, success: true, providerReference: "pf-ref", failureReason: null });
    expect(result).toEqual({ ok: true, data: { status: "processed", reference: "pf-ref" } });
  });

  it("records a definite provider rejection as failed", async () => {
    client.refund.mockResolvedValue({ ok: false, error: "Insufficient balance", retryable: false });
    const result = await sendProviderRefund({ refundId });
    expect(repo.finishProviderRefund).toHaveBeenCalledWith({ refundId, success: false, providerReference: null, failureReason: "Insufficient balance" });
    expect(result).toEqual({ ok: true, data: { status: "failed", reason: "Insufficient balance" } });
  });

  it("leaves an uncertain refund processing and tells staff to check PayFast", async () => {
    client.refund.mockResolvedValue({ ok: false, error: "timeout", retryable: true });
    const result = await sendProviderRefund({ refundId });
    expect(repo.finishProviderRefund).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/PayFast dashboard/);
  });

  it("treats a thrown client error as uncertain", async () => {
    client.refund.mockRejectedValue(new Error("network"));
    const result = await sendProviderRefund({ refundId });
    expect(repo.finishProviderRefund).not.toHaveBeenCalled();
    expect(!result.ok && result.error).toMatch(/PayFast dashboard/);
  });

  it("maps a start failure without calling the provider", async () => {
    repo.startProviderRefund.mockResolvedValue({ ok: false, code: "refund_not_ready" });
    expect(await sendProviderRefund({ refundId })).toMatchObject({ ok: false, code: "refund_not_ready" });
    expect(client.refund).not.toHaveBeenCalled();
  });

  it("warns staff when PayFast accepted but recording failed", async () => {
    client.refund.mockResolvedValue({ ok: true, reference: null });
    repo.finishProviderRefund.mockResolvedValue({ ok: false, code: "admin_unavailable" });
    const result = await sendProviderRefund({ refundId });
    expect(!result.ok && result.error).toMatch(/accepted the refund but it could not be recorded/);
  });
});
