import { describe, expect, it } from "vitest";
import { monthsInWords, termLabel } from "@/components/portal/membership-plans";

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
