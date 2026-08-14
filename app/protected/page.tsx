import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getCurrentAccountContext } from '@/lib/services/MemberService'
import { getLessonHistory } from '@/lib/services/PlatformService'
import { formatCapeTownLessonDate } from '@/lib/booking-calendar'

export default async function DashboardPage() {
  const context = await getCurrentAccountContext()
  if ('error' in context) redirect('/auth/login')
  const history = await getLessonHistory()
  const next = 'items' in history ? history.items.filter((i) => i.status === 'upcoming').sort((a,b) => a.starts_at.localeCompare(b.starts_at))[0] : null
  return (
    <div className="w-full space-y-8">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-slate-950 px-6 py-8 text-white sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/25 blur-3xl" />
        <p className="relative text-xs font-semibold uppercase tracking-[0.26em] text-white/55">CFA Member Portal</p>
        <h1 className="relative mt-3 font-serif text-4xl font-light tracking-tight sm:text-5xl">Welcome, {context.profile.full_name || context.profile.email}.</h1>
        <p className="relative mt-3 max-w-xl text-sm leading-6 text-white/65">Manage your fencing account, lessons, membership and household from one place.</p>
      </div>
      {!context.profile.profile_completed_at && <Card className="cfa-light-card"><CardHeader><CardTitle>Complete your account details</CardTitle></CardHeader><CardContent><p className="mb-4 text-muted-foreground">Add the required contact, emergency-contact and consent information.</p><Button asChild><Link href="/protected/complete-profile">Complete profile</Link></Button></CardContent></Card>}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="cfa-light-card"><CardHeader><CardTitle>Next lesson</CardTitle></CardHeader><CardContent>{next ? formatCapeTownLessonDate(next.starts_at) : 'No upcoming lessons.'}</CardContent></Card>
        {context.capabilities.isPayer && context.householdMembers.length > 1 && <Card className="cfa-light-card"><CardHeader><CardTitle>Household</CardTitle></CardHeader><CardContent>{context.householdMembers.length - 1} dependent(s)</CardContent></Card>}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild><Link href="/protected/book">Book a lesson</Link></Button>
        <Button variant="outline" asChild><Link href="/protected/membership-request">{context.profile.membership_status === 'guest' ? 'Request membership' : 'Manage membership'}</Link></Button>
        {context.capabilities.canSeeHouseholdMoney && <Button variant="outline" asChild><Link href="/protected/billing">View billing</Link></Button>}
      </div>
    </div>
  )
}
