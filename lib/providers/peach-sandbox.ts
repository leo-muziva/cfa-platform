import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SANDBOX_CHECKOUT_URL = "https://testsecure.peachpayments.com/checkout";

export interface PeachSandboxCheckout {
  action: string;
  fields: Record<string, string>;
}

function configuredValue(name: "PEACH_ENTITY_ID" | "PEACH_SECRET_TOKEN" | "PEACH_WEBHOOK_SECRET") {
  const value = process.env[name]?.trim();
  return value || null;
}

export function isPeachSandboxEnabled() {
  return process.env.CFA_PEACH_SANDBOX_ENABLED === "true"
    && Boolean(configuredValue("PEACH_ENTITY_ID") && configuredValue("PEACH_SECRET_TOKEN") && configuredValue("PEACH_WEBHOOK_SECRET"));
}

function signFields(fields: Record<string, string>, secret: string) {
  return createHmac("sha256", secret)
    .update(Object.keys(fields).sort().map((key) => `${key}${fields[key]}`).join(""))
    .digest("hex");
}

export function createPeachSandboxCheckout(input: {
  amountCents: number;
  merchantTransactionId: string;
  returnUrl: string;
  notificationUrl: string;
}): PeachSandboxCheckout {
  const entityId = configuredValue("PEACH_ENTITY_ID");
  const secret = configuredValue("PEACH_SECRET_TOKEN");
  if (!isPeachSandboxEnabled() || !entityId || !secret) throw new Error("Peach sandbox is not configured");
  const fields = {
    amount: (input.amountCents / 100).toFixed(2),
    "authentication.entityId": entityId,
    currency: "ZAR",
    merchantTransactionId: input.merchantTransactionId,
    nonce: randomBytes(16).toString("hex"),
    notificationUrl: input.notificationUrl,
    paymentType: "DB",
    shopperResultUrl: input.returnUrl,
  };
  return { action: SANDBOX_CHECKOUT_URL, fields: { ...fields, signature: signFields(fields, secret) } };
}

export function verifyPeachSandboxWebhook(input: { body: string; url: string; headers: Headers }) {
  const secret = configuredValue("PEACH_WEBHOOK_SECRET");
  const timestamp = input.headers.get("x-webhook-timestamp");
  const eventId = input.headers.get("x-webhook-id");
  const signature = input.headers.get("x-webhook-signature");
  if (!secret || !timestamp || !eventId || !signature) return null;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${eventId}.${input.url}.${input.body}`).digest("hex");
  const received = Buffer.from(signature, "hex");
  const calculated = Buffer.from(expected, "hex");
  if (received.length !== calculated.length || !timingSafeEqual(received, calculated)) return null;
  const parameters = new URLSearchParams(input.body);
  const reference = parameters.get("merchantTransactionId");
  if (!reference) return null;
  return { eventId, providerReference: reference, succeeded: parameters.get("result.code") === "000.000.000" };
}
