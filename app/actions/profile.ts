'use server'

import { updateCurrentProfile } from '@/lib/services/MemberService'
import { failureState } from '@/lib/validations/form-errors'
import type { FormFieldState } from '@/types/domain'

export type ProfileActionState = FormFieldState & {
  success?: boolean
  message?: string
}

export async function updateProfileAction(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const rawData = {
    full_name: formData.get('full_name') as string,
    phone: (formData.get('phone') as string) || undefined,
    date_of_birth: (formData.get('date_of_birth') as string) || null,
    reminder_preference: formData.get('reminder_preference') as string,
  }

  const result = await updateCurrentProfile(rawData)

  if ('error' in result) {
    return failureState(result)
  }

  return { success: true, message: 'Profile updated successfully' }
}
