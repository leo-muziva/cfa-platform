import { z } from 'zod'

const phone = z.string().regex(/^\+?[\d\s\-()]{7,20}$/, 'Invalid phone number')

export const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  phone: phone.optional().or(z.literal('')),
  date_of_birth: z.iso.date().optional().nullable().or(z.literal('')),
  emergency_contact_name: z.string().trim().max(100).optional().nullable(),
  emergency_contact_phone: phone.optional().nullable().or(z.literal('')),
})

export const adminProfileUpdateSchema = profileUpdateSchema.extend({
  membership_status: z.enum(['guest', 'member']).optional(),
  is_staff: z.boolean().optional(),
  staff_type: z.enum(['admin', 'coach']).optional().nullable(),
  is_active: z.boolean().optional(),
  membership_type_id: z.uuid().optional().nullable(),
}).refine((value) => value.is_staff !== false || !value.staff_type, {
  message: 'Non-staff accounts cannot have a staff type',
})

export const memberListFiltersSchema = z.object({
  search: z.string().trim().max(100).transform((s) => s || undefined).optional().catch(undefined),
  membershipStatus: z.enum(['guest', 'member']).optional().catch(undefined),
  staffType: z.enum(['admin', 'coach']).optional().catch(undefined),
  status: z.enum(['active', 'inactive']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
})

export const inviteMemberSchema = z.object({
  email: z.email('Invalid email address').max(254),
  full_name: z.string().trim().min(2).max(100),
  membership_status: z.enum(['guest', 'member']).default('guest'),
  is_staff: z.coerce.boolean().default(false),
  staff_type: z.enum(['admin', 'coach']).optional().nullable(),
  membership_type_id: z.uuid().optional().nullable(),
})

export const registrationDetailsSchema = profileUpdateSchema.extend({
  terms_accepted: z.literal(true, 'You must accept the Terms and Conditions'),
  privacy_accepted: z.literal(true, 'You must accept the privacy notice'),
  payer_consent: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (value.date_of_birth) {
    const dob = new Date(`${value.date_of_birth}T00:00:00Z`)
    const adultDate = new Date()
    adultDate.setUTCFullYear(adultDate.getUTCFullYear() - 18)
    if (dob > adultDate && !value.payer_consent) {
      ctx.addIssue({ code: 'custom', path: ['payer_consent'], message: 'Payer consent is required for minors' })
    }
  }
})

export const lessonSlotSchema = z.object({
  starts_at: z.iso.datetime({ offset: true }),
  ends_at: z.iso.datetime({ offset: true }),
  price: z.coerce.number().min(0),
  capacity: z.coerce.number().int().positive().optional().nullable(),
  coach_id: z.uuid().optional().nullable(),
}).refine((v) => new Date(v.ends_at) > new Date(v.starts_at), { message: 'End time must be after start time' })

export const bookingSchema = z.object({
  lesson_slot_id: z.uuid(),
  fencer_id: z.uuid(),
  payment_option: z.enum(['pay_now', 'pay_later']),
})

export const membershipRequestSchema = z.object({ membership_type_id: z.uuid() })

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
export type AdminProfileUpdateInput = z.infer<typeof adminProfileUpdateSchema>
export type MemberListFiltersInput = z.infer<typeof memberListFiltersSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
