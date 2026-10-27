import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/services/MemberService'

/** /family: public shortcut to the family accounts page, via login when signed out. */
export default async function PublicFamilyAccountsPage() {
  if (await getCurrentProfile()) redirect('/protected/family')
  redirect('/auth/login?next=%2Fprotected%2Ffamily')
}
