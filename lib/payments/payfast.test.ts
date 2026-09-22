import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
vi.mock("server-only", () => ({}));
import { createPayFastGateway } from "./payfast";

const config = { merchantId: "10000100", merchantKey: "46f0cd694581a", passphrase: "test phrase" };
const checkout = {
  reference: "attempt-1", amountCents: "30001", currency: "ZAR" as const,
  description: "Lesson & club!", returnUrl: "https://stage.example/return",
  cancelUrl: "https://stage.example/cancel", notifyUrl: "https://stage.example/notify",
};
const notification = "m_payment_id=attempt-1&pf_payment_id=123456&payment_status=COMPLETE&item_name=Lesson&custom_str1=&amount_gross=300.01&merchant_id=10000100";
const validBody = `${notification}&signature=375ca9f8b36861490e578d047f35c976`;
function request(body = validBody) {
  return { body, headers: new Headers({ "content-type": "application/x-www-form-urlencoded; charset=UTF-8" }), url: "https://stage.example/notify" };
}

describe("PayFast sandbox gateway", () => {
  it("signs documented checkout field order with PHP encoding and exact cents", async () => {
    const result = await createPayFastGateway(config).createCheckout(checkout);
    expect(result.kind).toBe("form");
    if (result.kind !== "form") throw new Error("Expected form");
    expect(result.action).toBe("https://sandbox.payfast.co.za/eng/process");
    expect(result.fields.amount).toBe("300.01");
    expect(result.fields.signature).toBe("8819613a6d1abfffccf121b6649a861e");
    expect(JSON.stringify(result)).not.toContain(config.passphrase);
  });
  it.each(["0", "-1", "3.01", "90000000000000000000"])("rejects invalid cents %s", async (amountCents) => {
    await expect(createPayFastGateway(config).createCheckout({ ...checkout, amountCents })).rejects.toThrow();
  });
  it("rejects insecure callback URLs", async () => {
    await expect(createPayFastGateway(config).createCheckout({ ...checkout, notifyUrl: "http://stage.example/notify" })).rejects.toThrow();
  });
  it("verifies signed ITN including empty fields and confirms with PayFast", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("VALID"));
    const event = await createPayFastGateway(config, fetcher).verifyWebhook(request());
    expect(event).toEqual({ provider: "payfast_sandbox", eventId: "123456:COMPLETE", paymentId: "123456", reference: "attempt-1", status: "succeeded", amountCents: "30001", currency: "ZAR" });
    expect(fetcher).toHaveBeenCalledWith("https://sandbox.payfast.co.za/eng/query/validate", expect.objectContaining({ body: notification, redirect: "error", method: "POST" }));
  });
  it.each([
    validBody.replace("300.01", "300.02"),
    `${validBody}&amount_gross=300.01`,
    `${validBody}&bad=%ZZ`,
    validBody.replace("signature=", "signature=xx"),
    validBody.replace("10000100", "10000101"),
  ])("rejects tampered, duplicate or malformed messages without network validation", async (body) => {
    const fetcher = vi.fn<typeof fetch>();
    expect(await createPayFastGateway(config, fetcher).verifyWebhook(request(body))).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([new Response("INVALID"), new Response("VALID", { status: 500 })])("rejects failed PayFast server validation", async (response) => {
    expect(await createPayFastGateway(config, vi.fn<typeof fetch>().mockResolvedValue(response)).verifyWebhook(request())).toBeNull();
  });
  it("fails closed on server validation network failure", async () => {
    expect(await createPayFastGateway(config, vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"))).verifyWebhook(request())).toBeNull();
  });
  it.each([
    ["amount_gross=300.01", "amount_gross=3e2"],
    ["amount_gross=300.01", "amount_gross=-300.01"],
    ["amount_gross=300.01", "amount_gross=0.00"],
    ["payment_status=COMPLETE", "payment_status=UNKNOWN"],
    ["payment_status=COMPLETE", "payment_status=__proto__"],
  ])("rejects signed but unsupported values %s", async (original, replacement) => {
    const payload = notification.replace(original, replacement);
    const signed = `${payload}&signature=${createHash("md5").update(`${payload}&passphrase=test+phrase`).digest("hex")}`;
    const fetcher = vi.fn<typeof fetch>();
    expect(await createPayFastGateway(config, fetcher).verifyWebhook(request(signed))).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([["PENDING", "pending"], ["FAILED", "failed"], ["CANCELLED", "cancelled"]])("normalizes verified %s status", async (providerStatus, status) => {
    const payload = notification.replace("payment_status=COMPLETE", `payment_status=${providerStatus}`);
    const signed = `${payload}&signature=${createHash("md5").update(`${payload}&passphrase=test+phrase`).digest("hex")}`;
    const event = await createPayFastGateway(config, vi.fn<typeof fetch>().mockResolvedValue(new Response("VALID"))).verifyWebhook(request(signed));
    expect(event?.status).toBe(status);
    expect(event?.eventId).toBe(`123456:${providerStatus}`);
  });
  it("rejects non-form content types", async () => {
    expect(await createPayFastGateway(config).verifyWebhook({ ...request(), headers: new Headers({ "content-type": "application/json" }) })).toBeNull();
  });
});
