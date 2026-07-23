import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getMembersForAdmin } from '@/lib/services/MemberService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MemberListFilters, Profile } from '@/types/domain'

function AccountBadge({ profile }: { profile: Profile }) {
  return <Badge variant={profile.staff_type === 'admin' ? 'default' : profile.is_staff ? 'secondary' : 'outline'}>
    {profile.staff_type ?? profile.membership_status}
  </Badge>
}

/** Builds a members-list URL that keeps the active filters but swaps the page. */
function pageHref(filters: MemberListFilters, page: number): string {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.membershipStatus) params.set('membershipStatus', filters.membershipStatus)
  if (filters.staffType) params.set('staffType', filters.staffType)
  if (filters.status) params.set('status', filters.status)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `/protected/admin/members?${qs}` : '/protected/admin/members'
}

const selectClasses =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  // URL params can repeat (?role=a&role=b) — keep the first value of each.
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  )

  const result = await getMembersForAdmin(normalized)

  if ('error' in result) {
    if (result.error === 'Not authenticated') redirect('/auth/login')
    redirect('/protected')
  }

  const { page, filters } = result
  const hasFilters = Boolean(filters.search || filters.membershipStatus || filters.staffType || filters.status)
  const rangeStart = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1
  const rangeEnd = Math.min(page.page * page.pageSize, page.total)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage all academy members ({page.total})
          </p>
        </div>
        <Button asChild>
          <Link href="/protected/admin/members/new">Add member</Link>
        </Button>
      </div>

      <form method="GET" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
        <div className="grid gap-2">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            name="search"
            type="search"
            placeholder="Name or email"
            defaultValue={filters.search ?? ''}
            maxLength={100}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="membershipStatus">Membership</Label>
          <select id="membershipStatus" name="membershipStatus" defaultValue={filters.membershipStatus ?? ''} className={selectClasses}>
            <option value="">All accounts</option><option value="guest">Guest</option><option value="member">Member</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={filters.status ?? ''}
            className={selectClasses}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          {hasFilters && (
            <Button variant="outline" asChild>
              <Link href="/protected/admin/members">Clear</Link>
            </Button>
          )}
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>All Members</CardTitle>
          <CardDescription>
            {page.total === 0
              ? 'No members match'
              : `Showing ${rangeStart}–${rangeEnd} of ${page.total}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {page.items.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-8 text-center">
              {hasFilters
                ? 'No members match the current filters.'
                : 'No members yet. Members appear here after signing up.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-6 font-medium text-muted-foreground">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Membership</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Joined</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((profile) => (
                    <tr
                      key={profile.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-6 font-medium">
                        <Link
                          href={`/protected/admin/members/${profile.id}`}
                          className="hover:underline underline-offset-4"
                        >
                          {profile.full_name || profile.email}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{profile.email}</td>
                      <td className="py-3 px-4">
                        <AccountBadge profile={profile} />
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {profile.membership_type?.name ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(profile.created_at).toLocaleDateString('en-ZA')}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={profile.is_active ? 'default' : 'outline'}>
                          {profile.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {page.pageCount > 1 && (
        <nav aria-label="Members pagination" className="flex items-center justify-between text-sm">
          {page.page > 1 ? (
            <Button variant="outline" asChild>
              <Link href={pageHref(filters, page.page - 1)}>← Previous</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Page {page.page} of {page.pageCount}
          </span>
          {page.page < page.pageCount ? (
            <Button variant="outline" asChild>
              <Link href={pageHref(filters, page.page + 1)}>Next →</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  )
}
