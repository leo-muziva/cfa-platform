import "server-only";
import { payFastApiSignature } from "./payfast";

/*
 * PayFast Refunds API client.
 *
 * UNVERIFIED LIVE: PayFast's own PHP SDK refuses refunds in test mode ("Refunds is not available in
 * Sandbox mode", https://github.com/Payfast/payfast-php-sdk/blob/master/lib/Services/Refunds.php),
 * so this client has only been exercised against injected fetchers in unit tests. It is wired in
 * behind PAYFAST_REFUNDS_ENABLED=true (off by default) via lib/payments/registry.ts.
 *
 * Confirmed from the PHP SDK (lib/PayFastApi.php, lib/Request.php, lib/Services/Refunds.php):
 * - base URL https://api.payfast.co.za, POST refunds/{id} where id is the PayFast payment id
 * - sandbox adds query testing=true, which is NOT part of the signed data
 * - headers merchant-id, version=v1, timestamp, signature; JSON request body
 * - signature = payFastApiSignature(headers + body params, passphrase) (see payfast.ts)
 * - body fields amount (integer cents), reason, acc_type, notify_buyer (SDK default 1)
 * Corroborated by https://dev.to/greggcbs/payfast-api-nodejs-signature-and-headers-function-1m92
 * (same signing, Content-Type application/json, amount in cents, testing=true).
 *
 * Assumed / not confirmed (developers.payfast.co.za/api is script-rendered and could not be read):
 * - acc_type is omitted: it only applies to EFT bank-account refunds, which this club does not
 *   collect; card payments refund to the original card.
 * - success response follows PayFast's generic API envelope {code, status:"success",
 *   data:{response:true, ...}}; the refund-specific payload and any refund id field are unknown,
 *   so the reference is best-effort.
 * - timestamp format: the SDK uses PHP date("Y-m-d\TH:i:sO"); we send UTC ISO-8601 with an
 *   explicit "+00:00" offset. Whatever string is sent is also the one signed.
 * - PayFast exposes no idempotency key for refunds, so callers must treat retryable failures
 *   (timeouts especially) as "outcome unknown" and reconcile before re-sending.
 */

export interface ProviderRefundRequest {
  providerPaymentId: string;
  /** Positive integer string of cents. */
  amountCents: string;
  reason: string;
}

export type ProviderRefundResult =
  | { ok: true; reference: string | null }
  | { ok: false; error: string; retryable: boolean };

export interface ProviderRefundClient {
  name: "payfast_sandbox" | "payfast";
  refund(input: ProviderRefundRequest): Promise<ProviderRefundResult>;
}

const API_BASE = "https://api.payfast.co.za";
const MAX_REASON_LENGTH = 100;

function formatTimestamp(date: Date): string {
  return `${date.toISOString().slice(0, 19)}+00:00`;
}

function sanitizeReason(reason: string): string {
  return reason.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_REASON_LENGTH);
}

function pickReference(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  for (const key of ["refund_id", "id", "token", "reference"]) {
    const value = record[key];
    if ((typeof value === "string" || typeof value === "number") && /^[A-Za-z0-9-]{1,64}$/.test(String(value))) {
      return String(value);
    }
  }
  return null;
}

function isSuccessEnvelope(body: unknown): body is { data?: unknown } {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | undefined;
  if (data && typeof data === "object" && data.response === false) return false;
  const status = typeof record.status === "string" ? record.status.toLowerCase() : "";
  return status === "success" || status === "completed" || (!!data && typeof data === "object" && data.response === true);
}

export function createPayFastRefundClient(
  config: { merchantId: string; passphrase: string },
  options: { testing?: boolean; fetcher?: typeof fetch; now?: () => Date } = {},
): ProviderRefundClient {
  const merchantId = config.merchantId.trim();
  if (!merchantId || !config.passphrase.trim()) throw new Error("Incomplete PayFast refund configuration.");
  const testing = options.testing ?? true;
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => new Date());

  return {
    name: testing ? "payfast_sandbox" : "payfast",
    async refund(input: ProviderRefundRequest): Promise<ProviderRefundResult> {
      const paymentId = input.providerPaymentId?.trim() ?? "";
      if (!/^[A-Za-z0-9-]{1,64}$/.test(paymentId)) {
        return { ok: false, error: "Invalid provider payment id.", retryable: false };
      }
      // JSON numbers must stay exact, so cap at Number.MAX_SAFE_INTEGER cents.
      if (!/^[1-9]\d{0,15}$/.test(input.amountCents ?? "") || !Number.isSafeInteger(Number(input.amountCents))) {
        return { ok: false, error: "Invalid refund amount.", retryable: false };
      }
      const reason = sanitizeReason(input.reason ?? "");
      if (!reason) return { ok: false, error: "A refund reason is required.", retryable: false };

      const body = { amount: Number(input.amountCents), reason, notify_buyer: 1 };
      const headers: Record<string, string> = {
        "merchant-id": merchantId,
        version: "v1",
        timestamp: formatTimestamp(now()),
      };
      const signature = payFastApiSignature(
        { ...headers, amount: String(body.amount), reason: body.reason, notify_buyer: String(body.notify_buyer) },
        config.passphrase,
      );
      const url = `${API_BASE}/refunds/${encodeURIComponent(paymentId)}${testing ? "?testing=true" : ""}`;

      let response: Response;
      try {
        response = await fetcher(url, {
          method: "POST",
          headers: { ...headers, signature, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body),
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        // Timeout or network failure: PayFast may or may not have processed it.
        return { ok: false, error: "PayFast refund request did not complete.", retryable: true };
      }

      if (response.status >= 500 || response.status === 429) {
        return { ok: false, error: `PayFast is unavailable (HTTP ${response.status}).`, retryable: true };
      }
      if (!response.ok) {
        return { ok: false, error: `PayFast rejected the refund (HTTP ${response.status}).`, retryable: false };
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse((await response.text()).slice(0, 65_536));
      } catch {
        return { ok: false, error: "PayFast returned an unreadable refund response.", retryable: false };
      }
      if (!isSuccessEnvelope(parsed)) {
        return { ok: false, error: "PayFast did not confirm the refund.", retryable: false };
      }
      return { ok: true, reference: pickReference(parsed.data) };
    },
  };
}
