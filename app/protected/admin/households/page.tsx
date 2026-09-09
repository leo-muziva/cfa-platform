import { attachDependentAction } from '@/app/actions/admin-members'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { getHouseholdAdminData } from '@/lib/services/MemberService'

const selectClasses = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
export default async function HouseholdsAdminPage() {
  const result = await getHouseholdAdminData()
  if ('error' in result) return null
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Households</h1><p className="text-muted-foreground">Attach a person to one adult payer. Existing profile and lesson history are preserved.</p></div><Card><CardHeader><CardTitle>Attach dependent</CardTitle></CardHeader><CardContent><form action={attachDependentAction} className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="profile_id">Dependent</Label><select id="profile_id" name="profile_id" className={selectClasses}>{result.profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</select></div><div><Label htmlFor="payer_id">Payer</Label><select id="payer_id" name="payer_id" className={selectClasses}>{result.profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</select></div><Button type="submit" className="w-fit">Attach dependent</Button></form></CardContent></Card><div className="space-y-2">{result.memberships.map((m) => { const p=result.profiles.find((x)=>x.id===m.profile_id); return <Card key={m.profile_id}><CardContent className="pt-6">{p?.full_name || p?.email} - {m.household_role}</CardContent></Card>})}</div></div>
}
