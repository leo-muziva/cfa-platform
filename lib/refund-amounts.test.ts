import { describe, expect, it } from "vitest";
import { receiptRefundState, refundableBeforeDecision } from "@/lib/refund-amounts";

// refundableCents is what payment_refundable_cents returns: the payment minus
// every refund that is requested, approved, processing or processed.
const payment = 123750;

describe("refundableBeforeDecision", () => {
  it("shows the full payment for a new full-amount request", () => {
    expect(refundableBeforeDecision({ status: "requested", paymentAmountCents: payment, amountCents: payment, refundableCents: 0 })).toBe(payment);
  });

  it("shows the full payment for a new partial request with no other refunds", () => {
    expect(refundableBeforeDecision({ status: "requested", paymentAmountCents: payment, amountCents: 50000, refundableCents: 73750 })).toBe(payment);
  });

  it("only adds back this request when another refund was already approved", () => {
    // R200 approved earlier, R300 now requested
    expect(refundableBeforeDecision({ status: "requested", paymentAmountCents: payment, amountCents: 30000, refundableCents: 73750 })).toBe(103750);
  });

  it("uses the database figure once a partial refund is approved", () => {
    expect(refundableBeforeDecision({ status: "approved", paymentAmountCents: payment, amountCents: 50000, refundableCents: 73750 })).toBe(73750);
  });

  it("shows nothing left after an approved or processed full refund", () => {
    expect(refundableBeforeDecision({ status: "approved", paymentAmountCents: payment, amountCents: payment, refundableCents: 0 })).toBe(0);
    expect(refundableBeforeDecision({ status: "processed", paymentAmountCents: payment, amountCents: payment, refundableCents: 0 })).toBe(0);
  });

  it("never shows more than the payment", () => {
    expect(refundableBeforeDecision({ status: "requested", paymentAmountCents: 1000, amountCents: 1000, refundableCents: 500 })).toBe(1000);
  });
});

describe("receiptRefundState", () => {
  const payment = { attemptId: "a1", amountCents: 30000, refundableCents: 30000 };

  it("links to a refund while something can be refunded", () => {
    expect(receiptRefundState(payment, [])).toEqual({ kind: "link", attemptId: "a1" });
  });

  it("says why there is no link", () => {
    const spent = { ...payment, refundableCents: 0 };
    expect(receiptRefundState(spent, [{ paymentAttemptId: "a1", status: "requested" }])).toEqual({ kind: "note", text: "Refund requested" });
    expect(receiptRefundState(spent, [{ paymentAttemptId: "a1", status: "processed" }])).toEqual({ kind: "note", text: "Refunded" });
    // a cancelled lesson that was credited instead
    expect(receiptRefundState(spent, [{ paymentAttemptId: "other", status: "processed" }])).toEqual({
      kind: "note", text: "Credited to your account, so it can't also be refunded",
    });
    expect(receiptRefundState({ ...spent, amountCents: 0 }, [])).toEqual({ kind: "note", text: "Nothing to refund" });
  });

  it("shows nothing when the payment wasn't found", () => {
    expect(receiptRefundState(undefined, [])).toBeNull();
  });
});
