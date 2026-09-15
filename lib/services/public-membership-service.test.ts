import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/repositories/public-membership-repository", () => ({ listPublicMembershipProducts: vi.fn() }));

import { mapPublicPricingPlans } from "@/lib/services/public-membership-service";

describe("public membership pricing", () => {
  it("maps authoritative CFA products and recognizes the confirmed six-month discount", () => {
    const plans = mapPublicPricingPlans({ products: [
      { code: "month_to_month", name: "Month-to-month", price: 550, joining_fee: 350, term_months: 1, description: null },
      { code: "six_month", name: "Six-month", price: 2970, joining_fee: 350, term_months: 6, description: null },
      { code: "twelve_month", name: "Twelve-month", price: 6000, joining_fee: 350, term_months: 12, description: null },
      { code: "beginner_package", name: "Beginner package", price: 1000, joining_fee: 0, term_months: 3, description: null },
    ] });
    expect(plans.map((plan) => plan.code)).toEqual(["month_to_month", "six_month", "twelve_month", "beginner_package"]);
    expect(plans[1]).toMatchObject({ price: 2970, discountNote: "10% off six monthly dues" });
  });

  it("does not claim a discount when stored price is inconsistent", () => {
    const plans = mapPublicPricingPlans({ products: [
      { code: "month_to_month", name: "Month-to-month", price: 550, joining_fee: 350, term_months: 1, description: null },
      { code: "six_month", name: "Six-month", price: 3050, joining_fee: 350, term_months: 6, description: null },
    ] });
    expect(plans[1].discountNote).toBeNull();
  });

  it("keeps product options visible without invented amounts when pricing fails", () => {
    const plans = mapPublicPricingPlans({ error: "Membership pricing is unavailable" });
    expect(plans).toHaveLength(4);
    expect(plans.every((plan) => plan.price === null)).toBe(true);
  });
});
