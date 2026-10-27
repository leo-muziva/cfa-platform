import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getMemberEditDataForAdmin } from '@/lib/services/MemberService'
import { Badge } from '@/components/ui/badge'
import { MemberEditForm } from './member-edit-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { changeMembershipStatusAction } from '@/app/actions/platform'

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

  const { profile, membership, familyLinks, isOwnRecord } = result
  // read-only: who this member pays for, and who pays for them
  const dependents = familyLinks.filter((link) => link.guardian_id === profile.id)
  const guardians = familyLinks.filter((link) => link.dependent_id === profile.id)

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

      <MemberEditForm profile={profile} isOwnRecord={isOwnRecord} />
      <Card>
        <CardHeader><CardTitle>Family links</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          {dependents.length === 0 && guardians.length === 0 ? (
            <p className="text-muted-foreground">No linked dependents or guardian.</p>
          ) : null}
          {dependents.length > 0 ? (
            <div>
              <p className="font-medium">Linked dependents</p>
              <ul className="mt-1 space-y-1">
                {dependents.map((link) => (
                  <li key={link.id}>
                    <Link className="underline underline-offset-4" href={`/protected/admin/members/${link.dependent_id}`}>{link.dependent?.full_name || link.dependent?.email || 'Dependent'}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {guardians.length > 0 ? (
            <div>
              <p className="font-medium">Payer / guardian</p>
              <ul className="mt-1 space-y-1">
                {guardians.map((link) => (
                  <li key={link.id}>
                    <Link className="underline underline-offset-4" href={`/protected/admin/members/${link.guardian_id}`}>{link.guardian?.full_name || link.guardian?.email || 'Guardian'}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">Changes go through <Link className="underline" href="/protected/admin/family-requests">Family requests</Link>.</p>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Membership lifecycle</CardTitle></CardHeader><CardContent>{membership ? <form action={changeMembershipStatusAction} className="flex flex-wrap items-center gap-3"><input type="hidden" name="profile_id" value={profile.id}/><Badge>{membership.status}</Badge><select name="status" defaultValue={membership.status} className="rounded-md border bg-background px-3 py-2"><option value="active">Active</option><option value="suspended">Suspended</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option></select><Button>Apply transition</Button></form> : <p>No approved membership.</p>}</CardContent></Card>
    </div>
  )
}
