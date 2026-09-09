import { redirect } from 'next/navigation'
import { getInviteFormDataForAdmin } from '@/lib/services/MemberService'
import { InviteMemberForm } from './invite-member-form'

export default async function NewMemberPage() {
  const result = await getInviteFormDataForAdmin()

  if ('error' in result) {
    if (result.error === 'Not authenticated') redirect('/auth/login')
    redirect('/protected')
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Add member</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Invite someone to join Cape Fencing Academy
        </p>
      </div>

      <InviteMemberForm />
    </div>
  )
}
