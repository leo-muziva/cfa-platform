import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentAccountContext } from '@/lib/services/MemberService'
import { getMembershipRequestPageData } from '@/lib/services/PlatformService'
import { ProfileForm } from './profile/profile-form'

export default async function ProfileDashboardPage() {
  const [context, membershipData] = await Promise.all([
    getCurrentAccountContext(),
    getMembershipRequestPageData(),
  ])

  if ('error' in context || 'error' in membershipData) {
    redirect('/auth/login?next=/protected')
  }

  // One line about membership here. Everything else is on the membership page.
  const membership = membershipData.membership
  const openRequest = membershipData.requests.find(
    (item) => item.status === 'pending' || item.status === 'changes_requested' || item.status === 'awaiting_payment',
  )
  const membershipLine = membership
    ? membership.membership_type?.name ?? 'Membership'
    : openRequest?.status === 'awaiting_payment'
      ? 'Your application is approved and waiting for payment'
      : openRequest?.status === 'changes_requested'
        ? 'Your application needs changes'
        : openRequest
          ? 'Your application is waiting for review'
          : 'You are not a member yet'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground">
          CFA Member Portal
        </p>
        <h1 className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">
          My Profile
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
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


      <ProfileForm profile={context.profile} />

      {/* Membership status and applying moved to /protected/membership. */}
      <Card className="cfa-light-card">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>Membership</span>
            <Badge>{membership?.status ?? openRequest?.status ?? 'not a member yet'}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{membershipLine}</p>
          <Button asChild variant="outline">
            <Link href="/protected/membership">Manage membership</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
