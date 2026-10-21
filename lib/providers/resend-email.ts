import "server-only";
import { formatZarWithCents } from "@/lib/money";

// Sends CFA transactional email through Resend's REST API. The same Resend
// account that relays Supabase Auth email can issue the API key; the From
// address must be on a domain verified in Resend.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type Env = Record<string, string | undefined>;

export interface ResendConfig {
  apiKey: string;
  from: string;
}

export interface MembershipPaymentEmail {
  to: string;
  recipientName: string;
  applicantName: string;
  // False when a guardian pays for a dependent's membership.
  recipientIsApplicant: boolean;
  membershipName: string;
  amountCents: string;
  payUrl: string;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export function getResendConfig(env: Env = process.env): ResendConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  return apiKey && from ? { apiKey, from } : null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

export function plainEmail(to: string, subject: string, paragraphs: string[]): OutgoingEmail {
  return {
    to,
    subject,
    text: paragraphs.join("\n\n"),
    html: paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n"),
  };
}

export function membershipPaymentEmail(input: MembershipPaymentEmail): OutgoingEmail {
  const amount = formatZarWithCents(input.amountCents);
  const whose = input.recipientIsApplicant
    ? `your ${input.membershipName} membership application`
    : `${input.applicantName}'s ${input.membershipName} membership application`;
  const activates = input.recipientIsApplicant ? "Your membership" : "The membership";
  const lines = [
    `Hi ${input.recipientName},`,
    `Good news: Cape Fencing Academy has approved ${whose}.`,
    `The amount due is ${amount}. ${activates} becomes active as soon as the payment is confirmed.`,
    `Sign in and pay here: ${input.payUrl}`,
    "If you would rather pay by EFT or cash, reply to this email and CFA staff will record your payment.",
    "Cape Fencing Academy",
  ];
  const html = [
    `<p>Hi ${escapeHtml(input.recipientName)},</p>`,
    `<p>Good news: Cape Fencing Academy has approved ${escapeHtml(whose)}.</p>`,
    `<p>The amount due is <strong>${escapeHtml(amount)}</strong>. ${activates} becomes active as soon as the payment is confirmed.</p>`,
    `<p><a href="${escapeHtml(input.payUrl)}">Sign in and pay for the membership</a></p>`,
    "<p>If you would rather pay by EFT or cash, reply to this email and CFA staff will record your payment.</p>",
    "<p>Cape Fencing Academy</p>",
  ].join("\n");
  return { to: input.to, subject: "Your CFA membership is approved - payment due", text: lines.join("\n\n"), html };
}

export interface ShopOrderEmailItem {
  name: string;
  quantity: number;
  size: string | null;
  handedness: "right" | "left" | null;
  lineCents: string;
}

export interface ShopOrderConfirmationEmail {
  to: string;
  recipientName: string;
  items: ShopOrderEmailItem[];
  totalCents: string;
  ordersUrl: string | null;
}

function itemLabel(item: ShopOrderEmailItem): string {
  const options = [item.size && `size ${item.size}`, item.handedness && `${item.handedness}-handed`].filter(Boolean).join(", ");
  return `${item.quantity} x ${item.name}${options ? ` (${options})` : ""} - ${formatZarWithCents(item.lineCents)}`;
}

export function shopOrderConfirmationEmail(input: ShopOrderConfirmationEmail): OutgoingEmail {
  const total = formatZarWithCents(input.totalCents);
  const intro = `Thank you for your order. We have received your payment of ${total}.`;
  const pooling = "CFA places kit orders with the supplier in bulk. Your items will be ordered with the next bulk order, and you can follow its progress on your orders page.";
  const lines = [
    `Hi ${input.recipientName},`,
    intro,
    ...input.items.map(itemLabel),
    `Total paid: ${total}`,
    pooling,
    ...(input.ordersUrl ? [`Your orders: ${input.ordersUrl}`] : []),
    "Cape Fencing Academy",
  ];
  const html = [
    `<p>Hi ${escapeHtml(input.recipientName)},</p>`,
    `<p>${escapeHtml(intro)}</p>`,
    `<ul>${input.items.map((item) => `<li>${escapeHtml(itemLabel(item))}</li>`).join("")}</ul>`,
    `<p>Total paid: <strong>${escapeHtml(total)}</strong></p>`,
    `<p>${escapeHtml(pooling)}</p>`,
    ...(input.ordersUrl ? [`<p><a href="${escapeHtml(input.ordersUrl)}">View your orders</a></p>`] : []),
    "<p>Cape Fencing Academy</p>",
  ].join("\n");
  return { to: input.to, subject: "Your CFA shop order is confirmed", text: lines.join("\n\n"), html };
}

export type ReceiptKind = "membership" | "booking" | "invoice";

export interface PaymentReceiptEmail {
  to: string;
  recipientName: string;
  kind: ReceiptKind;
  description: string;
  amountCents: string;
  receiptNumber: string | null;
  // True when some or all of the payment was kept as account credit.
  credited: boolean;
  billingUrl: string | null;
}

const RECEIPT_OUTCOME: Record<ReceiptKind, string> = {
  membership: "Your membership is now active. Welcome to Cape Fencing Academy.",
  booking: "Your lesson is booked. See you on the piste.",
  invoice: "Your invoice has been marked as paid.",
};

export function paymentReceiptEmail(input: PaymentReceiptEmail): OutgoingEmail {
  const amount = formatZarWithCents(input.amountCents);
  const paid = `We have received your payment of ${amount} for ${input.description}.`;
  const outcome = input.credited
    ? "Some or all of this payment was kept as account credit, because what it paid for changed before the payment arrived. Your billing page has the details."
    : RECEIPT_OUTCOME[input.kind];
  const receipt = input.receiptNumber ? `Receipt number: ${input.receiptNumber}` : null;
  const lines = [
    `Hi ${input.recipientName},`,
    paid,
    outcome,
    ...(receipt ? [receipt] : []),
    ...(input.billingUrl ? [`Your billing and receipts: ${input.billingUrl}`] : []),
    "Cape Fencing Academy",
  ];
  const html = [
    `<p>Hi ${escapeHtml(input.recipientName)},</p>`,
    `<p>${escapeHtml(paid)}</p>`,
    `<p>${escapeHtml(outcome)}</p>`,
    ...(receipt ? [`<p><strong>${escapeHtml(receipt)}</strong></p>`] : []),
    ...(input.billingUrl ? [`<p><a href="${escapeHtml(input.billingUrl)}">View your billing and receipts</a></p>`] : []),
    "<p>Cape Fencing Academy</p>",
  ].join("\n");
  const subject = input.receiptNumber ? `Payment received - CFA receipt ${input.receiptNumber}` : "Payment received - Cape Fencing Academy";
  return { to: input.to, subject, text: lines.join("\n\n"), html };
}

export type SendEmailResult = { ok: true } | { ok: false; error: string };

export async function sendWithResend(config: ResendConfig, email: OutgoingEmail, fetchImpl: typeof fetch = fetch): Promise<SendEmailResult> {
  try {
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.from, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
      signal: AbortSignal.timeout(15_000),
    });
    // Resend's error body can echo request details, so only the status is kept.
    return response.ok ? { ok: true } : { ok: false, error: `Resend responded with ${response.status}` };
  } catch {
    return { ok: false, error: "Could not reach Resend." };
  }
}
