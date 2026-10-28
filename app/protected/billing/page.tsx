import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getMembershipPaymentsDue, getPayerBilling } from '@/lib/services/PlatformService'
import { formatCapeTownLessonDate } from '@/lib/booking-calendar'
import { CheckoutButton } from '@/components/payments/checkout-button'
import { listMyRefundablePayments } from '@/lib/services/refund-service'
import { getPayableLessonHolds } from '@/lib/services/LessonBookingService'
import { formatCapeTownTime } from '@/lib/booking-calendar'
import { formatRandsWithCents, formatZarWithCents } from '@/lib/money'

/**
 * /protected/billing: the payer's balance, outstanding and upcoming
 * charges, lesson holds and memberships to pay, invoices and receipts.
 * Dependents get a short note that their guardian handles billing.
 */
export default async function BillingPage() {
  const billing = await getPayerBilling()
  if ('error' in billing) {
    if (billing.error === 'Not authenticated') redirect('/auth/login')
    if (billing.error !== 'Forbidden') notFound()
    // Dependents reach this page from old links or bookmarks; say who pays
    // rather than showing a bare 404, and still show no amounts.
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Billing and invoices</h1>
        <Card>
          <CardHeader><CardTitle>Your guardian handles billing</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Invoices, payments and receipts for your account go to the guardian linked to it, so there is nothing to pay here.</p>
            <p><Link className="underline" href="/protected/family">See your family link</Link> or <Link className="underline" href="/protected">go back to the dashboard</Link>.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Receipts only carry a number, so match them to refundable payments by it.
  // A failed lookup just hides the per-receipt links; the Refunds page still works.
  const [refundable, holdsResult, membershipsDue] = await Promise.all([listMyRefundablePayments(), getPayableLessonHolds(), getMembershipPaymentsDue()])
  const heldLessons = holdsResult.success ? holdsResult.data : []
  const refundAttemptByReceipt = new Map<string, string>()
  if (refundable.ok) {
    for (const payment of refundable.data) {
      if (payment.receiptNumber && payment.refundableCents > 0) refundAttemptByReceipt.set(payment.receiptNumber, payment.attemptId)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing and invoices</h1>
        <p className="text-muted-foreground">Household financial information is visible only to the payer.</p>
        <h2 className="mt-5 text-xl font-semibold">What makes up your amount outstanding</h2>
        <p className="mt-2 text-sm text-muted-foreground">Membership fees and completed or chargeable cancelled lessons become payable once they are final.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Amount outstanding</CardTitle></CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{formatRandsWithCents(billing.balance)}</p>
          <p className="mt-2 text-sm text-muted-foreground">This is the total currently owed. It does not take payment automatically.</p>
        </CardContent>
      </Card>

      <section className="space-y-3" aria-label="Outstanding items">
        {billing.outstandingCharges.map((charge) => (
          <Card key={charge.id}>
            <CardContent className="flex flex-col gap-1 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{charge.label}</p>
                <p className="text-sm text-muted-foreground">{charge.participantName}{charge.finalizedAt ? ` - added ${formatCapeTownLessonDate(charge.finalizedAt)}` : ''}</p>
              </div>
              <span className="font-semibold">{formatRandsWithCents(charge.amount)}</span>
            </CardContent>
          </Card>
        ))}
        {billing.creditTotal > 0 && (
          <Card>
            <CardContent className="flex items-center justify-between pt-6">
              <div><p className="font-medium">Account credits and adjustments</p><p className="text-sm text-muted-foreground">Credits reduce what you owe.</p></div>
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">-{formatRandsWithCents(billing.creditTotal)}</span>
            </CardContent>
          </Card>
        )}
      </section>

      {membershipsDue.length > 0 && (
        <section id="membership" className="space-y-3" aria-labelledby="membership-payments-heading">
          <div><h2 id="membership-payments-heading" className="text-xl font-semibold">Approved memberships waiting for payment</h2><p className="text-sm text-muted-foreground">Each membership becomes active as soon as its payment is confirmed.</p></div>
          {membershipsDue.map((item) => (
            <Card key={item.applicationId}>
              <CardContent className="space-y-1 pt-6">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span><span className="font-medium">{item.applicantName}</span> - {item.membershipName}</span>
                  <span className="font-semibold">{formatZarWithCents(item.totalCents)}</span>
                </div>
                {item.joiningFeeCents !== '0' && <p className="text-sm text-muted-foreground">Includes a {formatZarWithCents(item.joiningFeeCents)} joining fee</p>}
                {billing.providerAvailable ? <CheckoutButton membershipApplicationId={item.applicationId} /> : <p className="text-sm text-muted-foreground">Online payments are unavailable right now.</p>}
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {heldLessons.length > 0 && (
        <section className="space-y-3" aria-labelledby="held-lessons-heading">
          <div><h2 id="held-lessons-heading" className="text-xl font-semibold">Lessons waiting for payment</h2><p className="text-sm text-muted-foreground">These pay-now lessons are held for you. Unpaid holds are released when they expire.</p></div>
          {heldLessons.map((hold) => (
            <Card key={hold.bookingId}>
              <CardContent className="space-y-1 pt-6">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span><span className="font-medium">{hold.participantNames.join(' and ')}</span> - {formatCapeTownLessonDate(hold.startsAt)} with {hold.coachName}</span>
                  <span className="font-semibold">{formatZarWithCents(hold.amountCents)}</span>
                </div>
                <p className="text-sm text-muted-foreground">Held until {formatCapeTownTime(hold.holdExpiresAt)}</p>
                {billing.providerAvailable ? <CheckoutButton bookingId={hold.bookingId} /> : <p className="text-sm text-muted-foreground">Online payments are unavailable right now.</p>}
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-3" aria-labelledby="pending-lessons-heading">
        <div><h2 id="pending-lessons-heading" className="text-xl font-semibold">Upcoming lessons - not yet outstanding</h2><p className="text-sm text-muted-foreground">An upcoming lesson only adds to your amount outstanding after it happens, or after a late cancellation.</p></div>
        {billing.pendingLessonCharges.length === 0 ? <p>No upcoming lesson charges.</p> : billing.pendingLessonCharges.map((charge) => <Card key={charge.id}><CardContent className="flex flex-col gap-1 pt-6 sm:flex-row sm:items-center sm:justify-between"><span><span className="font-medium">{charge.participantName}</span>{charge.lessonStartsAt ? ` - ${formatCapeTownLessonDate(charge.lessonStartsAt)}` : ''}</span><span className="font-semibold">{formatRandsWithCents(charge.amount)}</span></CardContent></Card>)}
      </section>

      {!billing.providerAvailable && <Card><CardHeader><CardTitle>Online payments unavailable</CardTitle></CardHeader><CardContent>Use the invoice number as the reference for a manual bank transfer. Once CFA records your payment, it appears as a receipt and reduces your amount outstanding.</CardContent></Card>}

      <section className="space-y-3">
        <div><h2 className="text-xl font-semibold">Invoices</h2><p className="text-sm text-muted-foreground">An invoice is a statement of your outstanding items, not an additional charge.</p></div>
        {billing.invoices.length === 0 ? <p>No invoices yet.</p> : billing.invoices.map((invoice) => <Card key={invoice.id}><CardHeader><CardTitle className="flex justify-between"><span>{invoice.invoice_number}</span><Badge>{invoice.status}</Badge></CardTitle></CardHeader><CardContent><p>{formatRandsWithCents(invoice.total)}</p><ul className="mt-3 space-y-1 text-sm text-muted-foreground">{invoice.lines?.map((line) => <li key={line.id}>{line.participant?.full_name || 'Participant'} - {line.description}: {formatRandsWithCents(line.amount)}</li>)}</ul><div className="mt-3 flex flex-wrap items-center gap-3"><Link className="text-sm font-medium underline underline-offset-4" href={`/protected/billing/invoices/${invoice.id}`}>View invoice<span className="sr-only"> {invoice.invoice_number}</span></Link><a className="text-sm font-medium underline underline-offset-4" href={`/api/invoices/${invoice.id}/pdf`}>Download PDF<span className="sr-only"> for invoice {invoice.invoice_number}</span></a>{billing.providerAvailable && invoice.status !== 'paid' && <CheckoutButton invoiceId={invoice.id} />}</div></CardContent></Card>)}
      </section>

      <section className="space-y-3"><h2 className="text-xl font-semibold">Receipts</h2>{billing.receipts.length === 0 ? <p>No receipts yet.</p> : billing.receipts.map((receipt) => { const refundAttempt = refundAttemptByReceipt.get(receipt.receipt_number); return <Card key={receipt.id}><CardHeader><CardTitle>{receipt.receipt_number}</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-2"><span>{formatRandsWithCents(receipt.amount)}</span>{refundAttempt && <Link className="text-sm underline underline-offset-4" href={`/protected/refunds/new?attempt=${encodeURIComponent(refundAttempt)}`}>Request refund<span className="sr-only"> for receipt {receipt.receipt_number}</span></Link>}</CardContent></Card> })}</section>

      <section className="space-y-2" aria-labelledby="refunds-heading"><h2 id="refunds-heading" className="text-xl font-semibold">Refunds</h2><p className="text-sm text-muted-foreground">Request a refund on a settled payment and follow the progress of your requests.</p><Link className="inline-block text-sm font-medium underline underline-offset-4" href="/protected/refunds">View refunds</Link></section>
    </div>
  )
}
