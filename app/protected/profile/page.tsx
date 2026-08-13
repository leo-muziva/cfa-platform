import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/services/MemberService'
import { ProfileForm } from './profile-form'

export default async function ProfilePage() {
  const profile = await getCurrentProfile()

  if (!profile) {
    redirect('/auth/login')
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Member Portal</p>
        <h1 className="font-serif text-4xl font-light tracking-tight text-slate-950 sm:text-5xl">My Profile</h1>
        <p className="mt-2 text-sm text-slate-600">
          View and update your account information
        </p>
      </div>
      <ProfileForm profile={profile} />
    </div>
  )
}
