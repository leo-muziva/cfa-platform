import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createPayFastRefundClient, type ProviderRefundRequest } from "./payfast-refunds";

const config = { merchantId: "10000100", passphrase: "test phrase" };
const now = () => new Date("2026-01-02T03:04:05.678Z");
const request: ProviderRefundRequest = { providerPaymentId: "2120314", amountCents: "30001", reason: "Product returned" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function clientWith(fetcher: ReturnType<typeof vi.fn>, testing = true) {
  return createPayFastRefundClient(config, { testing, fetcher: fetcher as unknown as typeof fetch, now });
}

describe("PayFast refund client", () => {
  it("posts a signed JSON refund to the sandbox endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, { code: 200, status: "success", data: { response: true, refund_id: "abc-123" } }));
    const result = await clientWith(fetcher).refund(request);

    expect(result).toEqual({ ok: true, reference: "abc-123" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.payfast.co.za/refunds/2120314?testing=true");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body as string)).toEqual({ amount: 30001, reason: "Product returned", notify_buyer: 1 });

    const headers = init.headers as Record<string, string>;
    expect(headers["merchant-id"]).toBe("10000100");
    expect(headers.version).toBe("v1");
    expect(headers.timestamp).toBe("2026-01-02T03:04:05+00:00");
    expect(headers["Content-Type"]).toBe("application/json");
    // Independently recomputed: keys sorted alphabetically, PHP urlencode values, passphrase included.
    const expected = createHash("md5").update(
      "amount=30001&merchant-id=10000100&notify_buyer=1&passphrase=test+phrase&reason=Product+returned"
        + "&timestamp=2026-01-02T03%3A04%3A05%2B00%3A00&version=v1",
    ).digest("hex");
    expect(headers.signature).toBe(expected);
  });

  it("is deterministic for the same input and clock", async () => {
    const fetcher = vi.fn().mockImplementation(async () => jsonResponse(200, { status: "success", data: { response: true } }));
    const client = clientWith(fetcher);
    await client.refund(request);
    await client.refund(request);
    const signatures = fetcher.mock.calls.map(([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers.signature);
    expect(signatures[0]).toMatch(/^[a-f0-9]{32}$/);
    expect(signatures[1]).toBe(signatures[0]);
  });

  it("omits the testing flag and reports the live name when not testing", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, { code: 200, status: "success", data: { response: true } }));
    const client = clientWith(fetcher, false);
    expect(client.name).toBe("payfast");
    expect(await client.refund(request)).toEqual({ ok: true, reference: null });
    expect(fetcher.mock.calls[0][0]).toBe("https://api.payfast.co.za/refunds/2120314");
  });

  it("maps 4xx to a non-retryable short error without echoing the body", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(400, { code: 400, status: "failed", data: { response: "secret detail" } }));
    const result = await clientWith(fetcher).refund(request);
    expect(result).toEqual({ ok: false, error: "PayFast rejected the refund (HTTP 400).", retryable: false });
    expect(JSON.stringify(result)).not.toContain("secret detail");
  });

  it("maps 5xx and 429 to retryable errors", async () => {
    expect(await clientWith(vi.fn().mockResolvedValue(jsonResponse(503, {}))).refund(request))
      .toMatchObject({ ok: false, retryable: true });
    expect(await clientWith(vi.fn().mockResolvedValue(jsonResponse(429, {}))).refund(request))
      .toMatchObject({ ok: false, retryable: true });
  });

  it("maps timeouts and network failures to retryable errors", async () => {
    const timeout = vi.fn().mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
    expect(await clientWith(timeout).refund(request)).toEqual({ ok: false, error: "PayFast refund request did not complete.", retryable: true });
    const network = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    expect(await clientWith(network).refund(request)).toMatchObject({ ok: false, retryable: true });
  });

  it("does not treat an unconfirmed 2xx as success", async () => {
    const declined = vi.fn().mockResolvedValue(jsonResponse(200, { code: 200, status: "success", data: { response: false } }));
    expect(await clientWith(declined).refund(request)).toMatchObject({ ok: false, retryable: false });
    const unreadable = vi.fn().mockResolvedValue(new Response("<html>", { status: 200 }));
    expect(await clientWith(unreadable).refund(request)).toMatchObject({ ok: false, retryable: false });
  });

  it.each([
    { ...request, providerPaymentId: "" },
    { ...request, providerPaymentId: "12/../34" },
    { ...request, providerPaymentId: "1".repeat(65) },
    { ...request, amountCents: "0" },
    { ...request, amountCents: "-100" },
    { ...request, amountCents: "10.50" },
    { ...request, amountCents: "99999999999999999" },
    { ...request, reason: "   " },
  ])("rejects invalid input without calling fetch: %o", async (input) => {
    const fetcher = vi.fn();
    const result = await clientWith(fetcher).refund(input);
    expect(result).toMatchObject({ ok: false, retryable: false });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires merchant id and passphrase", () => {
    expect(() => createPayFastRefundClient({ merchantId: " ", passphrase: "x" })).toThrow();
    expect(() => createPayFastRefundClient({ merchantId: "1", passphrase: "" })).toThrow();
  });
});
