import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentStatusRefresher } from "@/components/payments/payment-status-refresher";
import { formatZarWithCents } from "@/lib/money";
import { getPaymentStatus } from "@/lib/services/payment-service";

export const dynamic = "force-dynamic";

/**
 * /protected/payments/[attemptId]: where the provider sends the payer back.
 * Shows the payment status and refreshes until the webhook has settled it.
 */
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
      : payment.kind === "membership"
        ? "Payment received, but this membership approval was withdrawn before it was confirmed, so the payment was kept as account credit. Contact CFA for help."
      : payment.kind === "booking"
        ? "Payment received after your lesson hold expired, so the lesson was released and the payment was kept as account credit. Check your billing page for details."
        : "Payment received. Some or all of this payment was recorded as account credit. Check your billing page for details."
    : payment.kind === "booking"
      ? "Your lesson is booked."
      : payment.kind === "order"
        ? "Your order has joined the next bulk order."
        : payment.kind === "membership"
          ? "Your membership is now active. Welcome to Cape Fencing Academy."
          : "Your invoice balance has been updated.";
  const succeeded = payment.status === "succeeded";
  const waiting = payment.status === "pending" && cancelled !== "1";
  const message = succeeded
    ? successMessage
    : payment.status === "pending" && cancelled === "1"
      ? payment.kind === "booking"
        ? "Checkout was cancelled. Your lesson stays held until the hold expires, so you can still pay from My lessons or Billing."
        : "Checkout was cancelled. No payment was taken. You can start checkout again when you are ready."
    : waiting
      ? "Waiting for PayFast to confirm your payment. This usually takes a few seconds."
      : "Payment was not completed. Check your billing or lesson page before starting another payment.";
  const title = succeeded ? "Payment successful" : waiting ? "Confirming your payment" : "Payment not completed";
  const Icon = succeeded ? CheckCircle2 : waiting ? Clock : XCircle;
  const emailNote = payment.kind === "order"
    ? "An order confirmation is on its way to your email."
    : "A receipt is on its way to your email.";
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Card>
        <CardHeader className="items-center text-center">
          <Icon aria-hidden="true" className={`h-12 w-12 ${succeeded ? "text-emerald-600 dark:text-emerald-400" : waiting ? "text-amber-500" : "text-destructive"}`} />
          <CardTitle className="text-2xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p role="status">{message}</p>
          {succeeded && (
            <dl className="mx-auto grid max-w-xs grid-cols-2 gap-x-4 gap-y-1 text-left text-sm">
              <dt className="text-muted-foreground">Amount paid</dt>
              <dd className="font-semibold">{formatZarWithCents(payment.amount_cents)}</dd>
              {payment.receipt_number && <>
                <dt className="text-muted-foreground">Receipt</dt>
                <dd className="font-semibold">{payment.receipt_number}</dd>
              </>}
            </dl>
          )}
          {succeeded && <p className="text-sm text-muted-foreground">{emailNote}</p>}
          {waiting && <PaymentStatusRefresher />}
          <p className="text-xs text-muted-foreground">Sandbox demonstration - no real money is charged.</p>
        </CardContent>
      </Card>
      <div className="flex flex-wrap justify-center gap-4 text-sm">
        {payment.kind === "booking" && <Link className="underline" href="/protected/lessons">View lessons</Link>}
        {payment.kind === "order" && <Link className="underline" href="/protected/shop/orders">View your orders</Link>}
        {payment.kind === "membership" && <Link className="underline" href="/protected/membership">View membership</Link>}
        <Link className="underline" href="/protected/billing">View billing and receipts</Link>
        {succeeded && <Link className="underline" href={`/protected/refunds/new?attempt=${encodeURIComponent(attemptId)}`}>Request a refund</Link>}
      </div>
    </div>
  );
}
