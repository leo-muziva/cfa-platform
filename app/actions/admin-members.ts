'use server'

// Server Actions for the admin member pages. Like every file in app/actions,
// each action reads the submitted FormData, hands the raw values to a
// service (which validates and authorizes), then refreshes the pages that
// show the changed data with revalidatePath.
import { revalidatePath } from 'next/cache'
import { adminUpdateMember, inviteMemberForAdmin } from '@/lib/services/MemberService'
import { failureState } from '@/lib/validations/form-errors'
import type { FormFieldState } from '@/types/domain'

// State returned to useActionState in the admin member forms.
export type AdminMemberActionState = FormFieldState & {
  success?: boolean
  message?: string
}

/** Saves an admin's edits to another member's profile. */
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
    is_staff: formData.get('is_staff') === 'on',
    staff_type: (formData.get('staff_type') as string) || null,
    // Unchecked checkboxes are absent from FormData, so absence means inactive.
    is_active: formData.get('is_active') === 'on',
  }

  const result = await adminUpdateMember(targetId, rawData)

  if ('error' in result) {
    return failureState(result)
  }

  revalidatePath('/protected/admin/members')
  revalidatePath(`/protected/admin/members/${targetId}`)
  return { success: true, message: 'Member updated successfully' }
}

/** Sends a Supabase invite email to a new member or staff member. */
export async function inviteMemberAction(
  _prevState: AdminMemberActionState,
  formData: FormData
): Promise<AdminMemberActionState> {
  const rawData = {
    email: formData.get('email') as string,
    full_name: formData.get('full_name') as string,
    is_staff: formData.get('is_staff') === 'on',
    staff_type: (formData.get('staff_type') as string) || null,
  }

  const result = await inviteMemberForAdmin(rawData)

  if ('error' in result) {
    return failureState(result)
  }

  revalidatePath('/protected/admin/members')
  return { success: true, message: 'Invite sent — the member will appear once they accept' }
}
