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
const claimShopOrderConfirmation = vi.fn();
const releaseShopOrderConfirmation = vi.fn();
const claimPaymentReceipt = vi.fn();
const releasePaymentReceipt = vi.fn();
vi.mock("@/lib/repositories/payment-repository", () => ({
  preparePayment: (...args: unknown[]) => preparePayment(...args),
  recordPaymentEvent: (...args: unknown[]) => recordPaymentEvent(...args),
  claimShopOrderConfirmation: (...args: unknown[]) => claimShopOrderConfirmation(...args),
  releaseShopOrderConfirmation: (...args: unknown[]) => releaseShopOrderConfirmation(...args),
  claimPaymentReceipt: (...args: unknown[]) => claimPaymentReceipt(...args),
  releasePaymentReceipt: (...args: unknown[]) => releasePaymentReceipt(...args),
  findCheckout: vi.fn(),
  findPaymentStatus: vi.fn(),
}));

const getEmailTransport = vi.fn();
const sendEmail = vi.fn();
vi.mock("@/lib/providers/email-transport", () => ({
  getEmailTransport: () => getEmailTransport(),
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

import { onlinePaymentsAvailable, PAID_BY_CREDIT_MESSAGE, receivePaymentNotification, startPayment } from "./payment-service";

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
    expect(result).toEqual({ ok: false, error: "Choose one valid lesson, invoice, order or membership to pay." });
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

  it("tells the payer when account credit paid the whole invoice", async () => {
    preparePayment.mockResolvedValue({ ok: false, code: "paid_by_credit" });
    const result = await startPayment({ invoiceId: orderId });
    expect(result).toEqual({ ok: false, code: "paid_by_credit", error: PAID_BY_CREDIT_MESSAGE });
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

  it("starts a membership payment and explains when only the guardian can pay", async () => {
    preparePayment.mockResolvedValueOnce({
      ok: true,
      attempt: { attempt_id: "attempt-2", provider_reference: "cfadef", amount_cents: "90000", prices_changed: false },
    });
    expect(await startPayment({ membershipApplicationId: orderId })).toEqual({ ok: true, attemptId: "attempt-2", pricesChanged: false });
    expect(preparePayment).toHaveBeenCalledWith({ membershipApplicationId: orderId }, "payfast_sandbox");
    preparePayment.mockResolvedValueOnce({ ok: false, code: "forbidden" });
    expect(await startPayment({ membershipApplicationId: orderId })).toMatchObject({
      ok: false,
      error: "Only the account payer can pay for this membership. Ask your guardian to pay.",
    });
    preparePayment.mockResolvedValueOnce({ ok: false, code: "checkout_unavailable" });
    expect(await startPayment({ membershipApplicationId: orderId })).toMatchObject({
      ok: false,
      error: "This membership is no longer waiting for payment. Refresh to see its status.",
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

describe("shop order confirmation email", () => {
  const settled = {
    provider: "payfast_sandbox", eventId: "evt-2", paymentId: "pay-2", reference: "cfaorder",
    status: "succeeded", amountCents: "90000", currency: "ZAR",
  };
  const claim = {
    order_id: orderId, recipient_email: "buyer@example.test", recipient_name: "Sam Buyer", total_cents: 90000,
    items: [{ name: "Training jacket", quantity: 2, size: "M", handedness: null, lineCents: 90000 }],
  };
  const notify = () => receivePaymentNotification("payfast_sandbox", {
    body: "", headers: new Headers(), url: "https://stage.example/api/payments/payfast/webhook",
  });

  beforeEach(() => {
    gateway.verifyWebhook.mockResolvedValue(settled);
    recordPaymentEvent.mockResolvedValue(true);
    getEmailTransport.mockReturnValue({ kind: "smtp", config: { host: "smtp.example", port: 465, user: "u", password: "p", from: "no-reply@cfa.example" } });
    claimShopOrderConfirmation.mockResolvedValue(claim);
    sendEmail.mockResolvedValue({ ok: true });
  });

  it("emails the buyer once the payment is recorded", async () => {
    expect(await notify()).toBe(200);
    expect(claimShopOrderConfirmation).toHaveBeenCalledWith("payfast_sandbox", "cfaorder");
    const email = sendEmail.mock.calls[0][1];
    expect(email.to).toBe("buyer@example.test");
    expect(email.text).toContain("2 x Training jacket (size M)");
    expect(email.text).toContain("https://stage.example/protected/shop/orders");
  });

  it("sends nothing when the claim is empty, such as a repeated notification", async () => {
    claimShopOrderConfirmation.mockResolvedValue(null);
    expect(await notify()).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("releases the claim when the mail server refuses, and still acknowledges the payment", async () => {
    sendEmail.mockResolvedValue({ ok: false, error: "The mail server refused the email (550)." });
    expect(await notify()).toBe(200);
    expect(releaseShopOrderConfirmation).toHaveBeenCalledWith(orderId);
  });

  it("does not try to email for a failed payment or without email settings", async () => {
    gateway.verifyWebhook.mockResolvedValue({ ...settled, status: "failed" });
    expect(await notify()).toBe(200);
    gateway.verifyWebhook.mockResolvedValue(settled);
    getEmailTransport.mockReturnValue(null);
    expect(await notify()).toBe(200);
    expect(claimShopOrderConfirmation).not.toHaveBeenCalled();
  });

  it("never sends before the payment itself is stored", async () => {
    recordPaymentEvent.mockResolvedValue(false);
    expect(await notify()).toBe(503);
    expect(claimShopOrderConfirmation).not.toHaveBeenCalled();
  });
});

describe("payment receipt email", () => {
  const settled = { provider: "payfast_sandbox", eventId: "evt-2", paymentId: "pf-2", reference: "cfamember", status: "succeeded", amountCents: "90000", currency: "ZAR" };
  const receipt = {
    attempt_id: "44444444-4444-4444-8444-444444444444", kind: "membership", recipient_email: "payer@example.test", recipient_name: "Dana Demo",
    amount_cents: 90000, receipt_number: "REC-001009", description: "Month-to-month membership", credited: false,
  };
  const notify = () => receivePaymentNotification("payfast_sandbox", {
    body: "", headers: new Headers(), url: "https://stage.example/api/payments/payfast/webhook",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    gateway.verifyWebhook.mockResolvedValue(settled);
    recordPaymentEvent.mockResolvedValue(true);
    getEmailTransport.mockReturnValue({ kind: "smtp", config: { host: "smtp.example", port: 465, user: "u", password: "p", from: "no-reply@cfa.example" } });
    claimShopOrderConfirmation.mockResolvedValue(null);
    claimPaymentReceipt.mockResolvedValue(receipt);
    sendEmail.mockResolvedValue({ ok: true });
  });

  it("emails the payer a receipt once the payment is recorded", async () => {
    expect(await notify()).toBe(200);
    expect(claimPaymentReceipt).toHaveBeenCalledWith("payfast_sandbox", "cfamember");
    const email = sendEmail.mock.calls[0][1];
    expect(email.to).toBe("payer@example.test");
    expect(email.subject).toBe("Payment received - CFA receipt REC-001009");
    expect(email.text).toContain("R900.00 for Month-to-month membership");
    expect(email.text).toContain("Your membership is now active.");
    expect(email.text).toContain("https://stage.example/protected/billing");
  });

  it("releases the claim when sending fails and still acknowledges the payment", async () => {
    sendEmail.mockResolvedValue({ ok: false, error: "The mail server refused the email (550)." });
    expect(await notify()).toBe(200);
    expect(releasePaymentReceipt).toHaveBeenCalledWith(receipt.attempt_id);
  });

  it("sends nothing for a repeated notification or a failed payment", async () => {
    claimPaymentReceipt.mockResolvedValue(null);
    expect(await notify()).toBe(200);
    gateway.verifyWebhook.mockResolvedValue({ ...settled, status: "failed" });
    expect(await notify()).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
