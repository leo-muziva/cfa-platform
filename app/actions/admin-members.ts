'use server'

import { revalidatePath } from 'next/cache'
import { adminUpdateMember, inviteMemberForAdmin, attachDependentForAdmin } from '@/lib/services/MemberService'

export type AdminMemberActionState = {
  error?: string
  success?: boolean
  message?: string
}

export async function attachDependentAction(formData: FormData) {
  await attachDependentForAdmin(String(formData.get('profile_id')), String(formData.get('payer_id')))
  revalidatePath('/protected/admin/households')
  revalidatePath('/protected/admin/members')
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
    membership_status: formData.get('membership_status') as string,
    is_staff: formData.get('is_staff') === 'on',
    staff_type: (formData.get('staff_type') as string) || null,
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

export async function inviteMemberAction(
  _prevState: AdminMemberActionState,
  formData: FormData
): Promise<AdminMemberActionState> {
  const rawData = {
    email: formData.get('email') as string,
    full_name: formData.get('full_name') as string,
    membership_status: formData.get('membership_status') as string,
    is_staff: formData.get('is_staff') === 'on',
    staff_type: (formData.get('staff_type') as string) || null,
    membership_type_id: (formData.get('membership_type_id') as string) || null,
  }

  const result = await inviteMemberForAdmin(rawData)

  if ('error' in result) {
    return { error: result.error }
  }

  revalidatePath('/protected/admin/members')
  return { success: true, message: 'Invite sent — the member will appear once they accept' }
}
