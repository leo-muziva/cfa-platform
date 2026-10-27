import { describe, expect, it } from "vitest";
import { familyChangeSchema, familyReviewSchema, isAdultOn } from "./family.schema";

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

describe("isAdultOn", () => {
  it("counts someone as an adult from their 18th birthday", () => {
    expect(isAdultOn("2008-10-21", "2026-10-21")).toBe(true);
    expect(isAdultOn("2008-10-22", "2026-10-21")).toBe(false);
    expect(isAdultOn("1990-01-01", "2026-10-21")).toBe(true);
  });

  it("treats a child or a missing date of birth as not an adult", () => {
    expect(isAdultOn("2014-03-14", "2026-10-21")).toBe(false);
    expect(isAdultOn(null, "2026-10-21")).toBe(false);
  });
});
