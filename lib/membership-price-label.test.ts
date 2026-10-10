import { describe, expect, it } from "vitest";
import { membershipPriceLabel } from "@/lib/membership-price-label";

describe("membershipPriceLabel", () => {
  it("shows the monthly price and the joining fee", () => {
    expect(membershipPriceLabel({ code: "month_to_month", price: 550, term_months: 1, joining_fee: 350 }, 550)).toBe("R550 + R350 joining fee");
  });

  it("shows the saving on a longer term", () => {
    expect(membershipPriceLabel({ code: "six_month", price: 2970, term_months: 6, joining_fee: 350 }, 550)).toBe("R2 970 (10% off) + R350 joining fee");
  });

  it("claims no saving for the beginner package", () => {
    expect(membershipPriceLabel({ code: "beginner_package", price: 1000, term_months: 3, joining_fee: 0 }, 550)).toBe("R1 000");
  });

  it("claims no saving when the term costs the same or there is no monthly price", () => {
    expect(membershipPriceLabel({ code: "six_month", price: 3300, term_months: 6, joining_fee: 0 }, 550)).toBe("R3 300");
    expect(membershipPriceLabel({ code: "six_month", price: 2970, term_months: 6 }, null)).toBe("R2 970");
  });
});
