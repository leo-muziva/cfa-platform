import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getResendConfig, membershipPaymentEmail, sendWithResend, shopOrderConfirmationEmail } from "./resend-email";

const input = {
  to: "payer@example.test",
  recipientName: "Sam Payer",
  applicantName: "Alex <Fencer>",
  recipientIsApplicant: false,
  membershipName: "Month-to-month",
  amountCents: "90000",
  payUrl: "https://cfa.example/protected/billing",
};

describe("getResendConfig", () => {
  it("needs both the API key and the From address", () => {
    expect(getResendConfig({})).toBeNull();
    expect(getResendConfig({ RESEND_API_KEY: "re_x" })).toBeNull();
    expect(getResendConfig({ EMAIL_FROM: "CFA <no-reply@cfa.example>" })).toBeNull();
    expect(getResendConfig({ RESEND_API_KEY: " re_x ", EMAIL_FROM: "no-reply@cfa.example" }))
      .toEqual({ apiKey: "re_x", from: "no-reply@cfa.example" });
  });
});

describe("membershipPaymentEmail", () => {
  it("tells a guardian whose membership was approved, the amount and the portal link", () => {
    const email = membershipPaymentEmail(input);
    expect(email.to).toBe("payer@example.test");
    expect(email.text).toContain("Alex <Fencer>'s Month-to-month membership application");
    expect(email.text).toContain("R900.00");
    expect(email.text).toContain("https://cfa.example/protected/billing");
    expect(email.html).toContain("Alex &lt;Fencer&gt;");
    expect(email.html).not.toContain("<Fencer>");
  });

  it("addresses the applicant directly when they pay for themselves", () => {
    const email = membershipPaymentEmail({ ...input, recipientIsApplicant: true });
    expect(email.text).toContain("your Month-to-month membership application");
    expect(email.text).toContain("Your membership becomes active");
  });
});

describe("sendWithResend", () => {
  const config = { apiKey: "re_secret", from: "CFA <no-reply@cfa.example>" };
  const email = membershipPaymentEmail(input);

  it("posts the message with the API key as a bearer token", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    expect(await sendWithResend(config, email, fetchImpl as unknown as typeof fetch)).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_secret");
    expect(JSON.parse(String(init.body))).toMatchObject({ from: config.from, to: ["payer@example.test"], subject: email.subject });
  });

  it("reports a rejected send by status only", async () => {
    const fetchImpl = vi.fn(async () => new Response("{\"message\":\"payer@example.test is invalid\"}", { status: 422 }));
    expect(await sendWithResend(config, email, fetchImpl as unknown as typeof fetch))
      .toEqual({ ok: false, error: "Resend responded with 422" });
  });

  it("reports a network failure without throwing", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("offline"); });
    expect(await sendWithResend(config, email, fetchImpl as unknown as typeof fetch))
      .toEqual({ ok: false, error: "Could not reach Resend." });
  });
});

describe("shopOrderConfirmationEmail", () => {
  it("lists each item with its options and the total, escaping HTML", () => {
    const email = shopOrderConfirmationEmail({
      to: "buyer@example.test", recipientName: "Sam <Buyer>", totalCents: "125050", ordersUrl: null,
      items: [
        { name: "Foil", quantity: 1, size: null, handedness: "left", lineCents: "80000" },
        { name: "Glove", quantity: 2, size: "M", handedness: null, lineCents: "45050" },
      ],
    });
    expect(email.subject).toBe("Your CFA shop order is confirmed");
    expect(email.text).toContain("1 x Foil (left-handed)");
    expect(email.text).toContain("2 x Glove (size M)");
    expect(email.text).not.toContain("Your orders:");
    expect(email.html).toContain("Sam &lt;Buyer&gt;");
    expect(email.html).not.toContain("<Buyer>");
  });
});
