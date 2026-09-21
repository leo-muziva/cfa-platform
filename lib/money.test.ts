import { describe, expect, it } from "vitest";
import { formatZar } from "@/lib/money";

describe("formatZar", () => {
  it("formats bigint cents without a floating-point conversion", () => {
    expect(formatZar("30000")).toBe("R300.00");
    expect(formatZar(BigInt("123456789012345"))).toBe("R1 234 567 890 123.45");
  });
});
