import { notFound, redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayerBilling } from '@/lib/services/PlatformService'

export default async function BillingPage() {
  const billing = await getPayerBilling()
  if ('error' in billing) { if (billing.error === 'Not authenticated') redirect('/auth/login'); notFound() }
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Billing and invoices</h1><p className="text-muted-foreground">Household financial information is visible only to the payer.</p></div>
    <Card><CardHeader><CardTitle>Current balance</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">R{billing.balance.toFixed(2)}</CardContent></Card>
    {!billing.providerAvailable && <Card><CardHeader><CardTitle>Online payments unavailable</CardTitle></CardHeader><CardContent>A payment provider has not been selected. Use the invoice number as the reference for a manual bank transfer.</CardContent></Card>}
    <section className="space-y-3"><h2 className="text-xl font-semibold">Invoices</h2>{billing.invoices.length === 0 ? <p>No invoices yet.</p> : billing.invoices.map((invoice) => <Card key={invoice.id}><CardHeader><CardTitle className="flex justify-between"><span>{invoice.invoice_number}</span><Badge>{invoice.status}</Badge></CardTitle></CardHeader><CardContent>R{Number(invoice.total).toFixed(2)}</CardContent></Card>)}</section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Receipts</h2>{billing.receipts.length === 0 ? <p>No receipts yet.</p> : billing.receipts.map((receipt) => <Card key={receipt.id}><CardHeader><CardTitle>{receipt.receipt_number}</CardTitle></CardHeader><CardContent>R{Number(receipt.amount).toFixed(2)}</CardContent></Card>)}</section>
  </div>
}
