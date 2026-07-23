import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getInvoicesForAdmin } from '@/lib/services/PlatformService'

export default async function PaymentsPage() {
  const result = await getInvoicesForAdmin(); const invoices = 'invoices' in result ? result.invoices : []
  const outstanding = invoices.filter((i) => i.status !== 'paid')
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Payments and arrears</h1><p className="text-muted-foreground">No booking suspension or late fees are applied while arrears policy is pending.</p></div><Card><CardHeader><CardTitle>Outstanding invoices</CardTitle></CardHeader><CardContent>{outstanding.length}</CardContent></Card>{outstanding.map((invoice) => <Card key={invoice.id}><CardContent className="pt-6">{invoice.invoice_number} - R{Number(invoice.total).toFixed(2)}</CardContent></Card>)}</div>
}
