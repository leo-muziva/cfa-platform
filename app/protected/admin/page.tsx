import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getMemberStatsForAdmin } from '@/lib/services/MemberService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-4xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint && (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      )}
    </Card>
  )
}

export default async function AdminDashboardPage() {
  const result = await getMemberStatsForAdmin()

  if ('error' in result) {
    if (result.error === 'Not authenticated') redirect('/auth/login')
    redirect('/protected')
  }

  const { stats } = result

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cape Fencing Academy at a glance
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total members" value={stats.total} />
        <StatCard label="Active members" value={stats.active} hint={`${stats.inactive} inactive`} />
        <StatCard
          label="Without membership type"
          value={stats.unassigned}
          hint="Members not yet assigned a fee tier"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By account type</CardTitle>
            <CardDescription>Everyone registered on the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-2">
              {[['Guests', stats.guests], ['Members', stats.members], ['Admins', stats.admins], ['Coaches', stats.coaches]].map(([label, count]) => <div key={String(label)} className="flex items-center justify-between text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{count}</dd></div>)}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By membership type</CardTitle>
            <CardDescription>Distribution across fee tiers</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.byMembershipType).length === 0 ? (
              <p className="text-sm text-muted-foreground">No memberships assigned yet.</p>
            ) : (
              <dl className="flex flex-col gap-2">
                {Object.entries(stats.byMembershipType).map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">{name}</dt>
                    <dd className="font-medium tabular-nums">{count}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <Link
          href="/protected/admin/members"
          className="text-sm underline underline-offset-4 hover:text-foreground text-muted-foreground"
        >
          Manage members →
        </Link>
      </div>
    </div>
  )
}
