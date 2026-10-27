import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { getHouseholdAdminData } from '@/lib/services/MemberService'

/**
 * /protected/admin/households: read-only list of household roles.
 * Dependents join a household when they accept a guardian's link request.
 * Moving responsibility goes through the audited family request workflow.
 */
export default async function HouseholdsAdminPage() {
  const result = await getHouseholdAdminData()
  if ('error' in result) return null
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Households</h1><p className="text-muted-foreground">Guardians link existing dependent accounts from Family accounts, and the dependent approves. Unlink and transfer requests are reviewed under <Link className="underline" href="/protected/admin/family-requests">Family requests</Link>. Profile and lesson history are always preserved.</p></div><div className="space-y-2">{result.memberships.map((m) => { const p=result.profiles.find((x)=>x.id===m.profile_id); return <Card key={m.profile_id}><CardContent className="pt-6">{p?.full_name || p?.email} - {m.household_role}</CardContent></Card>})}</div></div>
}
