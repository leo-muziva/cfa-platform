'use server'

import { updateCurrentProfile } from '@/lib/services/MemberService'

export type ProfileActionState = {
  error?: string
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
    return { error: result.error }
  }

  return { success: true, message: 'Profile updated successfully' }
}
