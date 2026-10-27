'use server'
// Server Action for the "complete your profile" step after sign-up.
import { revalidatePath } from 'next/cache'
import { completeCurrentProfile } from '@/lib/services/MemberService'
import { failureState } from '@/lib/validations/form-errors'
import type { FormFieldState } from '@/types/domain'

export type OnboardingState = FormFieldState & { success?: string }
/** Saves the required sign-up details and the terms and privacy acceptance. */
export async function completeProfileAction(_: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const result = await completeCurrentProfile({
    full_name: formData.get('full_name'), phone: formData.get('phone'), date_of_birth: formData.get('date_of_birth'),
    emergency_contact_name: formData.get('emergency_contact_name'), emergency_contact_phone: formData.get('emergency_contact_phone'),
    terms_accepted: formData.get('terms_accepted') === 'on', privacy_accepted: formData.get('privacy_accepted') === 'on',
    payer_consent: formData.get('payer_consent') === 'on',
  })
  if ('error' in result) return failureState(result)
  revalidatePath('/protected')
  return { success: 'Profile completed' }
}
