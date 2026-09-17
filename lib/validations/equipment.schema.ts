import { z } from 'zod'
import type { EquipmentType } from '@/types/domain'

/** FormData gives '' for a field the form chose not to show. */
const blankToNull = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' || value === undefined ? null : value), schema.nullable())

export const equipmentListFiltersSchema = z.object({
  search: z.string().trim().max(100).transform((value) => value || undefined).optional().catch(undefined),
  status: z.enum(['in_storage', 'with_member', 'awaiting_repair']).optional().catch(undefined),
  condition: z.enum(['good', 'fair', 'poor', 'broken']).optional().catch(undefined),
})

export const equipmentItemSchema = z.object({
  type_id: z.uuid('Select an equipment type'),
  code: z.string().trim().toUpperCase()
    .regex(/^[A-Z]{2}\d{3,}$/, 'Code must be two letters followed by at least three digits, like WF011'),
  hand: blankToNull(z.enum(['left', 'right'])),
  size: blankToNull(z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL'])),
  condition: z.enum(['good', 'fair', 'poor', 'broken']),
  status: z.enum(['in_storage', 'with_member', 'awaiting_repair']),
  notes: blankToNull(z.string().trim().max(500)),
  assigned_to: blankToNull(z.uuid('Pick a member from the list')),
})

export type EquipmentItemInput = z.infer<typeof equipmentItemSchema>

/** Whether an item needs a size or a handedness depends on its type, which
 *  lives in another table — no CHECK constraint can express that, so this is
 *  where the rule is enforced. Also clears whatever the type doesn't use, so a
 *  stale field can't survive a type change. */
export function applyTypeRules(
  input: EquipmentItemInput,
  type: Pick<EquipmentType, 'requires_size' | 'requires_hand'>,
): { data: EquipmentItemInput } | { error: string } {
  if (type.requires_size && !input.size) return { error: 'Select a size.' }
  if (type.requires_hand && !input.hand) return { error: 'Select handedness.' }
  return {
    data: {
      ...input,
      size: type.requires_size ? input.size : null,
      hand: type.requires_hand ? input.hand : null,
      // A holder only means anything while the item is actually out.
      assigned_to: input.status === 'with_member' ? input.assigned_to : null,
    },
  }
}
