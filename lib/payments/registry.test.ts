import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getPaymentGateway, getPaymentOrigin } from "./registry";

afterEach(() => vi.unstubAllEnvs());
describe("payment configuration", () => {
  it("requires explicit complete sandbox configuration", () => {
    vi.stubEnv("PAYMENT_PROVIDER", "payfast_sandbox");
    vi.stubEnv("PAYFAST_SANDBOX_ENABLED", "false");
    expect(getPaymentGateway()).toBeNull();
    vi.stubEnv("PAYFAST_SANDBOX_ENABLED", "true");
    vi.stubEnv("PAYFAST_MERCHANT_ID", "10000100");
    vi.stubEnv("PAYFAST_MERCHANT_KEY", "test-key");
    vi.stubEnv("PAYFAST_PASSPHRASE", "");
    expect(getPaymentGateway()).toBeNull();
    vi.stubEnv("PAYFAST_PASSPHRASE", "test-phrase");
    expect(getPaymentGateway()?.name).toBe("payfast_sandbox");
    expect(getPaymentGateway("peach_sandbox")).toBeNull();
    expect(getPaymentGateway("payfast_live")).toBeNull();
  });
  it.each(["", "http://stage.example", "https://stage.example/path", "https://user:pass@stage.example", "https://stage.example?token=x"])("rejects invalid public origin %s", (origin) => {
    vi.stubEnv("PAYMENT_PUBLIC_ORIGIN", origin);
    expect(getPaymentOrigin()).toBeNull();
  });
  it("normalizes an explicit HTTPS origin", () => {
    vi.stubEnv("PAYMENT_PUBLIC_ORIGIN", "https://stage.example/");
    expect(getPaymentOrigin()).toBe("https://stage.example");
  });
});
