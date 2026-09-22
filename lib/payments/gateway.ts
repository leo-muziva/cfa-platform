export interface CheckoutRequest {
  reference: string;
  amountCents: string;
  currency: "ZAR";
  description: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

export type CheckoutResponse =
  | { kind: "form"; action: string; fields: Record<string, string> }
  | { kind: "redirect"; url: string };

export interface VerifiedPaymentEvent {
  provider: string;
  eventId: string;
  paymentId: string;
  reference: string;
  status: "pending" | "succeeded" | "failed" | "cancelled";
  amountCents: string;
  currency: "ZAR";
}

export interface PaymentGateway {
  readonly name: string;
  createCheckout(input: CheckoutRequest): Promise<CheckoutResponse>;
  verifyWebhook(input: { body: string; headers: Headers; url: string }): Promise<VerifiedPaymentEvent | null>;
}
