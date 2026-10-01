import Link from "next/link";
import { notFound } from "next/navigation";
import { getPaymentStatus } from "@/lib/services/payment-service";

export const dynamic = "force-dynamic";

export default async function PaymentResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const { attemptId } = await params;
  const { cancelled } = await searchParams;
  const payment = await getPaymentStatus(attemptId);
  if (!payment) notFound();
  const successMessage = payment.credited
    ? payment.kind === "order"
      ? "Payment received, but your order changed before it was confirmed, so the payment was kept as account credit. Check your billing page for details."
      : payment.kind === "booking"
        ? "Payment received after your lesson hold expired, so the lesson was released and the payment was kept as account credit. Check your billing page for details."
        : "Payment received. Some or all of this payment was recorded as account credit. Check your billing page for details."
    : payment.kind === "booking"
      ? "Payment confirmed. Your lesson is booked."
      : payment.kind === "order"
        ? "Payment confirmed. Your order has joined the next bulk order."
        : "Payment confirmed. Your invoice balance has been updated.";
  const message = payment.status === "succeeded"
    ? successMessage
    : payment.status === "pending" && cancelled === "1"
      ? payment.kind === "booking"
        ? "Checkout was cancelled. Your lesson stays held until the hold expires, so you can still pay from My lessons or Billing."
        : "Checkout was cancelled. No payment was taken. You can start checkout again when you are ready."
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
        {payment.kind === "booking" && <Link className="underline" href="/protected/lessons">View lessons</Link>}
        {payment.kind === "order" && <Link className="underline" href="/protected/shop/orders">View your orders</Link>}
        {payment.status === "succeeded" && <Link className="underline" href={`/protected/refunds/new?attempt=${encodeURIComponent(attemptId)}`}>Request a refund</Link>}
      </div>
    </div>
  );
}
