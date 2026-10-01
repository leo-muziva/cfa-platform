import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/services/payment-service", () => ({
  startPayment: vi.fn(),
  onlinePaymentsAvailable: vi.fn(() => true),
}));
vi.mock("@/lib/repositories/shop-order-repository", () => ({
  actorCanPay: vi.fn(),
  countCartItems: vi.fn(),
  createDraftOrder: vi.fn(),
  deleteLine: vi.fn(),
  findCollectingBulkProgress: vi.fn(),
  findMatchingLine: vi.fn(),
  findOpenCart: vi.fn(),
  findOpenCartHeader: vi.fn(),
  findProduct: vi.fn(),
  getCurrentUserId: vi.fn(),
  insertLine: vi.fn(),
  listCustomerOrders: vi.fn(),
  reopenOrderCart: vi.fn(),
  updateLineQuantity: vi.fn(),
}));

import * as repo from "@/lib/repositories/shop-order-repository";
import * as payments from "@/lib/services/payment-service";
import {
  SHOP_MESSAGES,
  addToCart,
  checkoutOrder,
  getBulkProgress,
  getCart,
  getCartCount,
  removeItem,
  reopenOrder,
  sizeOptions,
  updateQuantity,
} from "./shop-order-service";
import type { ShopCart } from "@/types/domain";

const mocked = vi.mocked(repo);
const mockedPayments = vi.mocked(payments);

const userId = "00000000-0000-4000-8000-000000000001";
const orderId = "00000000-0000-4000-8000-000000000002";
const itemId = "00000000-0000-4000-8000-000000000003";

const plainProduct = { id: 7, price: 250, sizes: null, needsHandedness: false, isActive: true };
const sizedHandedProduct = { id: 8, price: 1200.5, sizes: "S, M, L", needsHandedness: true, isActive: true };

function cart(overrides: Partial<ShopCart> = {}): ShopCart {
  return {
    orderId,
    status: "draft",
    notes: null,
    lines: [
      {
        id: itemId,
        productId: 7,
        itemCode: "EF01",
        name: "Foil",
        imagePath: null,
        size: null,
        handedness: null,
        quantity: 2,
        unitPriceCents: 25000,
      },
    ],
    totalCents: 50000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getCurrentUserId.mockResolvedValue(userId);
  mocked.findOpenCartHeader.mockResolvedValue({ id: orderId, status: "draft" });
  mocked.findMatchingLine.mockResolvedValue(null);
  mocked.insertLine.mockResolvedValue(true);
  mocked.updateLineQuantity.mockResolvedValue(true);
  mocked.deleteLine.mockResolvedValue(true);
  mocked.actorCanPay.mockResolvedValue(true);
  mockedPayments.onlinePaymentsAvailable.mockReturnValue(true);
});

describe("sizeOptions", () => {
  it("splits and trims the comma-separated sizes column", () => {
    expect(sizeOptions("S, M ,L,")).toEqual(["S", "M", "L"]);
    expect(sizeOptions(null)).toEqual([]);
  });
});

