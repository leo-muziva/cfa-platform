import { describe, expect, it } from "vitest";
import { membershipPriceLabel } from "@/lib/membership-price-label";

describe("membershipPriceLabel", () => {
  it("shows the monthly price and the joining fee", () => {
    expect(membershipPriceLabel({ code: "month_to_month", price: 550, term_months: 1, joining_fee: 350 }, 550)).toBe("R550.00 + R350.00 joining fee");
  });

  it("shows the saving on a longer term", () => {
    expect(membershipPriceLabel({ code: "six_month", price: 2970, term_months: 6, joining_fee: 350 }, 550)).toBe("R2 970.00 (10% off) + R350.00 joining fee");
  });

  it("claims no saving when the term costs the same or there is no monthly price", () => {
    expect(membershipPriceLabel({ code: "six_month", price: 3300, term_months: 6, joining_fee: 0 }, 550)).toBe("R3 300.00");
    expect(membershipPriceLabel({ code: "six_month", price: 2970, term_months: 6 }, null)).toBe("R2 970.00");
  });
});
