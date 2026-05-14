import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/services/MemberService'
import { ProfileForm } from './profile-form'

export default async function ProfilePage() {
  const profile = await getCurrentProfile()

  if (!profile) {
    redirect('/auth/login')
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">
          View and update your account information
        </p>
      </div>
      <ProfileForm profile={profile} />
    </div>
  )
}
