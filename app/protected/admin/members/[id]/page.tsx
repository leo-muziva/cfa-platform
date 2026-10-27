import { notFound, redirect } from 'next/navigation'
import { getMemberEditDataForAdmin } from '@/lib/services/MemberService'
import { Badge } from '@/components/ui/badge'
import { MemberEditForm } from './member-edit-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { changeMembershipStatusAction } from '@/app/actions/platform'

/** /protected/admin/members/[id]: edit one member's profile, staff access and status. */
export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getMemberEditDataForAdmin(id)

  if ('error' in result) {
    if (result.error === 'Not authenticated') redirect('/auth/login')
    if (result.error === 'Member not found') notFound()
    redirect('/protected')
  }

  const { profile, membership } = result

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{profile.full_name || profile.email}</h1>
          <Badge variant={profile.is_active ? 'default' : 'outline'}>
            {profile.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          {profile.email} · joined {new Date(profile.created_at).toLocaleDateString('en-ZA')}
        </p>
      </div>

      <MemberEditForm profile={profile} />
      <Card><CardHeader><CardTitle>Membership lifecycle</CardTitle></CardHeader><CardContent>{membership ? <form action={changeMembershipStatusAction} className="flex flex-wrap items-center gap-3"><input type="hidden" name="profile_id" value={profile.id}/><Badge>{membership.status}</Badge><select name="status" defaultValue={membership.status} className="rounded-md border bg-background px-3 py-2"><option value="active">Active</option><option value="suspended">Suspended</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option></select><Button>Apply transition</Button></form> : <p>No approved membership.</p>}</CardContent></Card>
    </div>
  )
}
