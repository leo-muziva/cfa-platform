import type { RefundablePayment, RefundRequest } from "@/types/domain";

/**
 * What staff can still refund on a payment, as seen from one refund request.
 *
 * The database figure (payment_refundable_cents) already takes off every open
 * request, this one included. While the request is still waiting for a
 * decision, its own amount is added back, so staff see what was refundable
 * before approving it. decide_refund checks the same way. Once it is approved
 * or paid, the figure is used as is.
 */
export function refundableBeforeDecision(
  refund: Pick<RefundRequest, "status" | "refundableCents" | "amountCents" | "paymentAmountCents">,
): number {
  if (refund.status !== "requested") return refund.refundableCents;
  // never more than the payment itself
  return Math.min(refund.paymentAmountCents, refund.refundableCents + refund.amountCents);
}

export type ReceiptRefundState =
  | { kind: "link"; attemptId: string }
  | { kind: "note"; text: string };

// What a receipt row shows: the refund link, or a short reason why there
// isn't one. refundableCents already takes off refunds and account credit.
export function receiptRefundState(
  payment: Pick<RefundablePayment, "attemptId" | "amountCents" | "refundableCents"> | undefined,
  refunds: Pick<RefundRequest, "paymentAttemptId" | "status">[],
): ReceiptRefundState | null {
  // payments couldn't be loaded, so say nothing rather than guess
  if (!payment) return null;
  if (payment.refundableCents > 0) return { kind: "link", attemptId: payment.attemptId };
  const own = refunds.filter((refund) => refund.paymentAttemptId === payment.attemptId);
  if (own.some((refund) => refund.status === "requested" || refund.status === "approved" || refund.status === "processing")) {
    return { kind: "note", text: "Refund requested" };
  }
  if (own.some((refund) => refund.status === "processed")) return { kind: "note", text: "Refunded" };
  if (payment.amountCents <= 0) return { kind: "note", text: "Nothing to refund" };
  return { kind: "note", text: "Credited to your account, so it can't also be refunded" };
}
