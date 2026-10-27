import { redirect } from 'next/navigation'
/** /protected/profile: old link; the profile form is on /protected now. */
export default async function ProfilePage() {
  redirect('/protected')
}
