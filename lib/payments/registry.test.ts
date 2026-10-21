import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getPaymentGateway, getPaymentOrigin, getRefundClient, paymentSetupIssues, providerRefundsEnabled } from "./registry";

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

describe("refund client configuration", () => {
  function configure() {
    vi.stubEnv("PAYMENT_PROVIDER", "payfast_sandbox");
    vi.stubEnv("PAYFAST_MERCHANT_ID", "10000100");
    vi.stubEnv("PAYFAST_PASSPHRASE", "test-phrase");
  }
  it("returns null when the refunds flag is unset or not exactly true", () => {
    configure();
    vi.stubEnv("PAYFAST_REFUNDS_ENABLED", "");
    expect(providerRefundsEnabled()).toBe(false);
    expect(getRefundClient()).toBeNull();
    vi.stubEnv("PAYFAST_REFUNDS_ENABLED", "TRUE");
    expect(getRefundClient()).toBeNull();
  });
  it("requires configuration and the sandbox provider", () => {
    configure();
    vi.stubEnv("PAYFAST_REFUNDS_ENABLED", "true");
    expect(providerRefundsEnabled()).toBe(true);
    expect(getRefundClient()?.name).toBe("payfast_sandbox");
    expect(getRefundClient("payfast")).toBeNull();
    expect(getRefundClient("peach_sandbox")).toBeNull();
    vi.stubEnv("PAYFAST_PASSPHRASE", " ");
    expect(getRefundClient()).toBeNull();
    vi.stubEnv("PAYFAST_PASSPHRASE", "test-phrase");
    vi.stubEnv("PAYFAST_MERCHANT_ID", "");
    expect(getRefundClient()).toBeNull();
  });
});

describe("payment setup diagnostics", () => {
  const complete = {
    PAYMENT_PROVIDER: "payfast_sandbox",
    PAYFAST_SANDBOX_ENABLED: "true",
    PAYFAST_MERCHANT_ID: "10000100",
    PAYFAST_MERCHANT_KEY: "secret-key-value",
    PAYFAST_PASSPHRASE: "secret-phrase-value",
    SUPABASE_SECRET_KEY: "secret-service-value",
    PAYMENT_PUBLIC_ORIGIN: "https://stage.example",
    CRON_SECRET: "secret-cron-value",
  } as unknown as NodeJS.ProcessEnv;

  it("reports nothing when every setting is present", () => {
    expect(paymentSetupIssues(complete)).toEqual([]);
  });

  it("names each missing setting", () => {
    const issues = paymentSetupIssues({} as NodeJS.ProcessEnv);
    for (const name of ["PAYMENT_PROVIDER", "PAYFAST_SANDBOX_ENABLED", "PAYFAST_MERCHANT_ID", "PAYFAST_MERCHANT_KEY",
      "PAYFAST_PASSPHRASE", "SUPABASE_SECRET_KEY", "PAYMENT_PUBLIC_ORIGIN", "CRON_SECRET"]) {
      expect(issues.some((issue) => issue.startsWith(name))).toBe(true);
    }
  });

  it("rejects an origin with a path and never echoes configured values", () => {
    const issues = paymentSetupIssues({ ...complete, PAYMENT_PUBLIC_ORIGIN: "https://stage.example/app", PAYFAST_PASSPHRASE: " " });
    expect(issues).toHaveLength(2);
    expect(issues.join(" ")).not.toMatch(/secret-|10000100|stage\.example\/app/);
  });
});
