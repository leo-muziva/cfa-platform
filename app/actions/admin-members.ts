'use server'

import { revalidatePath } from 'next/cache'
import { adminUpdateMember } from '@/lib/services/MemberService'

export type AdminMemberActionState = {
  error?: string
  success?: boolean
  message?: string
}

export async function adminUpdateMemberAction(
  _prevState: AdminMemberActionState,
  formData: FormData
): Promise<AdminMemberActionState> {
  const targetId = formData.get('member_id')
  if (typeof targetId !== 'string' || targetId.length === 0) {
    return { error: 'Missing member id' }
  }

  const rawData = {
    full_name: formData.get('full_name') as string,
    phone: (formData.get('phone') as string) || undefined,
    date_of_birth: (formData.get('date_of_birth') as string) || null,
    role: formData.get('role') as string,
    // Unchecked checkboxes are absent from FormData, so absence means inactive.
    is_active: formData.get('is_active') === 'on',
    membership_type_id: (formData.get('membership_type_id') as string) || null,
  }

  const result = await adminUpdateMember(targetId, rawData)

  if ('error' in result) {
    return { error: result.error }
  }

  revalidatePath('/protected/admin/members')
  revalidatePath(`/protected/admin/members/${targetId}`)
  return { success: true, message: 'Member updated successfully' }
}
