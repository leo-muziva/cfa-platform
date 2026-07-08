import { redirect } from 'next/navigation'
import { getMembersForAdmin } from '@/lib/services/MemberService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Profile } from '@/types/domain'

function RoleBadge({ role }: { role: Profile['role'] }) {
  const variants: Record<Profile['role'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
    admin: 'default',
    coach: 'secondary',
    fencer: 'outline',
    guardian: 'outline',
  }
  return <Badge variant={variants[role]}>{role}</Badge>
}

export default async function MembersPage() {
  const result = await getMembersForAdmin()

  if ('error' in result) {
    if (result.error === 'Not authenticated') redirect('/auth/login')
    redirect('/protected')
  }

  const { profiles } = result

  return (
    <div className="flex-1 w-full flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Members</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage all academy members ({profiles.length})
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Members</CardTitle>
          <CardDescription>Complete list of registered CFA members</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-8 text-center">
              No members yet. Members appear here after signing up.
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
                  {profiles.map((profile) => (
                    <tr key={profile.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-6 font-medium">{profile.full_name ?? '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{profile.email}</td>
                      <td className="py-3 px-4">
                        <RoleBadge role={profile.role} />
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
    </div>
  )
}
