import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MembershipDecisionForm } from '@/components/portal/membership-decision-form'
import { getMembershipRequestsForAdmin } from '@/lib/services/PlatformService'

export default async function MembershipRequestsPage() {
  const result = await getMembershipRequestsForAdmin(); const requests = 'requests' in result ? result.requests : []
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Membership applications</h1><p className="text-muted-foreground">Approval atomically activates membership and creates the initial charges.</p></div>{requests.map((item) => <Card key={item.id}><CardHeader><CardTitle className="flex justify-between"><span>{item.applicant?.full_name || item.applicant?.email} - {item.membership_type?.name}</span><Badge>{item.status}</Badge></CardTitle></CardHeader><CardContent>{item.status === 'pending' ? <MembershipDecisionForm applicationId={item.id} privateNotes={item.private_notes} /> : <div className="space-y-3 text-sm"><div><p className="font-medium">Response visible to applicant</p><p className="text-muted-foreground">{item.visible_response || 'No response recorded.'}</p></div><div><p className="font-medium">Private admin notes</p><p className="text-muted-foreground">{item.private_notes || 'No private notes recorded.'}</p></div></div>}</CardContent></Card>)}</div>
}
