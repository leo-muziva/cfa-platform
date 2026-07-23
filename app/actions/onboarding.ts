'use server'
import { revalidatePath } from 'next/cache'
import { completeCurrentProfile } from '@/lib/services/MemberService'

export type OnboardingState = { error?: string; success?: string }
export async function completeProfileAction(_: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const result = await completeCurrentProfile({
    full_name: formData.get('full_name'), phone: formData.get('phone'), date_of_birth: formData.get('date_of_birth'),
    emergency_contact_name: formData.get('emergency_contact_name'), emergency_contact_phone: formData.get('emergency_contact_phone'),
    terms_accepted: formData.get('terms_accepted') === 'on', privacy_accepted: formData.get('privacy_accepted') === 'on',
    payer_consent: formData.get('payer_consent') === 'on',
  })
  if ('error' in result) return { error: result.error }
  revalidatePath('/protected')
  return { success: 'Profile completed' }
}
