import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ActionForm } from '@/components/portal/action-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { answerFamilyLinkAction, requestFamilyLinkAction } from '@/app/actions/platform'
import { getFamilyAccountsPageData } from '@/lib/services/PlatformService'
import { getCurrentAccountContext } from '@/lib/services/MemberService'

/** /protected/family: request, accept and end guardian/dependent links. */
export default async function FamilyAccountsPage() {
  const [data, context] = await Promise.all([
    getFamilyAccountsPageData(),
    getCurrentAccountContext(),
  ])
  if ('error' in data || 'error' in context) redirect('/auth/login?next=/protected/family')
  const incoming = data.links.filter((link) => link.dependent_id === data.profile.id && link.status === 'pending')
  const outgoing = data.links.filter((link) => link.guardian_id === data.profile.id && link.status === 'pending')
  const relationships = data.links.filter((link) => link.status !== 'pending')
  const dependents = data.links.filter((link) => link.guardian_id === data.profile.id && link.status === 'active')
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Family accounts</h1><p className="text-muted-foreground">Family relationships and billing begin only after the existing dependent account approves the link.</p></div>
    <p><Link className="underline" href="/protected/family/changes">Responsibility requests and transfers</Link></p>
    <Card><CardHeader><CardTitle>Link an existing dependent account</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">The dependent must create their own CFA account first. Enter the email address they used, then they can approve or reject the request from their Family Accounts page.</p><ActionForm action={requestFamilyLinkAction} submitLabel="Request family link"><div><Label htmlFor="email">Dependent account email</Label><Input id="email" name="email" type="email" required /></div></ActionForm><p className="mt-3 text-sm text-muted-foreground">For privacy, the response is the same whether or not an account exists.</p></CardContent></Card>
    <section id="dependents" className="scroll-mt-24 space-y-3"><h2 className="text-xl font-semibold">Dependents</h2>{dependents.length === 0 ? <p className="text-muted-foreground">No dependents belong to this household.</p> : dependents.map((member) => <Card key={member.id}><CardContent className="pt-6"><p className="font-medium">{member.dependent?.full_name || member.dependent?.email}</p><p className="mt-1 text-sm text-muted-foreground">Account status: Linked</p></CardContent></Card>)}</section>
    {outgoing.length > 0 && <section className="space-y-3"><h2 className="text-xl font-semibold">Sent requests</h2>{outgoing.map((link) => <Card key={link.id}><CardContent className="pt-6"><p className="font-medium">{link.dependent?.full_name || link.dependent?.email}</p><p className="mt-1 text-sm text-muted-foreground">Waiting for them to accept from their Family page.</p></CardContent></Card>)}</section>}
    <section className="space-y-3"><h2 className="text-xl font-semibold">Incoming requests</h2>{incoming.length === 0 ? <p>No incoming requests.</p> : incoming.map((link) => <Card key={link.id}><CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6"><div><p className="font-medium">{link.guardian?.full_name || link.guardian?.email || 'Unknown account'}</p>{link.guardian?.full_name && link.guardian.email && <p className="text-sm text-muted-foreground">{link.guardian.email}</p>}<p className="mt-1 text-sm text-muted-foreground">Wants to become your guardian and payer. Accepting lets them book lessons for you and pay your fees. Reject if you do not know this person.</p></div><div className="flex gap-2"><form action={answerFamilyLinkAction}><input type="hidden" name="link_id" value={link.id}/><input type="hidden" name="response" value="accept"/><Button>Accept</Button></form><form action={answerFamilyLinkAction}><input type="hidden" name="link_id" value={link.id}/><input type="hidden" name="response" value="reject"/><Button variant="outline">Reject</Button></form></div></CardContent></Card>)}</section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Relationships</h2>{relationships.length === 0 ? <p className="text-muted-foreground">No family relationships apply to this account.</p> : relationships.map((link) => <Card key={link.id}><CardContent className="flex items-center justify-between pt-6"><span>{link.guardian_id === data.profile.id ? link.dependent?.full_name || link.dependent?.email : link.guardian?.full_name || link.guardian?.email} - {link.status}</span>{link.status === 'active' && <Link className="underline" href="/protected/family/changes">Request unlink or transfer</Link>}</CardContent></Card>)}</section>
  </div>
}
