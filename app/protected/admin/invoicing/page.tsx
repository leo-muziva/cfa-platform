import { ActionForm } from '@/components/portal/action-form'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { runInvoicesAction, recordManualPaymentAction, sendInvoiceAction, sendAllUnsentInvoicesAction, updateClubBillingSettingsAction } from '@/app/actions/platform'
import { getInvoicesForAdmin } from '@/lib/services/PlatformService'
import { getClubBillingSettingsForStaff } from '@/lib/services/invoice-document-service'
import { formatRandsWithCents } from '@/lib/money'
import type { ClubBillingSettings } from '@/types/domain'

// The billing month is CFA's Africa/Johannesburg month, not the server's UTC one.
function currentCapeTownPeriod() {
  const [year, month] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit' })
    .format(new Date()).split('-')
  return `${year}-${month}-01`
}

function sentLabel(sentAt: string) {
  return `Sent ${new Date(sentAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' })}`
}

const settingsFields: Array<{ name: keyof ClubBillingSettings; label: string }> = [
  { name: 'club_name', label: 'Club name' },
  { name: 'address', label: 'Address' },
  { name: 'email', label: 'Accounts email' },
  { name: 'bank_name', label: 'Bank' },
  { name: 'account_name', label: 'Account name' },
  { name: 'account_number', label: 'Account number' },
  { name: 'branch_code', label: 'Branch code' },
]

/** /protected/admin/invoicing: run invoicing, send invoice emails and PDFs, and record offline payments. */
export default async function InvoicingPage() {
  const [result, settingsResult] = await Promise.all([getInvoicesForAdmin(), getClubBillingSettingsForStaff()])
  const invoices = 'invoices' in result ? result.invoices : []
  const settings = 'settings' in settingsResult ? settingsResult.settings : null
  const unsentCount = invoices.filter((invoice) => !invoice.sent_at && invoice.status !== 'paid').length
  return <div className="space-y-6"><h1 className="text-3xl font-bold">Invoicing</h1>
    <Card><CardHeader><CardTitle>Run monthly invoicing</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Invoices also run automatically at the start of the 25th each month and are emailed to payers straight away. Invoices generated here are not emailed until you check them and press Send. Each payer gets one invoice per month: running again adds new charges to that month&apos;s invoice until it is sent. Once sent or paid, an invoice never changes, and later charges go on a new invoice.</p><ActionForm action={runInvoicesAction} submitLabel="Generate invoices" className="flex flex-wrap items-end gap-3"><div><Label htmlFor="period">Billing period</Label><Input id="period" name="period" type="date" defaultValue={currentCapeTownPeriod()}/></div></ActionForm></CardContent></Card>

    <Card><CardHeader><CardTitle>Send invoices</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">{unsentCount === 1 ? '1 unpaid invoice has' : `${unsentCount} unpaid invoices have`} not been emailed yet. Each email goes to the payer with the invoice PDF attached.</p>{unsentCount > 0 && <ActionForm action={sendAllUnsentInvoicesAction} submitLabel="Send all unsent invoices" className="space-y-2">{null}</ActionForm>}</CardContent></Card>

    {invoices.map((invoice) => <Card key={invoice.id}><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2"><span>{invoice.invoice_number}</span><Badge variant={invoice.sent_at ? 'secondary' : 'outline'}>{invoice.sent_at ? sentLabel(invoice.sent_at) : 'Not sent'}</Badge></CardTitle><p className="text-sm text-muted-foreground">{invoice.payer?.full_name || invoice.payer?.email || 'Unknown payer'} - {new Date(invoice.period).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}{invoice.generated_by === 'schedule' ? ' - monthly run' : ''}</p></CardHeader><CardContent className="flex flex-wrap items-start justify-between gap-3"><span>{formatRandsWithCents(invoice.total)} - {invoice.status}</span><div className="flex flex-wrap items-start gap-3"><a className="inline-flex h-10 items-center text-sm font-medium underline underline-offset-4" href={`/api/invoices/${invoice.id}/pdf`}>Download PDF<span className="sr-only"> for invoice {invoice.invoice_number}</span></a><ActionForm action={sendInvoiceAction} submitLabel={invoice.sent_at ? 'Resend email' : 'Send email'} className="space-y-2"><input type="hidden" name="invoice_id" value={invoice.id}/></ActionForm>{invoice.status !== 'paid' && <ActionForm action={recordManualPaymentAction} submitLabel="Record manual payment" className="space-y-2"><input type="hidden" name="invoice_id" value={invoice.id}/></ActionForm>}</div></CardContent></Card>)}

    <Card><CardHeader><CardTitle>Club billing details</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Printed on every invoice PDF. Payers use these bank details for EFT, with the invoice number as the reference.</p><ActionForm action={updateClubBillingSettingsAction} submitLabel="Save billing details" className="grid gap-3 sm:grid-cols-2">{settingsFields.map((field) => <div key={field.name} className="grid gap-1"><Label htmlFor={`billing-${field.name}`}>{field.label}</Label><Input id={`billing-${field.name}`} name={field.name} defaultValue={settings?.[field.name] ?? ''} required={field.name === 'club_name'}/></div>)}</ActionForm></CardContent></Card>
  </div>
}
