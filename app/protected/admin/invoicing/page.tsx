import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { runInvoicesAction, recordManualPaymentAction } from '@/app/actions/platform'
import { getInvoicesForAdmin } from '@/lib/services/PlatformService'

export default async function InvoicingPage() {
  const result = await getInvoicesForAdmin(); const invoices = 'invoices' in result ? result.invoices : []
  const currentPeriod = new Date().toISOString().slice(0, 7) + '-01'
  return <div className="space-y-6"><h1 className="text-3xl font-bold">Invoicing</h1><Card><CardHeader><CardTitle>Run monthly invoicing</CardTitle></CardHeader><CardContent><form action={runInvoicesAction} className="flex items-end gap-3"><div><Label htmlFor="period">Billing period</Label><Input id="period" name="period" type="date" defaultValue={currentPeriod}/></div><Button type="submit">Generate invoices</Button></form></CardContent></Card>
    {invoices.map((invoice) => <Card key={invoice.id}><CardHeader><CardTitle>{invoice.invoice_number}</CardTitle></CardHeader><CardContent className="flex justify-between"><span>R{Number(invoice.total).toFixed(2)} - {invoice.status}</span>{invoice.status !== 'paid' && <form action={recordManualPaymentAction}><input type="hidden" name="invoice_id" value={invoice.id}/><Button type="submit" variant="outline">Record manual payment</Button></form>}</CardContent></Card>)}</div>
}