describe("addToCart", () => {
  it("requires a signed-in customer", async () => {
    mocked.getCurrentUserId.mockResolvedValue(null);
    expect(await addToCart({ productId: 7, size: null, handedness: null })).toMatchObject({
      ok: false,
      error: SHOP_MESSAGES.signIn,
    });
    expect(mocked.insertLine).not.toHaveBeenCalled();
  });

  it("rejects invalid input before touching the database", async () => {
    expect((await addToCart({ productId: -1, size: null, handedness: null })).ok).toBe(false);
    expect(mocked.getCurrentUserId).not.toHaveBeenCalled();
  });

  it("adds a new line at the catalogue price", async () => {
    mocked.findProduct.mockResolvedValue(plainProduct);
    expect(await addToCart({ productId: 7, size: null, handedness: null })).toEqual({ ok: true });
    expect(mocked.insertLine).toHaveBeenCalledWith({
      orderId,
      productId: 7,
      quantity: 1,
      size: null,
      handedness: null,
      unitPrice: 250,
    });
  });

  it("creates a draft when the customer has no cart", async () => {
    mocked.findOpenCartHeader.mockResolvedValue(null);
    mocked.createDraftOrder.mockResolvedValue("new-order");
    mocked.findProduct.mockResolvedValue(plainProduct);
    expect((await addToCart({ productId: 7, size: null, handedness: null })).ok).toBe(true);
    expect(mocked.insertLine).toHaveBeenCalledWith(expect.objectContaining({ orderId: "new-order" }));
  });

  it("increments an identical line instead of adding another", async () => {
    mocked.findProduct.mockResolvedValue(sizedHandedProduct);
    mocked.findMatchingLine.mockResolvedValue({ id: itemId, quantity: 2 });
    expect((await addToCart({ productId: 8, size: "M", handedness: "left" })).ok).toBe(true);
    expect(mocked.findMatchingLine).toHaveBeenCalledWith(orderId, 8, "M", "left");
    expect(mocked.updateLineQuantity).toHaveBeenCalledWith(orderId, itemId, 3);
    expect(mocked.insertLine).not.toHaveBeenCalled();
  });

  it("requires a listed size for a sized product and none for a one-size product", async () => {
    mocked.findProduct.mockResolvedValue(sizedHandedProduct);
    expect(await addToCart({ productId: 8, size: null, handedness: "right" })).toMatchObject({
      error: SHOP_MESSAGES.chooseSize,
    });
    expect(await addToCart({ productId: 8, size: "XXL", handedness: "right" })).toMatchObject({
      error: SHOP_MESSAGES.chooseSize,
    });
    mocked.findProduct.mockResolvedValue(plainProduct);
    expect(await addToCart({ productId: 7, size: "M", handedness: null })).toMatchObject({
      error: SHOP_MESSAGES.noSize,
    });
    expect(mocked.insertLine).not.toHaveBeenCalled();
  });

  it("requires handedness exactly when the product needs it", async () => {
    mocked.findProduct.mockResolvedValue(sizedHandedProduct);
    expect(await addToCart({ productId: 8, size: "S", handedness: null })).toMatchObject({
      error: SHOP_MESSAGES.chooseHand,
    });
    mocked.findProduct.mockResolvedValue(plainProduct);
    expect(await addToCart({ productId: 7, size: null, handedness: "left" })).toMatchObject({
      error: SHOP_MESSAGES.noHand,
    });
  });

  it("rejects inactive, missing and price-on-request products", async () => {
    mocked.findProduct.mockResolvedValue({ ...plainProduct, isActive: false });
    expect(await addToCart({ productId: 7, size: null, handedness: null })).toMatchObject({
      error: SHOP_MESSAGES.productUnavailable,
    });
    mocked.findProduct.mockResolvedValue(null);
    expect(await addToCart({ productId: 7, size: null, handedness: null })).toMatchObject({
      error: SHOP_MESSAGES.productUnavailable,
    });
    mocked.findProduct.mockResolvedValue({ ...plainProduct, price: 0 });
    expect(await addToCart({ productId: 7, size: null, handedness: null })).toMatchObject({
      error: SHOP_MESSAGES.priceOnRequest,
    });
  });

  it("refuses to change a cart that is waiting for payment", async () => {
    mocked.findProduct.mockResolvedValue(plainProduct);
    mocked.findOpenCartHeader.mockResolvedValue({ id: orderId, status: "pending_payment" });
    expect(await addToCart({ productId: 7, size: null, handedness: null })).toEqual({
      ok: false,
      error: SHOP_MESSAGES.pendingPayment,
      code: "pending_payment",
    });
    expect(mocked.insertLine).not.toHaveBeenCalled();
  });
});

describe("updateQuantity and removeItem", () => {
  it("updates a line within the customer's draft", async () => {
    expect(await updateQuantity({ itemId, quantity: 4 })).toEqual({ ok: true });
    expect(mocked.updateLineQuantity).toHaveBeenCalledWith(orderId, itemId, 4);
  });

  it("removes the line when quantity is 0", async () => {
    expect(await updateQuantity({ itemId, quantity: 0 })).toEqual({ ok: true });
    expect(mocked.deleteLine).toHaveBeenCalledWith(orderId, itemId);
    expect(mocked.updateLineQuantity).not.toHaveBeenCalled();
  });

  it("rejects out-of-range quantities", async () => {
    expect((await updateQuantity({ itemId, quantity: 100 })).ok).toBe(false);
    expect(mocked.updateLineQuantity).not.toHaveBeenCalled();
  });

  it("refuses changes while waiting for payment", async () => {
    mocked.findOpenCartHeader.mockResolvedValue({ id: orderId, status: "pending_payment" });
    expect(await updateQuantity({ itemId, quantity: 3 })).toMatchObject({ error: SHOP_MESSAGES.pendingPayment });
    expect(await removeItem({ itemId })).toMatchObject({ error: SHOP_MESSAGES.pendingPayment });
    expect(mocked.updateLineQuantity).not.toHaveBeenCalled();
    expect(mocked.deleteLine).not.toHaveBeenCalled();
  });

  it("reports a line that is not in the customer's cart", async () => {
    mocked.deleteLine.mockResolvedValue(false);
    expect(await removeItem({ itemId })).toMatchObject({ ok: false, error: SHOP_MESSAGES.itemMissing });
  });

  it("requires a signed-in customer", async () => {
    mocked.getCurrentUserId.mockResolvedValue(null);
    expect(await removeItem({ itemId })).toMatchObject({ error: SHOP_MESSAGES.signIn });
  });
});

