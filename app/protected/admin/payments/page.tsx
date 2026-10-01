import { ActionForm } from '@/components/portal/action-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { staffRaiseRefundAction } from '@/app/actions/refunds'
import { getInvoicesForAdmin } from '@/lib/services/PlatformService'
import { listRefundablePaymentsForStaff } from '@/lib/services/refund-service'
import type { PaymentKind } from '@/types/domain'

export const dynamic = 'force-dynamic'

const zar = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })

const KIND_LABELS: Record<PaymentKind, string> = {
  booking: 'Lesson booking',
  order: 'Shop order',
  invoice: 'Invoice',
}

export default async function PaymentsPage() {
  const [result, settled] = await Promise.all([getInvoicesForAdmin(), listRefundablePaymentsForStaff()])
  const invoices = 'invoices' in result ? result.invoices : []
  const outstanding = invoices.filter((i) => i.status !== 'paid')
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Payments and arrears</h1><p className="text-muted-foreground">No booking suspension or late fees are applied while arrears policy is pending.</p></div>
      <Card><CardHeader><CardTitle>Outstanding invoices</CardTitle></CardHeader><CardContent>{outstanding.length}</CardContent></Card>
      {outstanding.map((invoice) => <Card key={invoice.id}><CardContent className="pt-6">{invoice.invoice_number} - R{Number(invoice.total).toFixed(2)}</CardContent></Card>)}

      <section className="space-y-3" aria-labelledby="settled-payments-heading">
        <div>
          <h2 id="settled-payments-heading" className="text-xl font-semibold">Settled payments</h2>
          <p className="text-sm text-muted-foreground">Raise a refund on a payer&apos;s behalf. It joins the Refunds queue for approval like any other request.</p>
        </div>
        {!settled.ok ? (
          <p role="alert" className="text-sm text-destructive">Settled payments could not be loaded: {settled.error}</p>
        ) : settled.data.length === 0 ? (
          <p className="text-muted-foreground">No settled payments yet.</p>
        ) : (
          <ul className="space-y-3">
            {settled.data.map((payment) => {
              const id = payment.attemptId
              const refundableRands = (payment.refundableCents / 100).toFixed(2)
              return (
                <li key={id}>
                  <Card>
                    <CardContent className="space-y-3 pt-6 text-sm">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium">
                            {payment.payerName} - {KIND_LABELS[payment.kind]}
                            {payment.receiptNumber ? ` - receipt ${payment.receiptNumber}` : ''}
                            {payment.invoiceNumber ? ` - invoice ${payment.invoiceNumber}` : ''}
                          </p>
                          <p className="text-muted-foreground">
                            {payment.completedAt ? `Paid ${new Date(payment.completedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Paid'}
                            {payment.provider ? ` via ${payment.provider}` : ''}
                          </p>
                        </div>
                        <p className="shrink-0 text-right">
                          <span className="font-semibold">{zar.format(payment.amountCents / 100)}</span>
                          <span className="block text-muted-foreground">Refundable {zar.format(payment.refundableCents / 100)}</span>
                        </p>
                      </div>
                      {payment.refundableCents > 0 ? (
                        <details className="rounded-md border p-3">
                          <summary className="cursor-pointer font-medium">Raise refund</summary>
                          <ActionForm action={staffRaiseRefundAction} submitLabel="Raise refund" className="mt-3 space-y-3">
                            <input type="hidden" name="attemptId" value={id} />
                            <div className="grid gap-2">
                              <Label htmlFor={`raise-${id}-amount`}>Amount (R)</Label>
                              <Input id={`raise-${id}-amount`} name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" max={refundableRands} defaultValue={refundableRands} required />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor={`raise-${id}-reason`}>Reason</Label>
                              <textarea id={`raise-${id}-reason`} name="reason" rows={2} maxLength={500} required className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                            </div>
                          </ActionForm>
                        </details>
                      ) : (
                        <p className="text-muted-foreground">Fully refunded or already in the refunds queue.</p>
                      )}
                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
