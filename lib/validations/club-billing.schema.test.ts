import { describe, expect, it } from "vitest";
import { clubBillingSettingsSchema, invoiceSendSchema } from "./club-billing.schema";

const valid = {
  club_name: " Cape Fencing Academy ", address: "1 Example Street", email: "accounts@example.test",
  bank_name: "Example Bank", account_name: "Cape Fencing Academy", account_number: "0000 000 000", branch_code: "000000",
};

describe("clubBillingSettingsSchema", () => {
  it("accepts and trims complete details", () => {
    const parsed = clubBillingSettingsSchema.parse(valid);
    expect(parsed.club_name).toBe("Cape Fencing Academy");
  });

  it("allows blank optional fields", () => {
    expect(clubBillingSettingsSchema.safeParse({ ...valid, address: "", email: "", bank_name: "", account_number: "", branch_code: "" }).success).toBe(true);
  });

  it("requires a club name", () => {
    const result = clubBillingSettingsSchema.safeParse({ ...valid, club_name: "   " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Enter the club name.");
  });

  it("rejects a bad email, letters in bank numbers and over-long values", () => {
    expect(clubBillingSettingsSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(clubBillingSettingsSchema.safeParse({ ...valid, account_number: "12AB" }).success).toBe(false);
    expect(clubBillingSettingsSchema.safeParse({ ...valid, branch_code: "12-34" }).success).toBe(false);
    expect(clubBillingSettingsSchema.safeParse({ ...valid, address: "x".repeat(301) }).success).toBe(false);
  });
});

describe("invoiceSendSchema", () => {
  it("accepts one invoice by id or every unsent invoice", () => {
    expect(invoiceSendSchema.safeParse({ scope: "one", invoice_id: "2d0f5a52-8a4c-4b55-9b8d-4e2a1c3f5e61" }).success).toBe(true);
    expect(invoiceSendSchema.safeParse({ scope: "all_unsent" }).success).toBe(true);
  });

  it("rejects a missing or malformed invoice id", () => {
    expect(invoiceSendSchema.safeParse({ scope: "one", invoice_id: "abc" }).success).toBe(false);
    expect(invoiceSendSchema.safeParse({ scope: "one", invoice_id: null }).success).toBe(false);
  });
});
