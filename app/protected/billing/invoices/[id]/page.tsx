import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckoutButton } from '@/components/payments/checkout-button'
import { getInvoiceForPayer, invoicePayPath } from '@/lib/services/invoice-document-service'
import { invoicePeriodLabel } from '@/lib/documents/invoice-pdf'
import { formatRandsWithCents } from '@/lib/money'

/**
 * /protected/billing/invoices/[id]: one invoice, opened from the link in the
 * invoice email or PDF. Everything on the invoice is paid together in one
 * checkout; charges that arrive later go on next month's invoice.
 */
export default async function InvoicePayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getInvoiceForPayer(id)
  if (!result.ok) {
    if (result.reason === 'unauthenticated') redirect(`/auth/login?next=${encodeURIComponent(invoicePayPath(id))}`)
    notFound()
  }
  const { invoice, onlinePayment } = result
  const paid = invoice.status === 'paid'
  const total = formatRandsWithCents(invoice.total)

  return (
    <div className="space-y-6">
      <div>
        <Link className="text-sm underline underline-offset-4" href="/protected/billing">Back to billing</Link>
        <h1 className="mt-2 text-3xl font-bold">Invoice {invoice.invoice_number}</h1>
        <p className="text-muted-foreground">{invoicePeriodLabel(invoice.period)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>{paid ? 'Paid' : `Total due ${total}`}</span>
            <Badge variant={paid ? 'secondary' : 'default'}>{invoice.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y text-sm">
            {(invoice.lines ?? []).map((line) => (
              <li key={line.id} className="flex justify-between gap-4 py-2">
                <span>{line.participant?.full_name || 'Participant'} - {line.description}</span>
                <span className="whitespace-nowrap">{formatRandsWithCents(line.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between border-t pt-3 font-semibold"><span>Total</span><span>{total}</span></p>

          {paid ? (
            <p className="text-sm text-muted-foreground">This invoice is fully paid. Your receipt is on the billing page.</p>
          ) : onlinePayment ? (
            <div>
              <p className="text-sm">Pay everything on this invoice in one payment of <strong>{total}</strong>.</p>
              <CheckoutButton invoiceId={invoice.id} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Online payment is unavailable right now. Pay {total} by EFT using the bank details on the invoice PDF, with {invoice.invoice_number} as the reference.</p>
          )}

          <a className="inline-block text-sm font-medium underline underline-offset-4" href={`/api/invoices/${invoice.id}/pdf`}>Download PDF<span className="sr-only"> for invoice {invoice.invoice_number}</span></a>
        </CardContent>
      </Card>
    </div>
  )
}
