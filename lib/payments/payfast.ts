// PayFast adapter (sandbox). Builds the signed checkout form and verifies
// ITN webhooks: the signature, the field values and a server-to-server
// validate call back to PayFast before an event is trusted.
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { CheckoutRequest, CheckoutResponse, PaymentGateway, VerifiedPaymentEvent } from "./gateway";

interface PayFastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
}

// Matches PHP urlencode, including its treatment of spaces and punctuation.
function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*~]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  ).replace(/%20/g, "+");
}

// Joins fields as key=value pairs in the given order, PayFast-encoded.
function serialize(entries: [string, string][]): string {
  return entries.map(([key, value]) => `${key}=${encode(value)}`).join("&");
}

// PayFast checkout/ITN signature: MD5 of the serialized fields plus the passphrase.
function signature(payload: string, passphrase: string): string {
  return createHash("md5").update(`${payload}&passphrase=${encode(passphrase.trim())}`).digest("hex");
}

/** PHP-urlencode compatible encoding used by every PayFast signature. */
export function encodePayFastValue(value: string): string {
  return encode(value);
}

/**
 * Signature for PayFast's REST API (api.payfast.co.za), which differs from checkout/ITN signing:
 * the passphrase joins the fields, keys are sorted alphabetically, values are PHP-urlencoded,
 * joined as k=v with "&" and hashed with lowercase hex MD5. Any "signature" key is ignored.
 * Source: https://github.com/Payfast/payfast-php-sdk/blob/master/lib/Auth.php (generateApiSignature)
 * and lib/Request.php, which signs the merged headers (merchant-id, version, timestamp), query
 * params (excluding the sandbox "testing" flag) and JSON body params.
 */
export function payFastApiSignature(fields: Record<string, string>, passphrase: string): string {
  const signed: Record<string, string> = { ...fields, passphrase: passphrase.trim() };
  const payload = Object.keys(signed)
    .filter((key) => key !== "signature")
    .sort()
    .map((key) => `${key}=${encode(signed[key])}`)
    .join("&");
  return createHash("md5").update(payload).digest("hex");
}

// Parses a webhook body strictly. Rejects oversized bodies, odd keys and
// duplicate keys, so a tampered body cannot slip extra fields past the signature.
function parseNotification(body: string): [string, string][] | null {
  if (!body || body.length > 32_768) return null;
  const entries: [string, string][] = [];
  const keys = new Set<string>();
  try {
    for (const part of body.split("&")) {
      const separator = part.indexOf("=");
      if (separator < 1) return null;
      const key = decodeURIComponent(part.slice(0, separator).replace(/\+/g, " "));
      const value = decodeURIComponent(part.slice(separator + 1).replace(/\+/g, " "));
      if (!/^[a-z][a-z0-9_]*$/.test(key) || keys.has(key)) return null;
      keys.add(key);
      entries.push([key, value]);
    }
  } catch {
    return null;
  }
  return entries;
}

/**
 * Creates the PayFast sandbox gateway. `fetcher` can be replaced in tests
 * so the validate call does not reach the real PayFast.
 */
export function createPayFastGateway(config: PayFastConfig, fetcher: typeof fetch = fetch): PaymentGateway {
  if (![config.merchantId, config.merchantKey, config.passphrase].every((value) => value.trim())) {
    throw new Error("Incomplete PayFast sandbox configuration.");
  }
  return {
    name: "payfast_sandbox",
    async createCheckout(input: CheckoutRequest): Promise<CheckoutResponse> {
      if (input.currency !== "ZAR" || !/^[1-9]\d*$/.test(input.amountCents) || BigInt(input.amountCents) > BigInt("9223372036854775807")) {
        throw new Error("Invalid payment amount or currency.");
      }
      if (!input.reference.trim() || input.reference.length > 100 || !input.description.trim()) {
        throw new Error("Invalid payment reference or description.");
      }
      for (const target of [input.returnUrl, input.cancelUrl, input.notifyUrl]) {
        const url = new URL(target);
        if (url.protocol !== "https:" || url.username || url.password) throw new Error("Payment URLs must use HTTPS.");
      }
      const cents = BigInt(input.amountCents);
      // PayFast checkout signing uses documented field order, not alphabetical order.
      const fields: Record<string, string> = {
        merchant_id: config.merchantId.trim(),
        merchant_key: config.merchantKey.trim(),
        return_url: input.returnUrl.trim(),
        cancel_url: input.cancelUrl.trim(),
        notify_url: input.notifyUrl.trim(),
        m_payment_id: input.reference.trim(),
        amount: `${cents / BigInt(100)}.${(cents % BigInt(100)).toString().padStart(2, "0")}`,
        item_name: input.description.trim().slice(0, 100),
      };
      fields.signature = signature(serialize(Object.entries(fields)), config.passphrase);
      return { kind: "form", action: "https://sandbox.payfast.co.za/eng/process", fields };
    },
    async verifyWebhook(input): Promise<VerifiedPaymentEvent | null> {
      if (input.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") return null;
      const entries = parseNotification(input.body);
      if (!entries) return null;
      const fields = Object.fromEntries(entries);
      if (fields.merchant_id !== config.merchantId.trim() || !/^[a-fA-F0-9]{32}$/.test(fields.signature ?? "")) return null;
      const payload = serialize(entries.filter(([key]) => key !== "signature"));
      const expected = signature(payload, config.passphrase);
      if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(fields.signature, "hex"))) return null;
      if (!/^\d+$/.test(fields.pf_payment_id ?? "") || !fields.m_payment_id?.trim() || fields.m_payment_id.length > 100) return null;
      if (!/^\d+\.\d{2}$/.test(fields.amount_gross ?? "")) return null;
      const amountCents = BigInt(fields.amount_gross.replace(".", ""));
      if (amountCents <= BigInt(0) || amountCents > BigInt("9223372036854775807")) return null;
      const statuses: Record<string, VerifiedPaymentEvent["status"]> = {
        COMPLETE: "succeeded", FAILED: "failed", PENDING: "pending", CANCELLED: "cancelled",
      };
      const status = Object.hasOwn(statuses, fields.payment_status) ? statuses[fields.payment_status] : undefined;
      if (!status || (fields.currency !== undefined && fields.currency !== "ZAR")) return null;
      try {
        const response = await fetcher("https://sandbox.payfast.co.za/eng/query/validate", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: payload, redirect: "error", signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok || (await response.text()).trim() !== "VALID") return null;
      } catch {
        return null;
      }
      return {
        // One event id per payment and status, so a retried notification is ignored.
        provider: "payfast_sandbox", eventId: `${fields.pf_payment_id}:${fields.payment_status}`,
        paymentId: fields.pf_payment_id, reference: fields.m_payment_id, status,
        amountCents: amountCents.toString(), currency: "ZAR",
      };
    },
  };
}
