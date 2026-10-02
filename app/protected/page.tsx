import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MembershipPanel } from '@/components/portal/membership-panel'
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

      <MembershipPanel membershipData={membershipData} />
    </div>
  )
}
