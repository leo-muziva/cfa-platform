import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getCurrentAccountContext } from '@/lib/services/MemberService'
import { getLessonHistory } from '@/lib/services/PlatformService'

export default async function DashboardPage() {
  const context = await getCurrentAccountContext()
  if ('error' in context) redirect('/auth/login')
  const history = await getLessonHistory()
  const next = 'items' in history ? history.items.filter((i) => i.status === 'upcoming').sort((a,b) => a.starts_at.localeCompare(b.starts_at))[0] : null
  return (
    <div className="w-full space-y-6">
      <div><h1 className="text-3xl font-bold">My account</h1><p className="text-muted-foreground">Welcome, {context.profile.full_name || context.profile.email}.</p></div>
      {!context.profile.profile_completed_at && <Card><CardHeader><CardTitle>Complete your account details</CardTitle></CardHeader><CardContent><p className="mb-4 text-muted-foreground">Add the required contact, emergency-contact and consent information.</p><Button asChild><Link href="/protected/complete-profile">Complete profile</Link></Button></CardContent></Card>}
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Next lesson</CardTitle></CardHeader><CardContent>{next ? new Date(next.starts_at).toLocaleString('en-ZA') : 'No upcoming lessons.'}</CardContent></Card>
        {context.capabilities.isPayer && context.householdMembers.length > 1 && <Card><CardHeader><CardTitle>Household</CardTitle></CardHeader><CardContent>{context.householdMembers.length - 1} dependent(s)</CardContent></Card>}
      </div>
      <Button asChild><Link href="/protected/book">Book a lesson</Link></Button>
      <Button variant="outline" asChild className="ml-2">
        <Link href="/protected/membership-request">
          {context.profile.membership_status === 'guest' ? 'Request membership' : 'Manage membership'}
        </Link>
      </Button>
      {context.capabilities.canSeeHouseholdMoney && <Button variant="outline" asChild className="ml-2"><Link href="/protected/billing">View billing</Link></Button>}
    </div>
  )
}
