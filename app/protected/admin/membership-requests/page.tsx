import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { decideMembershipRequestAction } from '@/app/actions/platform'
import { getMembershipRequestsForAdmin } from '@/lib/services/PlatformService'

export default async function MembershipRequestsPage() {
  const result = await getMembershipRequestsForAdmin(); const requests = 'requests' in result ? result.requests : []
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Membership applications</h1><p className="text-muted-foreground">Approval atomically activates membership and creates the initial charges.</p></div>{requests.map((item) => <Card key={item.id}><CardHeader><CardTitle className="flex justify-between"><span>{item.applicant?.full_name || item.applicant?.email} - {item.membership_type?.name}</span><Badge>{item.status}</Badge></CardTitle></CardHeader>{item.status === 'pending' && <CardContent><form action={decideMembershipRequestAction} className="space-y-4"><input type="hidden" name="application_id" value={item.id}/><div><Label htmlFor={`response-${item.id}`}>Response visible to applicant</Label><textarea id={`response-${item.id}`} name="visible_response" className="min-h-20 w-full rounded-md border bg-background p-3"/></div><div><Label htmlFor={`notes-${item.id}`}>Private admin notes</Label><textarea id={`notes-${item.id}`} name="private_notes" className="min-h-20 w-full rounded-md border bg-background p-3"/></div><div className="flex gap-2"><Button name="decision" value="approve">Approve</Button><Button name="decision" value="request_changes" variant="outline">Request changes</Button><Button name="decision" value="reject" variant="outline">Reject</Button></div></form></CardContent>}</Card>)}</div>
}
