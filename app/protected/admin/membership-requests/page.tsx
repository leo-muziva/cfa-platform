import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { decideMembershipRequestAction } from '@/app/actions/platform'
import { getMembershipRequestsForAdmin } from '@/lib/services/PlatformService'

export default async function MembershipRequestsPage() {
  const result = await getMembershipRequestsForAdmin()
  const requests = 'requests' in result ? result.requests : []
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Membership requests</h1><p className="text-muted-foreground">Only approval changes an account from guest to member.</p></div>
    {requests.length === 0 ? <p>No membership requests.</p> : requests.map((request) => <Card key={request.id}><CardHeader><CardTitle className="flex justify-between"><span>{request.applicant?.full_name || request.applicant?.email}</span><Badge variant="secondary">{request.status}</Badge></CardTitle></CardHeader><CardContent className="flex items-center justify-between"><span>{request.membership_type?.name}</span>{request.status === 'pending' && <div className="flex gap-2"><form action={decideMembershipRequestAction}><input type="hidden" name="request_id" value={request.id}/><input type="hidden" name="decision" value="approved"/><Button type="submit">Approve</Button></form><form action={decideMembershipRequestAction}><input type="hidden" name="request_id" value={request.id}/><input type="hidden" name="decision" value="declined"/><Button type="submit" variant="outline">Decline</Button></form></div>}</CardContent></Card>)}</div>
}
