// The contract every payment provider adapter implements. The payment
// service only talks to this interface, so a new provider (for example a
// live PayFast account or Peach) is a new adapter, not a new flow.

// What the app asks a provider to charge. Amounts are whole cents as a
// string so they never pass through floating point.
export interface CheckoutRequest {
  reference: string;
  amountCents: string;
  currency: "ZAR";
  description: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

// How the browser reaches the provider: post a hidden form, or follow a redirect.
export type CheckoutResponse =
  | { kind: "form"; action: string; fields: Record<string, string> }
  | { kind: "redirect"; url: string };

// A webhook notification whose signature (and, for PayFast, server-side
// validation) has been checked. Only verified events reach the database.
export interface VerifiedPaymentEvent {
  provider: string;
  eventId: string;
  paymentId: string;
  reference: string;
  status: "pending" | "succeeded" | "failed" | "cancelled";
  amountCents: string;
  currency: "ZAR";
}

// A provider adapter. verifyWebhook returns null for anything it cannot trust.
export interface PaymentGateway {
  readonly name: string;
  createCheckout(input: CheckoutRequest): Promise<CheckoutResponse>;
  verifyWebhook(input: { body: string; headers: Headers; url: string }): Promise<VerifiedPaymentEvent | null>;
}
