import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sendWithResend = vi.fn();
vi.mock("@/lib/providers/resend-email", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/providers/resend-email")>(),
  sendWithResend: (...args: unknown[]) => sendWithResend(...args),
}));

import { getEmailTransport, getSmtpConfig, sendEmail, type EmailTransport } from "@/lib/providers/email-transport";

const smtpEnv = {
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "465",
  SMTP_USER: "club@example.test",
  SMTP_PASSWORD: "abcd efgh ijkl mnop",
  EMAIL_FROM: "Cape Fencing Academy <club@example.test>",
};
const email = { to: "member@example.test", subject: "Hello", text: "Hi", html: "<p>Hi</p>" };

describe("getEmailTransport", () => {
  it("prefers SMTP when it is fully configured", () => {
    const transport = getEmailTransport({ ...smtpEnv, RESEND_API_KEY: "re_x" });
    expect(transport).toEqual({ kind: "smtp", config: expect.objectContaining({ host: "smtp.gmail.com", port: 465, password: "abcdefghijklmnop" }) });
  });

  it("falls back to Resend, then to nothing", () => {
    expect(getEmailTransport({ RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.test" })).toEqual({ kind: "resend", config: { apiKey: "re_x", from: "a@b.test" } });
    expect(getEmailTransport({ SMTP_HOST: "smtp.gmail.com", EMAIL_FROM: "a@b.test" })).toBeNull();
  });

  it("rejects an unusable port", () => {
    expect(getSmtpConfig({ ...smtpEnv, SMTP_PORT: "gmail" })).toBeNull();
  });
});

describe("sendEmail", () => {
  const smtp: EmailTransport = { kind: "smtp", config: getSmtpConfig(smtpEnv)! };

  beforeEach(() => sendWithResend.mockReset());

  it("sends over SMTP from the configured sender", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    expect(await sendEmail(smtp, email, () => ({ sendMail }))).toEqual({ ok: true });
    expect(sendMail).toHaveBeenCalledWith({ from: smtpEnv.EMAIL_FROM, ...email });
  });

  it("passes attachments to the SMTP sender", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const content = new Uint8Array([37, 80, 68, 70]);
    await sendEmail(smtp, { ...email, attachments: [{ filename: "CFA-000001.pdf", content, contentType: "application/pdf" }] }, () => ({ sendMail }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      attachments: [{ filename: "CFA-000001.pdf", content: Buffer.from(content), contentType: "application/pdf" }],
    }));
  });

  it("reports an SMTP refusal without the server's message", async () => {
    const sendMail = vi.fn().mockRejectedValue(Object.assign(new Error("550 member@example.test unknown"), { responseCode: 550 }));
    const result = await sendEmail(smtp, email, () => ({ sendMail }));
    expect(result).toEqual({ ok: false, error: "The mail server refused the email (550)." });
  });

  it("uses Resend when that is the transport", async () => {
    sendWithResend.mockResolvedValue({ ok: true });
    const resend: EmailTransport = { kind: "resend", config: { apiKey: "re_x", from: "a@b.test" } };
    expect(await sendEmail(resend, email)).toEqual({ ok: true });
    expect(sendWithResend).toHaveBeenCalledWith(resend.config, email);
  });
});
