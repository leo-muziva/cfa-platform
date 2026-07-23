import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ActionForm } from '@/components/portal/action-form'
import { requestMembershipAction } from '@/app/actions/platform'
import { getMembershipRequestPageData } from '@/lib/services/PlatformService'

export default async function MembershipRequestPage() {
  const data = await getMembershipRequestPageData()
  if ('error' in data) redirect('/auth/login')
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Request membership</h1><p className="text-muted-foreground">Your account remains a guest until an administrator approves the request.</p></div>
    {data.requests.map((request) => <Card key={request.id}><CardHeader><CardTitle className="flex justify-between"><span>{request.membership_type?.name}</span><Badge>{request.status}</Badge></CardTitle></CardHeader></Card>)}
    {data.profile.membership_status === 'guest' && !data.requests.some((r) => r.status === 'pending') && <Card><CardHeader><CardTitle>New request</CardTitle></CardHeader><CardContent><ActionForm action={requestMembershipAction} submitLabel="Submit request"><div><Label htmlFor="membership_type_id">Membership type</Label><select id="membership_type_id" name="membership_type_id" className="w-full rounded-md border bg-background px-3 py-2">{data.membershipTypes.map((type) => <option key={type.id} value={type.id}>{type.name} - R{Number(type.price).toFixed(2)}</option>)}</select></div></ActionForm></CardContent></Card>}
  </div>
}
