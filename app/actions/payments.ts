"use server";

// Server Action behind the "Pay now" buttons.
import { redirect } from "next/navigation";
import { startPayment } from "@/lib/services/payment-service";

export interface PaymentActionState { error?: string }

/**
 * Starts a payment for a lesson hold, an invoice or a membership, then
 * sends the browser to the checkout route.
 */
export async function startCheckoutAction(_: PaymentActionState, formData: FormData): Promise<PaymentActionState> {
  const bookingId = formData.get("bookingId");
  const invoiceId = formData.get("invoiceId");
  const membershipApplicationId = formData.get("membershipApplicationId");
  const result = await startPayment({
    ...(bookingId !== null ? { bookingId } : {}),
    ...(invoiceId !== null ? { invoiceId } : {}),
    ...(membershipApplicationId !== null ? { membershipApplicationId } : {}),
  });
  if (!result.ok) return { error: result.error };
  redirect(`/api/payments/checkout?attempt=${encodeURIComponent(result.attemptId)}`);
}
