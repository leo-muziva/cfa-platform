import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/portal/action-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestRefundAction } from "@/app/actions/refunds";
import { getMyRefundablePayment } from "@/lib/services/refund-service";
import type { PaymentKind } from "@/types/domain";

export const dynamic = "force-dynamic";

const zar = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });

const KIND_LABELS: Record<PaymentKind, string> = {
  booking: "Lesson booking",
  order: "Shop order",
  membership: "Membership",
  invoice: "Invoice",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/protected/refunds" className="text-sm text-muted-foreground underline underline-offset-4">
        Back to refunds
      </Link>
      <h1 className="text-3xl font-bold">Request a refund</h1>
      {children}
    </div>
  );
}

export default async function NewRefundPage({
  searchParams,
}: {
  searchParams: Promise<{ attempt?: string }>;
}) {
  const { attempt } = await searchParams;
  const attemptId = (attempt ?? "").trim();

  if (!attemptId) {
    return (
      <Shell>
        <p role="status">Choose a payment from your refunds page to request a refund for it.</p>
      </Shell>
    );
  }

  const result = await getMyRefundablePayment(attemptId);
  if (!result.ok) {
    if (/not authenticated|sign in|unauthenticated/i.test(result.error)) {
      redirect("/auth/login?next=" + encodeURIComponent("/protected/refunds/new?attempt=" + attemptId));
    }
    const forbidden = /forbidden|not allowed|guardian|permission/i.test(result.error);
    return (
      <Shell>
        <p role="status" className="text-muted-foreground">
          {forbidden
            ? "Your guardian manages payments and refunds."
            : "This payment could not be loaded right now. Please try again later."}
        </p>
      </Shell>
    );
  }

  const payment = result.data;
  if (!payment || payment.refundableCents <= 0) {
    return (
      <Shell>
        <p role="status">
          {payment
            ? "This payment has already been fully refunded, or refunds for the full amount are already in progress."
            : "This payment cannot be refunded. Only your own settled payments can be refunded."}
        </p>
      </Shell>
    );
  }

  const refundableRands = (payment.refundableCents / 100).toFixed(2);

  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div><dt className="inline text-muted-foreground">For: </dt><dd className="inline">{KIND_LABELS[payment.kind]}</dd></div>
            <div><dt className="inline text-muted-foreground">Amount paid: </dt><dd className="inline">{zar.format(payment.amountCents / 100)}</dd></div>
            {payment.completedAt ? (
              <div>
                <dt className="inline text-muted-foreground">Paid on: </dt>
                <dd className="inline">
                  {new Date(payment.completedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
                </dd>
              </div>
            ) : null}
            {payment.receiptNumber ? (
              <div><dt className="inline text-muted-foreground">Receipt: </dt><dd className="inline">{payment.receiptNumber}</dd></div>
            ) : null}
            {payment.invoiceNumber ? (
              <div><dt className="inline text-muted-foreground">Invoice: </dt><dd className="inline">{payment.invoiceNumber}</dd></div>
            ) : null}
            <div>
              <dt className="inline text-muted-foreground">Can be refunded: </dt>
              <dd className="inline font-semibold">{zar.format(payment.refundableCents / 100)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your request</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={requestRefundAction} submitLabel="Send refund request">
            <input type="hidden" name="attemptId" value={payment.attemptId} />
            <div className="grid gap-2">
              <Label htmlFor="refund-amount">Amount to refund (R)</Label>
              <Input
                id="refund-amount"
                name="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max={refundableRands}
                defaultValue={refundableRands}
                required
                aria-describedby="refund-amount-hint"
              />
              <p id="refund-amount-hint" className="text-sm text-muted-foreground">
                Up to {zar.format(payment.refundableCents / 100)}. Leave the full amount for a full refund.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="refund-reason">Reason</Label>
              <textarea
                id="refund-reason"
                name="reason"
                required
                maxLength={500}
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Refunds are paid back by bank transfer or to the card you paid with, not as account credit.
            </p>
          </ActionForm>
        </CardContent>
      </Card>
    </Shell>
  );
}
