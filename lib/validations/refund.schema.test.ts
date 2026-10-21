import { describe, expect, it } from "vitest";
import {
  completeManualRefundSchema,
  decideRefundSchema,
  providerRefundSchema,
  randsToCents,
  requestRefundSchema,
  resolveProcessingRefundSchema,
} from "./refund.schema";

const attemptId = "11111111-1111-4111-8111-111111111111";
const refundId = "22222222-2222-4222-8222-222222222222";

describe("randsToCents", () => {
  it.each([
    ["125.50", 12550],
    ["125.5", 12550],
    ["125", 12500],
    ["0.01", 1],
    ["R 1 250.00", 125000],
    ["1,000", 100000],
    ["0.29", 29],
  ])("converts %s to %i cents", (input, expected) => {
    expect(randsToCents(input)).toBe(expected);
  });

  it.each(["", "abc", "12.345", "-5", "1e3", ".5", "12."])("rejects %s", (input) => {
    expect(randsToCents(input)).toBeNull();
  });
});

describe("requestRefundSchema", () => {
  it("parses a valid request into cents with a trimmed reason", () => {
    const result = requestRefundSchema.safeParse({ attemptId, amount: "125.50", reason: "  Lesson cancelled  " });
    expect(result.success && result.data).toEqual({ attemptId, amountCents: 12550, reason: "Lesson cancelled" });
  });

  it("rejects zero, over-limit and badly formatted amounts", () => {
    expect(requestRefundSchema.safeParse({ attemptId, amount: "0", reason: "x" }).success).toBe(false);
    expect(requestRefundSchema.safeParse({ attemptId, amount: "1000000.01", reason: "x" }).success).toBe(false);
    expect(requestRefundSchema.safeParse({ attemptId, amount: "10.999", reason: "x" }).success).toBe(false);
  });

  it("accepts exactly R1,000,000", () => {
    expect(requestRefundSchema.safeParse({ attemptId, amount: "1000000", reason: "x" }).success).toBe(true);
  });

  it("rejects a blank or overlong reason and a bad attempt id", () => {
    expect(requestRefundSchema.safeParse({ attemptId, amount: "10", reason: "   " }).success).toBe(false);
    expect(requestRefundSchema.safeParse({ attemptId, amount: "10", reason: "a".repeat(501) }).success).toBe(false);
    expect(requestRefundSchema.safeParse({ attemptId: "nope", amount: "10", reason: "x" }).success).toBe(false);
  });
});

describe("decideRefundSchema", () => {
  it("accepts an approval with a method and optional partial amount", () => {
    const result = decideRefundSchema.safeParse({ refundId, decision: "approve", method: "manual_bank", note: "", amount: "50" });
    expect(result.success && result.data).toEqual({ refundId, decision: "approve", method: "manual_bank", note: undefined, amountCents: 5000 });
  });

  it("treats a blank amount as the full requested amount", () => {
    const result = decideRefundSchema.safeParse({ refundId, decision: "approve", method: "provider", amount: "" });
    expect(result.success && result.data.amountCents).toBeUndefined();
  });

  it("requires a method to approve", () => {
    const result = decideRefundSchema.safeParse({ refundId, decision: "approve", method: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["method"]);
  });

  it("requires a note to reject", () => {
    const result = decideRefundSchema.safeParse({ refundId, decision: "reject", note: "   " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["note"]);
  });

  it("accepts a rejection with a note", () => {
    const result = decideRefundSchema.safeParse({ refundId, decision: "reject", note: " Outside policy " });
    expect(result.success && result.data.note).toBe("Outside policy");
  });

  it("rejects an unknown decision or method", () => {
    expect(decideRefundSchema.safeParse({ refundId, decision: "maybe" }).success).toBe(false);
    expect(decideRefundSchema.safeParse({ refundId, decision: "approve", method: "cash" }).success).toBe(false);
  });
});

describe("completeManualRefundSchema and providerRefundSchema", () => {
  it("requires a trimmed reference of 1 to 200 characters", () => {
    expect(completeManualRefundSchema.safeParse({ refundId, reference: " EFT-123 " }).data?.reference).toBe("EFT-123");
    expect(completeManualRefundSchema.safeParse({ refundId, reference: "  " }).success).toBe(false);
    expect(completeManualRefundSchema.safeParse({ refundId, reference: "a".repeat(201) }).success).toBe(false);
  });

  it("requires a refund uuid", () => {
    expect(providerRefundSchema.safeParse({ refundId }).success).toBe(true);
    expect(providerRefundSchema.safeParse({ refundId: "x" }).success).toBe(false);
  });
});

describe("resolveProcessingRefundSchema", () => {
  it("accepts a paid outcome with a reference and a failed outcome without one", () => {
    expect(resolveProcessingRefundSchema.safeParse({ refundId, outcome: "processed", reference: " PF-1 ", note: "Checked" }).success).toBe(true);
    expect(resolveProcessingRefundSchema.safeParse({ refundId, outcome: "failed", note: "Nothing on dashboard" }).success).toBe(true);
  });

  it("requires a reference for a paid outcome and a note for either", () => {
    expect(resolveProcessingRefundSchema.safeParse({ refundId, outcome: "processed", note: "Checked" }).success).toBe(false);
    expect(resolveProcessingRefundSchema.safeParse({ refundId, outcome: "failed", note: "  " }).success).toBe(false);
    expect(resolveProcessingRefundSchema.safeParse({ refundId, outcome: "maybe", note: "Checked" }).success).toBe(false);
  });
});
