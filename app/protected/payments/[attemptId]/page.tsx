import Link from "next/link";
import { notFound } from "next/navigation";
import { getPaymentStatus } from "@/lib/services/payment-service";

export const dynamic = "force-dynamic";

export default async function PaymentResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const payment = await getPaymentStatus(attemptId);
  if (!payment) notFound();
  const message = payment.status === "succeeded"
    ? payment.credited
      ? "Payment received. Some or all of this payment was recorded as account credit. Check your billing page for details."
      : payment.kind === "booking" ? "Payment confirmed. Your lesson is booked." : "Payment confirmed. Your invoice balance has been updated."
    : payment.status === "pending"
      ? "Waiting for payment confirmation. Returning from checkout does not confirm payment. If you cancelled checkout, no payment is confirmed here. Refresh after a few moments."
      : "Payment was not completed. Check your billing or lesson page before starting another payment.";
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Payment status</h1>
      <p>Sandbox demonstration - no real money is charged.</p>
      <p role="status">{message}</p>
      <div className="flex flex-wrap gap-4">
        <a className="underline" href={`/protected/payments/${attemptId}`}>Refresh payment status</a>
        <Link className="underline" href="/protected/billing">View billing and receipts</Link>
        <Link className="underline" href="/protected/lessons">View lessons</Link>
      </div>
    </div>
  );
}
