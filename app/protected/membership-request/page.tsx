import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ActionForm } from '@/components/portal/action-form'
import { cancelMembershipAction, requestMembershipAction, resubmitMembershipAction } from '@/app/actions/platform'
import { getMembershipRequestPageData } from '@/lib/services/PlatformService'

export default async function MembershipRequestPage() {
  const data = await getMembershipRequestPageData()
  if ('error' in data) redirect('/auth/login?next=/protected/membership-request')
  const changes = data.requests.find((item) => item.status === 'changes_requested')
  const canApply = !data.membership && !data.requests.some((item) => item.status === 'pending' || item.status === 'changes_requested')
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Membership</h1><p className="text-muted-foreground">Applications and memberships belong to this account only.</p></div>
    <Card><CardHeader><CardTitle className="flex justify-between"><span>Current membership</span><Badge>{data.membership?.status ?? 'not a member yet'}</Badge></CardTitle></CardHeader><CardContent>{data.membership ? data.membership.membership_type?.name : <div><p>You are not a member yet.</p><p className="mt-2 text-sm text-muted-foreground">You can request membership below. Your application and its review status will appear here.</p></div>}</CardContent></Card>
    {data.membership?.status === 'active' && <Card><CardHeader><CardTitle>Cancel membership</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">Cancellation is immediate. Existing invoices remain due and no refund is created automatically.</p><form action={cancelMembershipAction}><input type="hidden" name="confirm" value="yes"/><Button variant="outline">Confirm cancellation</Button></form></CardContent></Card>}
    {data.requests.map((item) => <Card key={item.id}><CardHeader><CardTitle className="flex justify-between"><span>{item.membership_type?.name} - version {item.version}</span><Badge>{item.status}</Badge></CardTitle></CardHeader>{item.visible_response && <CardContent><strong>Reviewer response:</strong> {item.visible_response}</CardContent>}</Card>)}
    {(canApply || changes) && <Card><CardHeader><CardTitle>{changes ? 'Amend and resubmit' : 'Apply'}</CardTitle></CardHeader><CardContent><ActionForm action={changes ? resubmitMembershipAction : requestMembershipAction} submitLabel={changes ? 'Resubmit' : 'Submit application'}>{changes && <input type="hidden" name="application_id" value={changes.id}/>}<div><Label htmlFor="membership_type_id">Membership type</Label><select id="membership_type_id" name="membership_type_id" defaultValue={changes?.membership_type_id} className="w-full rounded-md border bg-background px-3 py-2">{data.membershipTypes.map((type) => <option key={type.id} value={type.id}>{type.name} - R{Number(type.price).toFixed(2)}</option>)}</select></div></ActionForm></CardContent></Card>}
  </div>
}
