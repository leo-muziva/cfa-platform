import { cancelMembershipAction, requestMembershipAction, resubmitMembershipAction } from '@/app/actions/platform'
import { ActionForm } from '@/components/portal/action-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import type { getMembershipRequestPageData } from '@/lib/services/PlatformService'

type MembershipData = Exclude<Awaited<ReturnType<typeof getMembershipRequestPageData>>, { error: string }>

// Current membership, past applications and the apply form.
// Moved here from the profile page so the membership page can use it.
export function MembershipPanel({ membershipData }: { membershipData: MembershipData }) {
  const changes = membershipData.requests.find((item) => item.status === 'changes_requested')
  const canApply =
    !membershipData.membership &&
    !membershipData.requests.some(
      (item) => item.status === 'pending' || item.status === 'changes_requested',
    )

  return (
    <section className="space-y-6" aria-labelledby="membership-heading">
      <div>
        <h2 id="membership-heading" className="text-2xl font-semibold">
          Membership
        </h2>
        <p className="text-sm text-muted-foreground">
          Applications and memberships belong to this account only.
        </p>
      </div>

      <Card className="cfa-light-card">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>Current membership</span>
            <Badge>{membershipData.membership?.status ?? 'not a member yet'}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {membershipData.membership ? (
            membershipData.membership.membership_type?.name
          ) : (
            <div>
              <p>You are not a member yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                You can apply below. Your application and review status will appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {membershipData.membership?.status === 'active' && (
        <Card className="cfa-light-card">
          <CardHeader>
            <CardTitle>Cancel membership</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Cancellation is immediate. Existing invoices remain due and no refund is created
              automatically.
            </p>
            <form action={cancelMembershipAction}>
              <input type="hidden" name="confirm" value="yes" />
              <Button variant="outline">Confirm cancellation</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {membershipData.requests.map((item) => (
        <Card key={item.id} className="cfa-light-card">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {item.membership_type?.name} - version {item.version}
              </span>
              <Badge>{item.status}</Badge>
            </CardTitle>
          </CardHeader>
          {item.visible_response && (
            <CardContent>
              <strong>Reviewer response:</strong> {item.visible_response}
            </CardContent>
          )}
        </Card>
      ))}

      {(canApply || changes) && (
        <Card className="cfa-light-card">
          <CardHeader>
            <CardTitle>{changes ? 'Amend and resubmit' : 'Apply for membership'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm
              action={changes ? resubmitMembershipAction : requestMembershipAction}
              submitLabel={changes ? 'Resubmit' : 'Submit application'}
            >
              {changes && (
                <input type="hidden" name="application_id" value={changes.id} />
              )}
              <div>
                <Label htmlFor="membership_type_id">Membership type</Label>
                <select
                  id="membership_type_id"
                  name="membership_type_id"
                  defaultValue={changes?.membership_type_id}
                  className="w-full rounded-md border bg-background px-3 py-2"
                >
                  {membershipData.membershipTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} - R{Number(type.price).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
