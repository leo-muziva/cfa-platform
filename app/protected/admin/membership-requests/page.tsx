import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MembershipDecisionForm } from '@/components/portal/membership-decision-form'
import { MembershipPaymentActions } from '@/components/portal/membership-payment-actions'
import { getMembershipRequestsForAdmin } from '@/lib/services/PlatformService'
import type { AdminMembershipApplication, MembershipPaymentEmailStatus } from '@/types/domain'

const emailStatusLabels: Record<MembershipPaymentEmailStatus, string> = {
  sent: 'Payment email sent',
  failed: 'Payment email failed - resend it',
  not_configured: 'Email not configured - tell the payer directly',
}

// The response the applicant sees and the private staff notes.
function ReviewSummary({ item }: { item: AdminMembershipApplication }) {
  return (
    <div className="space-y-3 text-sm">
      <div><p className="font-medium">Response visible to applicant</p><p className="text-muted-foreground">{item.visible_response || 'No response recorded.'}</p></div>
      <div><p className="font-medium">Private admin notes</p><p className="text-muted-foreground">{item.private_notes || 'No private notes recorded.'}</p></div>
    </div>
  )
}

/** /protected/admin/membership-requests: review applications and track memberships awaiting payment. */
export default async function MembershipRequestsPage({ searchParams }: {
  searchParams: Promise<{ activated?: string; withdrawn?: string }>
}) {
  const { activated, withdrawn } = await searchParams
  const result = await getMembershipRequestsForAdmin(); const requests = 'requests' in result ? result.requests : []
  // Set by the record-payment and withdraw actions, whose card has moved list.
  const nameOf = (id: string | undefined) => {
    const item = id ? requests.find((request) => request.id === id) : undefined
    return item ? item.applicant?.full_name || item.applicant?.email || 'the applicant' : null
  }
  const activatedName = nameOf(activated)
  const withdrawnName = nameOf(withdrawn)
  const awaitingPayment = requests.filter((item) => item.status === 'awaiting_payment')
  const others = requests.filter((item) => item.status !== 'awaiting_payment')
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Membership applications</h1>
        <p className="text-muted-foreground">Approving an application emails the payer a link to pay. The membership becomes active once payment is confirmed.</p>
      </div>

      {activatedName && (
        <p role="status" className="rounded-md border border-green-600/40 bg-green-50 p-3 text-sm font-medium text-green-800 dark:bg-green-950/40 dark:text-green-300">
          Payment recorded for {activatedName}. The membership is now active.
        </p>
      )}
      {withdrawnName && (
        <p role="status" className="rounded-md border p-3 text-sm font-medium">
          Approval withdrawn for {withdrawnName}. They can apply again.
        </p>
      )}

      {awaitingPayment.length > 0 && (
        <section className="space-y-3" aria-labelledby="awaiting-payment-heading">
          <h2 id="awaiting-payment-heading" className="text-xl font-semibold">Approved - awaiting payment</h2>
          {awaitingPayment.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap justify-between gap-2">
                  <span>{item.applicant?.full_name || item.applicant?.email} - {item.membership_type?.name}</span>
                  <Badge>awaiting payment</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {item.payment_email_status ? emailStatusLabels[item.payment_email_status] : 'No payment email recorded'}
                </p>
                <MembershipPaymentActions applicationId={item.id} />
                <ReviewSummary item={item} />
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {others.map((item) => (
        <Card key={item.id}>
          <CardHeader><CardTitle className="flex justify-between"><span>{item.applicant?.full_name || item.applicant?.email} - {item.membership_type?.name}</span><Badge>{item.status}</Badge></CardTitle></CardHeader>
          <CardContent>{item.status === 'pending' ? <MembershipDecisionForm applicationId={item.id} privateNotes={item.private_notes} /> : <ReviewSummary item={item} />}</CardContent>
        </Card>
      ))}
    </div>
  )
}
