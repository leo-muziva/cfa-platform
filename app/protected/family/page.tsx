import { redirect } from 'next/navigation'
import { ActionForm } from '@/components/portal/action-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { answerFamilyLinkAction, endFamilyLinkAction, requestFamilyLinkAction } from '@/app/actions/platform'
import { getFamilyAccountsPageData } from '@/lib/services/PlatformService'

export default async function FamilyAccountsPage() {
  const data = await getFamilyAccountsPageData()
  if ('error' in data) redirect('/auth/login?next=/protected/family')
  const incoming = data.links.filter((link) => link.dependent_id === data.profile.id && link.status === 'pending')
  const relationships = data.links.filter((link) => link.status !== 'pending')
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Family accounts</h1><p className="text-muted-foreground">Family relationships and billing begin only after the existing dependent account approves the link.</p></div>
    <Card><CardHeader><CardTitle>Link an existing dependent account</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">The dependent must create their own CFA account first. Enter the email address they used, then they can approve or reject the request from their Family Accounts page.</p><ActionForm action={requestFamilyLinkAction} submitLabel="Request family link"><div><Label htmlFor="email">Dependent account email</Label><Input id="email" name="email" type="email" required /></div></ActionForm><p className="mt-3 text-sm text-muted-foreground">For privacy, the response is the same whether or not an account exists.</p></CardContent></Card>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Incoming requests</h2>{incoming.length === 0 ? <p>No incoming requests.</p> : incoming.map((link) => <Card key={link.id}><CardContent className="flex items-center justify-between pt-6"><span>{link.guardian?.full_name || link.guardian?.email}</span><div className="flex gap-2"><form action={answerFamilyLinkAction}><input type="hidden" name="link_id" value={link.id}/><input type="hidden" name="response" value="accept"/><Button>Accept</Button></form><form action={answerFamilyLinkAction}><input type="hidden" name="link_id" value={link.id}/><input type="hidden" name="response" value="reject"/><Button variant="outline">Reject</Button></form></div></CardContent></Card>)}</section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Relationships</h2>{relationships.length === 0 ? <p className="text-muted-foreground">No family relationships apply to this account.</p> : relationships.map((link) => <Card key={link.id}><CardContent className="flex items-center justify-between pt-6"><span>{link.guardian_id === data.profile.id ? link.dependent?.full_name || link.dependent?.email : link.guardian?.full_name || link.guardian?.email} - {link.status}</span>{link.status === 'active' && <form action={endFamilyLinkAction}><input type="hidden" name="link_id" value={link.id}/><Button variant="outline">End relationship</Button></form>}</CardContent></Card>)}</section>
  </div>
}
