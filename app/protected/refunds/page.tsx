import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMyRefundablePayments, listMyRefundRequests } from "@/lib/services/refund-service";
import type { PaymentKind, RefundRequest, RefundStatus } from "@/types/domain";
import { formatZar } from "@/lib/money";

export const dynamic = "force-dynamic";



function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

const KIND_LABELS: Record<PaymentKind, string> = {
  booking: "Lesson booking",
  order: "Shop order",
  membership: "Membership",
  invoice: "Invoice",
};

// Plain-language status for the payer, with a colour for the badge.
const STATUS_VIEW: Record<RefundStatus, { label: string; tone: string; note: string }> = {
  requested: {
    label: "Requested",
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    note: "CFA staff will review your request.",
  },
  approved: {
    label: "Approved",
    tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    note: "Your refund has been approved and is waiting to be paid out.",
  },
  processing: {
    label: "Being processed",
    tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    note: "Your refund has been sent to the payment provider.",
  },
  processed: {
    label: "Refunded",
    tone: "bg-green-600/15 text-green-700 dark:text-green-400",
    note: "Your refund has been paid out.",
  },
  rejected: {
    label: "Not approved",
    tone: "bg-muted text-muted-foreground",
    note: "CFA did not approve this refund.",
  },
  failed: {
    label: "Failed",
    tone: "bg-red-500/15 text-red-700 dark:text-red-400",
    note: "The refund could not be completed. CFA staff will be in touch.",
  },
};

// The service reports access problems as text; turn them into what the page does.
function accessProblem(error: string): "login" | "forbidden" | "other" {
  if (/not authenticated|sign in|unauthenticated/i.test(error)) return "login";
  if (/forbidden|not allowed|guardian|permission/i.test(error)) return "forbidden";
  return "other";
}

function RefundCard({ refund }: { refund: RefundRequest }) {
  const view = STATUS_VIEW[refund.status];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
          <span>{refund.refundNumber}</span>
          <span className={"rounded-lg px-2.5 py-1 text-xs font-medium " + view.tone}>{view.label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <div><dt className="inline text-muted-foreground">Payment: </dt><dd className="inline">{KIND_LABELS[refund.kind]} - {formatZar(refund.paymentAmountCents)}</dd></div>
          <div><dt className="inline text-muted-foreground">Refund amount: </dt><dd className="inline font-semibold">{formatZar(refund.amountCents)}</dd></div>
          <div><dt className="inline text-muted-foreground">Requested: </dt><dd className="inline">{formatDate(refund.createdAt)}</dd></div>
          {refund.processedAt ? (
            <div><dt className="inline text-muted-foreground">Paid out: </dt><dd className="inline">{formatDate(refund.processedAt)}</dd></div>
          ) : null}
        </dl>
        <p><span className="text-muted-foreground">Your reason: </span>{refund.reason}</p>
        <p className="text-muted-foreground">{view.note}</p>
        {refund.decisionNote ? (
          <p><span className="text-muted-foreground">Note from CFA: </span>{refund.decisionNote}</p>
        ) : null}
        {refund.status === "processed" && refund.externalReference ? (
          <p><span className="text-muted-foreground">Refund reference: </span>{refund.externalReference}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ requested?: string }>;
}) {
  const sp = await searchParams;
  const [requests, payments] = await Promise.all([listMyRefundRequests(), listMyRefundablePayments()]);

  const failure = !requests.ok ? requests.error : !payments.ok ? payments.error : null;
  if (failure) {
    const problem = accessProblem(failure);
    if (problem === "login") redirect("/auth/login?next=%2Fprotected%2Frefunds");
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Refunds</h1>
        <p role="status" className="text-muted-foreground">
          {problem === "forbidden"
            ? "Your guardian manages payments and refunds."
            : "Refunds could not be loaded right now. Please try again later."}
        </p>
      </div>
    );
  }

  const refunds = requests.ok ? requests.data : [];
  const refundable = (payments.ok ? payments.data : []).filter((p) => p.refundableCents > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Refunds</h1>
        <p className="text-muted-foreground">
          Refunds are paid back to you by bank transfer or to the card you paid with. CFA staff review every request.
        </p>
      </div>

      {sp.requested === "1" ? (
        <p role="status" className="rounded-lg border border-green-600/40 bg-green-600/10 p-4 text-sm text-green-800 dark:text-green-300">
          Your refund request has been sent. CFA staff will review it and you can follow its progress here.
        </p>
      ) : null}

      <section className="space-y-3" aria-labelledby="refund-requests-heading">
        <h2 id="refund-requests-heading" className="text-xl font-semibold">Your refund requests</h2>
        {refunds.length === 0 ? (
          <p className="text-muted-foreground">You have not requested any refunds.</p>
        ) : (
          refunds.map((refund) => <RefundCard key={refund.id} refund={refund} />)
        )}
      </section>

      <section className="space-y-3" aria-labelledby="refundable-heading">
        <h2 id="refundable-heading" className="text-xl font-semibold">Payments you can request a refund for</h2>
        {refundable.length === 0 ? (
          <p className="text-muted-foreground">There are no settled payments with an amount left to refund.</p>
        ) : (
          <ul className="space-y-3">
            {refundable.map((payment) => (
              <li key={payment.attemptId}>
                <Card>
                  <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm">
                      <p className="font-medium">
                        {KIND_LABELS[payment.kind]}
                        {payment.receiptNumber ? " - receipt " + payment.receiptNumber : ""}
                        {payment.invoiceNumber ? " - invoice " + payment.invoiceNumber : ""}
                      </p>
                      <p className="text-muted-foreground">
                        Paid {formatZar(payment.amountCents)}
                        {payment.completedAt ? " on " + formatDate(payment.completedAt) : ""}
                        {" - "}up to {formatZar(payment.refundableCents)} can be refunded
                      </p>
                    </div>
                    <Link
                      href={"/protected/refunds/new?attempt=" + encodeURIComponent(payment.attemptId)}
                      className="shrink-0 text-sm font-medium underline underline-offset-4"
                    >
                      Request refund
                    </Link>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
