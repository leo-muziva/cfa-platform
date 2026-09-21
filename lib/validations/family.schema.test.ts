import { describe, expect, it } from "vitest";
import { familyChangeSchema, familyReviewSchema } from "./family.schema";

const linkId = "92000000-0000-4000-8000-000000000001";
describe("family change validation", () => {
  it("requires an existing account email for transfers", () => {
    expect(familyChangeSchema.safeParse({ linkId, kind: "transfer", reason: "Moving household" }).success).toBe(false);
    expect(familyChangeSchema.safeParse({ linkId, kind: "transfer", reason: "Moving household", newPayerEmail: "payer@cfa.test" }).success).toBe(true);
  });
  it("allows an unlink request without selecting a payer", () => {
    expect(familyChangeSchema.safeParse({ linkId, kind: "unlink", reason: "Independent adult" }).success).toBe(true);
  });
  it("requires a bounded meaningful staff note and a real decision", () => {
    expect(familyReviewSchema.safeParse({ requestId: linkId, approve: true, note: "  " }).success).toBe(false);
    expect(familyReviewSchema.safeParse({ requestId: linkId, approve: "true", note: "Reviewed" }).success).toBe(false);
    expect(familyReviewSchema.safeParse({ requestId: linkId, approve: false, note: "Transfer required" }).success).toBe(true);
  });
});
