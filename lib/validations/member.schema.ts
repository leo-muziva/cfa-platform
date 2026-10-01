import { z } from 'zod'
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js/min'

const PHONE_MESSAGE = 'Enter a valid phone number for the selected country'
// Numbers without a country code are read as South African.
const DEFAULT_PHONE_COUNTRY = 'ZA'

/** Valid for its country, stored as E.164 (+27821234567). Blank stays blank. */
const optionalPhone = z.string().trim()
  .refine((value) => value === '' || isValidPhoneNumber(value, DEFAULT_PHONE_COUNTRY), PHONE_MESSAGE)
  .transform((value) => value === '' ? '' : parsePhoneNumberFromString(value, DEFAULT_PHONE_COUNTRY)?.number ?? value)

const requiredPhone = z.string('Enter a phone number').trim().min(1, 'Enter a phone number')
  .refine((value) => isValidPhoneNumber(value, DEFAULT_PHONE_COUNTRY), PHONE_MESSAGE)
  .transform((value) => parsePhoneNumberFromString(value, DEFAULT_PHONE_COUNTRY)?.number ?? value)

const EARLIEST_BIRTH_DATE = '1900-01-01'

function isRealIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

function todayInCapeTown() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date())
}

/** ISO date of birth: a real date, not in the future, not before 1900. Blank stays blank. */
const optionalBirthDate = z.string().trim()
  .refine((value) => value === '' || isRealIsoDate(value), 'Enter a valid date')
  .refine((value) => value === '' || !isRealIsoDate(value) || value <= todayInCapeTown(), 'Date of birth cannot be in the future')
  .refine((value) => value === '' || !isRealIsoDate(value) || value >= EARLIEST_BIRTH_DATE, 'Enter a date of birth after 1900')

export const profileUpdateSchema = z.object({
  full_name: z.string('Enter your full name').trim().min(2, 'Name must be at least 2 characters').max(100),
  phone: optionalPhone.optional(),
  date_of_birth: optionalBirthDate.optional().nullable(),
  emergency_contact_name: z.string().trim().max(100).optional().nullable(),
  emergency_contact_phone: optionalPhone.optional().nullable(),
  reminder_preference: z.enum(['email', 'whatsapp', 'both']).optional(),
})

export const adminProfileUpdateSchema = profileUpdateSchema.extend({
  is_staff: z.boolean().optional(),
  staff_type: z.enum(['admin', 'coach']).optional().nullable(),
  is_active: z.boolean().optional(),
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
  email: z.email('Enter a valid email address').max(254),
  full_name: z.string().trim().min(2).max(100),
  is_staff: z.coerce.boolean().default(false),
  staff_type: z.enum(['admin', 'coach']).optional().nullable(),
})

// Profile completion needs every contact detail, not just what the browser's
// `required` attribute asks for.
export const registrationDetailsSchema = profileUpdateSchema.extend({
  phone: requiredPhone,
  date_of_birth: optionalBirthDate.refine((value) => value !== '', 'Enter your date of birth'),
  emergency_contact_name: z.string('Enter an emergency contact').trim().min(2, 'Enter an emergency contact name').max(100),
  emergency_contact_phone: requiredPhone,
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
  access_rule: z.enum(['guest_allowed', 'active_members_only']).default('guest_allowed'),
}).refine((v) => new Date(v.ends_at) > new Date(v.starts_at), { message: 'End time must be after start time' })

export const bookingSchema = z.object({
  lesson_slot_id: z.uuid(),
  fencer_id: z.uuid(),
  payment_option: z.enum(['pay_now', 'pay_later']),
})

export const membershipRequestSchema = z.object({ membership_type_id: z.uuid() })
export const membershipResubmissionSchema = membershipRequestSchema.extend({ application_id: z.uuid() })
export const membershipReviewSchema = z.object({
  application_id: z.uuid(),
  decision: z.enum(['approve', 'request_changes', 'reject']),
  visible_response: z.string().trim().max(2000).optional().nullable(),
  private_notes: z.string().trim().max(2000).optional().nullable(),
})
export const membershipStatusChangeSchema = z.object({
  profile_id: z.uuid(), status: z.enum(['active', 'suspended', 'expired', 'cancelled']),
})
export const familyLinkRequestSchema = z.object({ email: z.email('Enter a valid email address').max(254) })
export const familyLinkResponseSchema = z.object({ link_id: z.uuid(), response: z.enum(['accept', 'reject']) })
export const familyLinkEndSchema = z.object({ link_id: z.uuid() })

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
export type AdminProfileUpdateInput = z.infer<typeof adminProfileUpdateSchema>
export type MemberListFiltersInput = z.infer<typeof memberListFiltersSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
