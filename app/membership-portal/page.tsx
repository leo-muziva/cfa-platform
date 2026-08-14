import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/services/MemberService'

export default async function PublicMembershipPortalPage() {
  if (await getCurrentProfile()) redirect('/protected')
  redirect('/auth/login?next=%2Fprotected')
}
