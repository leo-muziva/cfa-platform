import { redirect } from 'next/navigation'
import { cancelMembershipAction, requestMembershipAction, resubmitMembershipAction } from '@/app/actions/platform'
import { ActionForm } from '@/components/portal/action-form'
import { CheckoutButton } from '@/components/payments/checkout-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { formatZar } from '@/lib/money'
import { getMembershipRequestPageData } from '@/lib/services/PlatformService'
import type { MembershipApplicationStatus } from '@/types/domain'

const applicationStatusLabels: Record<MembershipApplicationStatus, string> = {
  pending: 'Waiting for review',
  changes_requested: 'Changes requested',
  awaiting_payment: 'Approved - payment due',
  rejected: 'Not approved',
  approved: 'Approved and paid',
}

export default async function MembershipPage() {
  const data = await getMembershipRequestPageData()
  if ('error' in data) redirect('/auth/login?next=/protected/membership')

  const changes = data.requests.find((item) => item.status === 'changes_requested')
  const awaitingPayment = data.requests.find((item) => item.status === 'awaiting_payment')
  const pendingReview = data.requests.some((item) => item.status === 'pending')
  const isActive = data.membership?.status === 'active'
  const canApply = !isActive && !changes && !awaitingPayment && !pendingReview
  const currentStatus = isActive
    ? 'Active'
    : awaitingPayment ? 'Approved - payment due'
      : pendingReview ? 'Waiting for review'
        : changes ? 'Changes requested'
          : data.membership?.status ?? 'Not a member yet'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground">
          CFA Member Portal
        </p>
        <h1 className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">
          Membership
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apply for membership and follow your application. Membership starts once it is approved and paid.
        </p>
      </div>

      <Card className="cfa-light-card">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>Current membership</span>
            <Badge>{currentStatus}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isActive ? (
            <p>{data.membership?.membership_type?.name}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              You are not an active member yet. Your application and payment status appear on this page.
            </p>
          )}
        </CardContent>
      </Card>

      {awaitingPayment && (
        <Card className="cfa-light-card" aria-labelledby="payment-due-heading">
          <CardHeader>
            <CardTitle id="payment-due-heading">Your application is approved</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.ownPaymentDue ? (
              <>
                <p>Pay for your {data.ownPaymentDue.membershipName} membership to activate it.</p>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between gap-4"><dt>Membership</dt><dd>{formatZar(data.ownPaymentDue.membershipCents)}</dd></div>
                  {data.ownPaymentDue.joiningFeeCents !== '0' && (
                    <div className="flex justify-between gap-4"><dt>Joining fee</dt><dd>{formatZar(data.ownPaymentDue.joiningFeeCents)}</dd></div>
                  )}
                  <div className="flex justify-between gap-4 border-t pt-1 font-semibold"><dt>Total due</dt><dd>{formatZar(data.ownPaymentDue.totalCents)}</dd></div>
                </dl>
                {data.onlinePaymentsAvailable ? (
                  <CheckoutButton membershipApplicationId={data.ownPaymentDue.applicationId} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Online payments are unavailable right now. Pay CFA by EFT or cash and staff will record it.
                  </p>
                )}
              </>
            ) : (
              <p>
                Your membership will start once your guardian completes the payment. They have been asked to pay
                from their account.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {data.dependentPaymentsDue.length > 0 && (
        <section className="space-y-3" aria-labelledby="dependent-payments-heading">
          <h2 id="dependent-payments-heading" className="text-xl font-semibold">Memberships you pay for</h2>
          {data.dependentPaymentsDue.map((item) => (
            <Card key={item.applicationId} className="cfa-light-card">
              <CardContent className="space-y-1 pt-6">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span><span className="font-medium">{item.applicantName}</span> - {item.membershipName}</span>
                  <span className="font-semibold">{formatZar(item.totalCents)}</span>
                </div>
                {data.onlinePaymentsAvailable && <CheckoutButton membershipApplicationId={item.applicationId} />}
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {isActive && (
        <Card className="cfa-light-card">
          <CardHeader>
            <CardTitle>Cancel membership</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Cancellation is immediate. Existing invoices remain due and no refund is created automatically.
            </p>
            <form action={cancelMembershipAction}>
              <input type="hidden" name="confirm" value="yes" />
              <Button variant="outline">Confirm cancellation</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {(canApply || changes) && (
        <Card className="cfa-light-card">
          <CardHeader>
            <CardTitle>{changes ? 'Amend and resubmit' : 'Apply for membership'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Staff review every application. Payment is only requested after approval.
            </p>
            <ActionForm
              action={changes ? resubmitMembershipAction : requestMembershipAction}
              submitLabel={changes ? 'Resubmit' : 'Submit application'}
            >
              {changes && <input type="hidden" name="application_id" value={changes.id} />}
              <div>
                <Label htmlFor="membership_type_id">Membership type</Label>
                <select
                  id="membership_type_id"
                  name="membership_type_id"
                  defaultValue={changes?.membership_type_id}
                  className="w-full rounded-md border bg-background px-3 py-2"
                >
                  {data.membershipTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.priceLabel ? `${type.name} - ${type.priceLabel}` : type.name}
                    </option>
                  ))}
                </select>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      )}

      {data.requests.length > 0 && (
        <section className="space-y-3" aria-labelledby="applications-heading">
          <h2 id="applications-heading" className="text-xl font-semibold">Your applications</h2>
          {data.requests.map((item) => (
            <Card key={item.id} className="cfa-light-card">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                  <span>{item.membership_type?.name} - version {item.version}</span>
                  <Badge>{applicationStatusLabels[item.status]}</Badge>
                </CardTitle>
              </CardHeader>
              {item.visible_response && (
                <CardContent>
                  <strong>Reviewer response:</strong> {item.visible_response}
                </CardContent>
              )}
            </Card>
          ))}
        </section>
      )}
    </div>
  )
}
