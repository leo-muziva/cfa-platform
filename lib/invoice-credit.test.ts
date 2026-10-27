import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { invoiceCreditNote } from "./invoice-credit";
import { outstandingAfterCredit } from "@/lib/repositories/PlatformRepository";

describe("invoiceCreditNote", () => {
  it("explains a credit that checkout will apply (CFA-001020 case)", () => {
    expect(invoiceCreditNote(155000, 155000, 30000)).toBe(
      "Your R300.00 account credit is applied to this invoice when you pay, so you pay R1 250.00.",
    );
  });

  it("says when credit covers the whole invoice", () => {
    expect(invoiceCreditNote(30000, 30000, 50000)).toBe(
      "Your R300.00 account credit covers this invoice, so there is nothing to pay.",
    );
  });

  it("shows credit already applied at an earlier checkout", () => {
    expect(invoiceCreditNote(155000, 125000, 0)).toBe(
      "R300.00 has already been taken off with account credit. Left to pay: R1 250.00.",
    );
  });

  it("says nothing without credit", () => {
    expect(invoiceCreditNote(155000, 155000, 0)).toBeNull();
  });
});

describe("outstandingAfterCredit", () => {
  it("matches what checkout charges", () => {
    // Fiona R1 000 + George R550, R300 unused credit
    expect(outstandingAfterCredit([100000, 55000], 30000)).toBe(125000);
    // after checkout applied the credit: R300 off a line, no unused credit left
    expect(outstandingAfterCredit([70000, 55000], 0)).toBe(125000);
    // credit is not counted twice once it has been used and the invoice paid
    expect(outstandingAfterCredit([], 0)).toBe(0);
    expect(outstandingAfterCredit([10000], 30000)).toBe(0);
  });
});
