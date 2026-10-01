import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

const getPaymentGateway = vi.fn();
const getPaymentOrigin = vi.fn();
vi.mock("@/lib/payments/registry", () => ({
  getPaymentGateway: (...args: unknown[]) => getPaymentGateway(...args),
  getPaymentOrigin: () => getPaymentOrigin(),
}));

const preparePayment = vi.fn();
const recordPaymentEvent = vi.fn();
vi.mock("@/lib/repositories/payment-repository", () => ({
  preparePayment: (...args: unknown[]) => preparePayment(...args),
  recordPaymentEvent: (...args: unknown[]) => recordPaymentEvent(...args),
  findCheckout: vi.fn(),
  findPaymentStatus: vi.fn(),
}));

import { onlinePaymentsAvailable, receivePaymentNotification, startPayment } from "./payment-service";

const orderId = "33333333-3333-4333-8333-333333333333";
const gateway = { name: "payfast_sandbox", createCheckout: vi.fn(), verifyWebhook: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  getPaymentGateway.mockReturnValue(gateway);
  getPaymentOrigin.mockReturnValue("https://stage.example");
});

describe("startPayment", () => {
  it("rejects an invalid target before any lookup", async () => {
    const result = await startPayment({ orderId: "nope" });
    expect(result).toEqual({ ok: false, error: "Choose one valid lesson, invoice or order to pay." });
    expect(getUser).not.toHaveBeenCalled();
    expect(preparePayment).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await startPayment({ orderId });
    expect(result).toEqual({ ok: false, error: "Please sign in before starting a payment." });
    expect(preparePayment).not.toHaveBeenCalled();
  });

  it("refuses when the provider is not configured", async () => {
    getPaymentGateway.mockReturnValue(null);
    const result = await startPayment({ orderId });
    expect(result).toEqual({ ok: false, error: "Online payments are not configured for this environment." });
    expect(preparePayment).not.toHaveBeenCalled();
  });

  it("refuses when the public origin is missing", async () => {
    getPaymentOrigin.mockReturnValue(null);
    expect((await startPayment({ orderId })).ok).toBe(false);
    expect(onlinePaymentsAvailable()).toBe(false);
  });

  it("starts an order payment and passes the price-change flag through", async () => {
    preparePayment.mockResolvedValue({
      ok: true,
      attempt: { attempt_id: "attempt-1", provider_reference: "cfaabc", amount_cents: "35000", prices_changed: true },
    });
    const result = await startPayment({ orderId, notes: "  Size M  " });
    expect(result).toEqual({ ok: true, attemptId: "attempt-1", pricesChanged: true });
    expect(preparePayment).toHaveBeenCalledWith({ orderId, notes: "Size M" }, "payfast_sandbox");
    expect(onlinePaymentsAvailable()).toBe(true);
  });

  it("explains that dependents cannot pay for an order", async () => {
    preparePayment.mockResolvedValue({ ok: false, code: "forbidden" });
    const result = await startPayment({ orderId });
    expect(result).toEqual({
      ok: false,
      code: "forbidden",
      error: "Only the account payer can pay for this order. Ask your guardian to pay.",
    });
  });

  it("uses order-specific messages for empty and unavailable orders", async () => {
    preparePayment.mockResolvedValueOnce({ ok: false, code: "empty_order" });
    expect(await startPayment({ orderId })).toMatchObject({ ok: false, error: "Your cart is empty." });
    preparePayment.mockResolvedValueOnce({ ok: false, code: "product_unavailable" });
    expect(await startPayment({ orderId })).toMatchObject({
      ok: false,
      error: "An item in your cart is no longer available. Remove it and try again.",
    });
    preparePayment.mockResolvedValueOnce({ ok: false, code: "unknown" });
    expect(await startPayment({ orderId })).toMatchObject({
      ok: false,
      error: "This order can't be paid right now. Refresh and try again.",
    });
  });

  it("keeps the existing message for booking failures", async () => {
    preparePayment.mockResolvedValue({ ok: false, code: "forbidden" });
    const result = await startPayment({ bookingId: orderId });
    expect(result).toMatchObject({
      ok: false,
      error: "This payment is unavailable. Refresh to check the balance or lesson hold.",
    });
  });
});

describe("receivePaymentNotification", () => {
  it("returns 400 when the verified event names a different provider", async () => {
    gateway.verifyWebhook.mockResolvedValue({
      provider: "peach_sandbox",
      eventId: "evt-1",
      paymentId: "pay-1",
      reference: "cfaabc",
      status: "succeeded",
      amountCents: "35000",
      currency: "ZAR",
    });
    const status = await receivePaymentNotification("payfast_sandbox", {
      body: "",
      headers: new Headers(),
      url: "https://stage.example/api/payments/payfast/webhook",
    });
    expect(status).toBe(400);
    expect(recordPaymentEvent).not.toHaveBeenCalled();
  });
});
