import { ActionForm } from '@/components/portal/action-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { runInvoicesAction, recordManualPaymentAction } from '@/app/actions/platform'
import { getInvoicesForAdmin } from '@/lib/services/PlatformService'
import { formatRandsWithCents } from '@/lib/money'

// The billing month is CFA's Africa/Johannesburg month, not the server's UTC one.
function currentCapeTownPeriod() {
  const [year, month] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit' })
    .format(new Date()).split('-')
  return `${year}-${month}-01`
}

/** /protected/admin/invoicing: run invoicing by hand and record offline invoice payments. */
export default async function InvoicingPage() {
  const result = await getInvoicesForAdmin(); const invoices = 'invoices' in result ? result.invoices : []
  return <div className="space-y-6"><h1 className="text-3xl font-bold">Invoicing</h1><Card><CardHeader><CardTitle>Run monthly invoicing</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Invoices also run automatically at the start of the 25th each month. Running again for the same month puts any new charges on a separate supplementary invoice; invoices already sent never change.</p><ActionForm action={runInvoicesAction} submitLabel="Generate invoices" className="flex flex-wrap items-end gap-3"><div><Label htmlFor="period">Billing period</Label><Input id="period" name="period" type="date" defaultValue={currentCapeTownPeriod()}/></div></ActionForm></CardContent></Card>
    {invoices.map((invoice) => <Card key={invoice.id}><CardHeader><CardTitle>{invoice.invoice_number}</CardTitle><p className="text-sm text-muted-foreground">{invoice.payer?.full_name || invoice.payer?.email || 'Unknown payer'} - {new Date(invoice.period).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}</p></CardHeader><CardContent className="flex flex-wrap justify-between gap-3"><span>{formatRandsWithCents(invoice.total)} - {invoice.status}</span>{invoice.status !== 'paid' && <ActionForm action={recordManualPaymentAction} submitLabel="Record manual payment" className="space-y-2"><input type="hidden" name="invoice_id" value={invoice.id}/></ActionForm>}</CardContent></Card>)}</div>
}
