import { describe, expect, it } from "vitest";
import {
  addToCartSchema,
  checkoutSchema,
  removeItemSchema,
  updateQuantitySchema,
} from "./shop.schema";

const itemId = "00000000-0000-4000-8000-000000000001";

describe("addToCartSchema", () => {
  it("accepts a product with an optional size and hand", () => {
    expect(addToCartSchema.parse({ productId: 4, size: " M ", handedness: "left" })).toEqual({
      productId: 4,
      size: "M",
      handedness: "left",
    });
    expect(addToCartSchema.parse({ productId: 4, size: null, handedness: null })).toEqual({
      productId: 4,
      size: null,
      handedness: null,
    });
  });

  it("treats a blank size as no size", () => {
    expect(addToCartSchema.parse({ productId: 1, size: "  ", handedness: null }).size).toBeNull();
  });

  it("rejects bad ids, long sizes, unknown hands and client prices", () => {
    expect(addToCartSchema.safeParse({ productId: 0, size: null, handedness: null }).success).toBe(false);
    expect(addToCartSchema.safeParse({ productId: 1.5, size: null, handedness: null }).success).toBe(false);
    expect(addToCartSchema.safeParse({ productId: 1, size: "x".repeat(41), handedness: null }).success).toBe(false);
    expect(addToCartSchema.safeParse({ productId: 1, size: null, handedness: "both" }).success).toBe(false);
    expect(
      addToCartSchema.safeParse({ productId: 1, size: null, handedness: null, unitPrice: 0 }).success
    ).toBe(false);
  });
});

describe("updateQuantitySchema", () => {
  it("accepts 0 to 99", () => {
    expect(updateQuantitySchema.safeParse({ itemId, quantity: 0 }).success).toBe(true);
    expect(updateQuantitySchema.safeParse({ itemId, quantity: 99 }).success).toBe(true);
  });

  it("rejects negative, too large, fractional and non-uuid input", () => {
    expect(updateQuantitySchema.safeParse({ itemId, quantity: -1 }).success).toBe(false);
    expect(updateQuantitySchema.safeParse({ itemId, quantity: 100 }).success).toBe(false);
    expect(updateQuantitySchema.safeParse({ itemId, quantity: 1.5 }).success).toBe(false);
    expect(updateQuantitySchema.safeParse({ itemId: "abc", quantity: 1 }).success).toBe(false);
  });
});

describe("removeItemSchema", () => {
  it("requires a uuid", () => {
    expect(removeItemSchema.safeParse({ itemId }).success).toBe(true);
    expect(removeItemSchema.safeParse({ itemId: "1" }).success).toBe(false);
  });
});

describe("checkoutSchema", () => {
  it("trims optional notes and caps them at 500 characters", () => {
    expect(checkoutSchema.parse({ notes: "  size check  " })).toEqual({ notes: "size check" });
    expect(checkoutSchema.parse({})).toEqual({});
    expect(checkoutSchema.safeParse({ notes: "x".repeat(501) }).success).toBe(false);
  });

  it("does not accept an order id or amount from the browser", () => {
    expect(checkoutSchema.safeParse({ orderId: itemId }).success).toBe(false);
    expect(checkoutSchema.safeParse({ amountCents: 1 }).success).toBe(false);
  });
});
