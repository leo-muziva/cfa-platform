import { describe, expect, it } from "vitest";
import { formatOrderDate, orderPlacedAt } from "./order-date";

describe("orderPlacedAt", () => {
  const cartStarted = "2026-10-10T12:03:39Z";

  it("uses the payment date, not the day the cart was started", () => {
    const placed = orderPlacedAt(cartStarted, [{ status: "succeeded", completed_at: "2026-10-21T08:15:00Z" }]);
    expect(formatOrderDate(placed)).toBe("21 October 2026");
  });

  it("ignores failed or unfinished attempts", () => {
    expect(orderPlacedAt(cartStarted, [
      { status: "failed", completed_at: "2026-10-15T08:00:00Z" },
      { status: "pending", completed_at: null },
    ])).toBe(cartStarted);
  });

  it("keeps the order's own date when there is no payment", () => {
    expect(orderPlacedAt(cartStarted, null)).toBe(cartStarted);
    expect(formatOrderDate(orderPlacedAt("2026-09-02T09:00:00Z", []))).toBe("2 September 2026");
  });

  it("formats in Cape Town time", () => {
    // 22:30 UTC on the 20th is already the 21st in Cape Town
    expect(formatOrderDate("2026-10-20T22:30:00Z")).toBe("21 October 2026");
  });
});
