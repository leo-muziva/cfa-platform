import { getCurrentProfile } from '@/lib/services/MemberService'
import { CompleteProfileForm } from './complete-profile-form'

// Prefills from the saved profile: the name given at sign-up, and anything
// already saved if the page is opened again.
export default async function CompleteProfilePage() {
  const profile = await getCurrentProfile()
  return (
    <CompleteProfileForm
      defaults={{
        full_name: profile?.full_name ?? '',
        phone: profile?.phone ?? null,
        date_of_birth: profile?.date_of_birth ?? null,
        emergency_contact_name: profile?.emergency_contact_name ?? '',
        emergency_contact_phone: profile?.emergency_contact_phone ?? null,
        terms_accepted: Boolean(profile?.terms_accepted_at),
        privacy_accepted: Boolean(profile?.privacy_accepted_at),
      }}
    />
  )
}
