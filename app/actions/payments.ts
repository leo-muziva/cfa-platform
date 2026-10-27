"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { startPayment } from "@/lib/services/payment-service";

export interface PaymentActionState { error?: string; notice?: string }

export async function startCheckoutAction(_: PaymentActionState, formData: FormData): Promise<PaymentActionState> {
  const bookingId = formData.get("bookingId");
  const invoiceId = formData.get("invoiceId");
  const membershipApplicationId = formData.get("membershipApplicationId");
  const result = await startPayment({
    ...(bookingId !== null ? { bookingId } : {}),
    ...(invoiceId !== null ? { invoiceId } : {}),
    ...(membershipApplicationId !== null ? { membershipApplicationId } : {}),
  });
  // credit paid the whole invoice: not an error, just nothing to pay
  if (!result.ok && result.code === "paid_by_credit") {
    revalidatePath("/protected/billing");
    return { notice: result.error };
  }
  if (!result.ok) return { error: result.error };
  redirect(`/api/payments/checkout?attempt=${encodeURIComponent(result.attemptId)}`);
}
