import "server-only";
import nodemailer from "nodemailer";
import { getResendConfig, sendWithResend, type OutgoingEmail, type ResendConfig, type SendEmailResult } from "@/lib/providers/resend-email";

// Chooses how CFA email leaves the app. SMTP (for example Gmail with an app
// password) can deliver to any address without owning a domain; Resend's API
// needs a verified domain for that, so SMTP wins when both are configured.

type Env = Record<string, string | undefined>;

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

export type EmailTransport =
  | { kind: "smtp"; config: SmtpConfig }
  | { kind: "resend"; config: ResendConfig };

interface MailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type CreateSmtpSender = (config: SmtpConfig) => { sendMail(message: MailMessage): Promise<unknown> };

export function getSmtpConfig(env: Env = process.env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  const port = Number(env.SMTP_PORT?.trim());
  const user = env.SMTP_USER?.trim();
  // Gmail shows app passwords in groups of four; the spaces are not part of it.
  const password = env.SMTP_PASSWORD?.replace(/\s+/g, "");
  const from = env.EMAIL_FROM?.trim();
  if (!host || !user || !password || !from || !Number.isInteger(port) || port <= 0) return null;
  return { host, port, user, password, from };
}

export function getEmailTransport(env: Env = process.env): EmailTransport | null {
  const smtp = getSmtpConfig(env);
  if (smtp) return { kind: "smtp", config: smtp };
  const resend = getResendConfig(env);
  return resend ? { kind: "resend", config: resend } : null;
}

const createNodemailerSender: CreateSmtpSender = (config) => nodemailer.createTransport({
  host: config.host,
  port: config.port,
  // Port 465 speaks TLS from the start; 587 upgrades with STARTTLS.
  secure: config.port === 465,
  auth: { user: config.user, pass: config.password },
  connectionTimeout: 15_000,
  greetingTimeout: 15_000,
  socketTimeout: 15_000,
});

export async function sendEmail(
  transport: EmailTransport,
  email: OutgoingEmail,
  createSmtpSender: CreateSmtpSender = createNodemailerSender,
): Promise<SendEmailResult> {
  if (transport.kind === "resend") return sendWithResend(transport.config, email);
  try {
    await createSmtpSender(transport.config).sendMail({
      from: transport.config.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    return { ok: true };
  } catch (error) {
    // SMTP errors can echo addresses, so only the response code is kept.
    const code = typeof error === "object" && error && "responseCode" in error ? ` (${String(error.responseCode)})` : "";
    return { ok: false, error: `The mail server refused the email${code}.` };
  }
}
