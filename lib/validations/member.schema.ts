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

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
export type AdminProfileUpdateInput = z.infer<typeof adminProfileUpdateSchema>
