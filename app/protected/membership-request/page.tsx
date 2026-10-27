import { redirect } from 'next/navigation'
/** /protected/membership-request: old link, now the membership page. */
export default async function MembershipRequestPage() {
  redirect('/protected/membership')
}
