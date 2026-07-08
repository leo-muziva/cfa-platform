import { z } from 'zod'

export const profileUpdateSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().regex(/^\+?[\d\s\-()]{7,20}$/, 'Invalid phone number').optional().or(z.literal('')),
  date_of_birth: z.string().optional().nullable(),
})

export const adminProfileUpdateSchema = profileUpdateSchema.extend({
  role: z.enum(['admin', 'coach', 'fencer', 'guardian']).optional(),
  is_active: z.boolean().optional(),
  membership_type_id: z.string().uuid().optional().nullable(),
})

/**
 * Parses raw URL search params for the members list. Every field falls back
 * gracefully (`catch`) so a hand-edited or stale URL can never crash the page.
 */
export const memberListFiltersSchema = z.object({
  search: z
    .string()
    .trim()
    .max(100)
    .transform((s) => s || undefined)
    .optional()
    .catch(undefined),
  role: z.enum(['admin', 'coach', 'fencer', 'guardian']).optional().catch(undefined),
  status: z.enum(['active', 'inactive']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
})

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
export type AdminProfileUpdateInput = z.infer<typeof adminProfileUpdateSchema>
export type MemberListFiltersInput = z.infer<typeof memberListFiltersSchema>
