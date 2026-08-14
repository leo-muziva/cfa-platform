import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cancelMembershipAction, requestMembershipAction, resubmitMembershipAction } from '@/app/actions/platform'
import { ActionForm } from '@/components/portal/action-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { formatCapeTownLessonDate } from '@/lib/booking-calendar'
import { getCurrentAccountContext } from '@/lib/services/MemberService'
import { getLessonHistory, getMembershipRequestPageData } from '@/lib/services/PlatformService'
import { ProfileForm } from './profile/profile-form'

export default async function ProfileDashboardPage() {
  const [context, history, membershipData] = await Promise.all([
    getCurrentAccountContext(),
    getLessonHistory(),
    getMembershipRequestPageData(),
  ])

  if ('error' in context || 'error' in membershipData) {
    redirect('/auth/login?next=/protected')
  }

  const nextLesson = 'items' in history
    ? history.items
        .filter((item) => item.status === 'upcoming')
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]
    : null
  const changes = membershipData.requests.find((item) => item.status === 'changes_requested')
  const canApply =
    !membershipData.membership &&
    !membershipData.requests.some(
      (item) => item.status === 'pending' || item.status === 'changes_requested',
    )

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
          CFA Member Portal
        </p>
        <h1 className="font-serif text-4xl font-light tracking-tight text-slate-950 sm:text-5xl">
          My Profile
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Welcome, {context.profile.full_name || context.profile.email}. Manage your account and
          membership from one place.
        </p>
      </div>

      {!context.profile.profile_completed_at && (
        <Card className="cfa-light-card">
          <CardHeader>
            <CardTitle>Complete your account details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground">
              Add the required contact, emergency-contact and consent information.
            </p>
            <Button asChild>
              <Link href="/protected/complete-profile">Complete profile</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="cfa-light-card">
          <CardHeader>
            <CardTitle>Next lesson</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{nextLesson ? formatCapeTownLessonDate(nextLesson.starts_at) : 'No upcoming lessons.'}</p>
            <Button asChild variant="outline">
              <Link href="/protected/book">Book a lesson</Link>
            </Button>
          </CardContent>
        </Card>

        {context.capabilities.isPayer && context.householdMembers.length > 1 && (
          <Card className="cfa-light-card">
            <CardHeader>
              <CardTitle>Household</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>{context.householdMembers.length - 1} dependent(s)</p>
              <Button asChild variant="outline">
                <Link href="/protected/family#dependents">View family</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <ProfileForm profile={context.profile} />

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
    </div>
  )
}
