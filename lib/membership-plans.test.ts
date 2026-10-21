import { describe, expect, it } from "vitest";
import { membershipPricingCards, monthsInWords, termLabel } from "@/components/portal/membership-plans";
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

  it("writes the beginner package's term in words", () => {
    expect(monthsInWords(3)).toBe("three months");
    expect(monthsInWords(1)).toBe("one month");
    expect(monthsInWords(18)).toBe("18 months");
  });
});

describe("membership pricing cards", () => {
  const plans: PublicPricingPlan[] = [
    plan("month_to_month", 550, 1),
    plan("six_month", 3050, 6),
    plan("twelve_month", 6000, 12),
    { ...plan("beginner_package", 1200, 3), joiningFee: null },
  ];

  it("puts the beginner package on its own and the terms in order", () => {
    const { beginner, terms } = membershipPricingCards(plans, true);
    expect(beginner?.features).toContain("To use within three months");
    expect(terms.map((card) => card.key)).toEqual(["month_to_month", "six_month", "twelve_month"]);
    expect(terms[0]).toMatchObject({ period: "month", badge: undefined });
    expect(terms[1].badge).toBe("Pay once for 6 months");
    expect(terms[2].badge).toBe("Pay once for the year");
    expect(terms[1].note).toMatch(/joining fee$/);
    expect(terms[2].href).toBe("/protected/membership?plan=twelve_month#apply-membership");
  });

  it("leaves the buttons out when there's no form to go to", () => {
    const { beginner, terms } = membershipPricingCards(plans, false);
    expect(beginner?.href).toBeUndefined();
    expect(terms.every((card) => card.href === undefined)).toBe(true);
  });

  it("leaves out plans that have no price", () => {
    const { beginner, terms } = membershipPricingCards(
      plans.map((item) => (item.code === "six_month" || item.code === "beginner_package" ? { ...item, price: null } : item)),
      true,
    );
    expect(beginner).toBeNull();
    expect(terms.map((card) => card.key)).toEqual(["month_to_month", "twelve_month"]);
  });
});
