import { describe, expect, it } from "vitest";
import { formatRands, formatRandsWithCents, formatZar, formatZarWithCents } from "@/lib/money";

describe("formatZar", () => {
  it("formats bigint cents without a floating-point conversion", () => {
    expect(formatZar("30000")).toBe("R300");
    expect(formatZar(BigInt("123456789012345"))).toBe("R1 234 567 890 123.45");
  });
});

describe("formatRands", () => {
  it("formats rand columns exactly like cents", () => {
    expect(formatRands(913)).toBe("R913");
    expect(formatRands("2970.5")).toBe("R2 970.50");
    expect(formatRands(0.1 + 0.2)).toBe("R0.30");
    expect(formatRands(-150)).toBe("-R150");
  });
});

describe("with cents, for financial records", () => {
  it("always shows the cents, even on whole rands", () => {
    expect(formatZarWithCents("30000")).toBe("R300.00");
    expect(formatZarWithCents(5)).toBe("R0.05");
    expect(formatRandsWithCents(3738)).toBe("R3 738.00");
    expect(formatRandsWithCents("1351.5")).toBe("R1 351.50");
    expect(formatRandsWithCents(-150)).toBe("-R150.00");
  });
});
