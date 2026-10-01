import { describe, expect, it } from "vitest";
import { paymentTargetSchema } from "./payment.schema";

const id = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";

describe("paymentTargetSchema", () => {
  it.each([{ bookingId: id }, { invoiceId: id }, { orderId: id }, { orderId: id, notes: "Size M please" }])(
    "accepts a single target %o",
    (input) => {
      expect(paymentTargetSchema.safeParse(input).success).toBe(true);
    },
  );

  it("trims order notes", () => {
    const parsed = paymentTargetSchema.parse({ orderId: id, notes: "  collect Friday  " });
    expect(parsed.notes).toBe("collect Friday");
  });

  it.each([
    {},
    { bookingId: id, invoiceId: other },
    { bookingId: id, orderId: other },
    { invoiceId: id, orderId: other },
    { bookingId: id, invoiceId: other, orderId: id },
  ])("rejects none or several targets %o", (input) => {
    expect(paymentTargetSchema.safeParse(input).success).toBe(false);
  });

  it.each([{ bookingId: "not-a-uuid" }, { invoiceId: "123" }, { orderId: "" }])("rejects a bad uuid %o", (input) => {
    expect(paymentTargetSchema.safeParse(input).success).toBe(false);
  });

  it("rejects order notes over 500 characters", () => {
    expect(paymentTargetSchema.safeParse({ orderId: id, notes: "x".repeat(501) }).success).toBe(false);
    expect(paymentTargetSchema.safeParse({ orderId: id, notes: "x".repeat(500) }).success).toBe(true);
  });

  it("rejects notes on booking and invoice targets", () => {
    expect(paymentTargetSchema.safeParse({ bookingId: id, notes: "hi" }).success).toBe(false);
    expect(paymentTargetSchema.safeParse({ invoiceId: id, notes: "hi" }).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(paymentTargetSchema.safeParse({ orderId: id, amount: 1 }).success).toBe(false);
  });
});
