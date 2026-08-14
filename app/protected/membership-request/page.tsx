import { redirect } from 'next/navigation'
export default async function MembershipRequestPage() {
  redirect('/protected')
}
