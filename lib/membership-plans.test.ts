import { describe, expect, it } from "vitest";
import { savingPercent, termLabel } from "@/components/portal/membership-plans";
import type { PublicPricingPlan } from "@/lib/services/public-membership-service";

const plan = (code: PublicPricingPlan["code"], price: number, termMonths: number): PublicPricingPlan => ({
  code,
  name: code,
  price,
  termMonths,
  joiningFee: 350,
  description: null,
  discountNote: null,
});

describe("membership plans", () => {
  it("names the terms like the page does", () => {
    expect(termLabel(1)).toBe("Month to month");
    expect(termLabel(6)).toBe("6 months");
    expect(termLabel(12)).toBe("12 months");
  });

  it("works out the saving against paying month to month, to the nearest half percent", () => {
    // R3 050 vs 6 x R550 = 7.6%, R6 000 vs 12 x R550 = 9.1%
    expect(savingPercent(plan("six_month", 3050, 6), 550)).toBe(7.5);
    expect(savingPercent(plan("twelve_month", 6000, 12), 550)).toBe(9);
  });

  it("shows no saving for the monthly plan or when there isn't one", () => {
    expect(savingPercent(plan("month_to_month", 550, 1), 550)).toBeNull();
    expect(savingPercent(plan("six_month", 3300, 6), 550)).toBeNull();
    expect(savingPercent(plan("six_month", 3050, 6), null)).toBeNull();
  });
});
