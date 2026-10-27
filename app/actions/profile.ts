'use server'

// Server Action for the member's own profile form.
import { updateCurrentProfile } from '@/lib/services/MemberService'
import { failureState } from '@/lib/validations/form-errors'
import type { FormFieldState } from '@/types/domain'

export type ProfileActionState = FormFieldState & {
  success?: boolean
  message?: string
}

/** Saves the signed-in member's profile changes. */
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