describe("getCartCount and getCart", () => {
  it("returns 0 when signed out", async () => {
    mocked.getCurrentUserId.mockResolvedValue(null);
    expect(await getCartCount()).toBe(0);
  });

  it("counts items in the open cart", async () => {
    mocked.countCartItems.mockResolvedValue(5);
    expect(await getCartCount()).toBe(5);
  });

  it("returns the cart with payer and availability flags", async () => {
    mocked.findOpenCart.mockResolvedValue(cart());
    mocked.actorCanPay.mockResolvedValue(false);
    mockedPayments.onlinePaymentsAvailable.mockReturnValue(false);
    expect(await getCart()).toEqual({ ok: true, cart: cart(), canPay: false, paymentsAvailable: false });
  });
});

describe("checkoutOrder", () => {
  it("starts a payment for the open cart and passes trimmed notes", async () => {
    mocked.findOpenCart.mockResolvedValue(cart());
    mockedPayments.startPayment.mockResolvedValue({ ok: true, attemptId: "attempt-1", pricesChanged: true });
    expect(await checkoutOrder({ notes: "  left grip  " })).toEqual({
      ok: true,
      attemptId: "attempt-1",
      pricesChanged: true,
    });
    expect(mockedPayments.startPayment).toHaveBeenCalledWith({ orderId, notes: "left grip" });
  });

  it("resumes a pending order without notes", async () => {
    mocked.findOpenCart.mockResolvedValue(cart({ status: "pending_payment" }));
    mockedPayments.startPayment.mockResolvedValue({ ok: true, attemptId: "attempt-2", pricesChanged: false });
    expect((await checkoutOrder({})).ok).toBe(true);
    expect(mockedPayments.startPayment).toHaveBeenCalledWith({ orderId });
  });

  it("blocks dependents and minors, whose guardian pays", async () => {
    mocked.findOpenCart.mockResolvedValue(cart());
    mocked.actorCanPay.mockResolvedValue(false);
    expect(await checkoutOrder({})).toMatchObject({ ok: false, error: SHOP_MESSAGES.guardianPays });
    expect(mockedPayments.startPayment).not.toHaveBeenCalled();
  });

  it("rejects an empty or missing cart", async () => {
    mocked.findOpenCart.mockResolvedValue(null);
    expect(await checkoutOrder({})).toMatchObject({ error: SHOP_MESSAGES.noCart });
    mocked.findOpenCart.mockResolvedValue(cart({ lines: [], totalCents: 0 }));
    expect(await checkoutOrder({})).toMatchObject({ error: SHOP_MESSAGES.emptyCart });
    expect(mockedPayments.startPayment).not.toHaveBeenCalled();
  });

  it("passes payment failures through", async () => {
    mocked.findOpenCart.mockResolvedValue(cart());
    mockedPayments.startPayment.mockResolvedValue({ ok: false, error: "Payments are down.", code: "checkout_unavailable" });
    expect(await checkoutOrder({})).toEqual({ ok: false, error: "Payments are down.", code: "checkout_unavailable" });
  });

  it("rejects overlong notes and signed-out customers", async () => {
    expect((await checkoutOrder({ notes: "x".repeat(501) })).ok).toBe(false);
    mocked.getCurrentUserId.mockResolvedValue(null);
    expect(await checkoutOrder({})).toMatchObject({ error: SHOP_MESSAGES.signIn });
  });
});

describe("reopenOrder", () => {
  it("reopens a pending order", async () => {
    mocked.findOpenCartHeader.mockResolvedValue({ id: orderId, status: "pending_payment" });
    mocked.reopenOrderCart.mockResolvedValue(true);
    expect(await reopenOrder()).toEqual({ ok: true, reopened: true });
    expect(mocked.reopenOrderCart).toHaveBeenCalledWith(orderId);
  });

  it("does nothing for a draft", async () => {
    expect(await reopenOrder()).toEqual({ ok: true, reopened: false });
    expect(mocked.reopenOrderCart).not.toHaveBeenCalled();
  });

  it("reports a database refusal", async () => {
    mocked.findOpenCartHeader.mockResolvedValue({ id: orderId, status: "pending_payment" });
    mocked.reopenOrderCart.mockResolvedValue(null);
    expect(await reopenOrder()).toMatchObject({ ok: false, error: SHOP_MESSAGES.reopenFailed });
  });
});

describe("getBulkProgress", () => {
  it("computes the percentage from paid cents", async () => {
    mocked.findCollectingBulkProgress.mockResolvedValue({
      reference: "BO-0001",
      thresholdCents: 1500000,
      totalCents: 375000,
    });
    expect(await getBulkProgress()).toMatchObject({ percent: 25, reached: false });
  });

  it("caps at 100 and flags a reached threshold", async () => {
    mocked.findCollectingBulkProgress.mockResolvedValue({
      reference: "BO-0001",
      thresholdCents: 100,
      totalCents: 250,
    });
    expect(await getBulkProgress()).toMatchObject({ percent: 100, reached: true });
  });

  it("returns null with no collecting bulk order", async () => {
    mocked.findCollectingBulkProgress.mockResolvedValue(null);
    expect(await getBulkProgress()).toBeNull();
  });
});
