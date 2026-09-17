import 'server-only'
import {
  deleteEquipmentItem, getEquipmentItemById, getEquipmentTypeById,
  insertEquipmentItem, listEquipmentItems, listEquipmentTypes, updateEquipmentItem,
  type EquipmentWriteResult,
} from '@/lib/repositories/EquipmentRepository'
import { requireAdmin, requireCoachOrAdmin } from '@/lib/services/MemberService'
import {
  applyTypeRules, equipmentItemSchema, equipmentListFiltersSchema, type EquipmentItemInput,
} from '@/lib/validations/equipment.schema'
import { matchesEquipmentFilter } from '@/lib/equipment-register'
import type { EquipmentItem, EquipmentListFilters, EquipmentType } from '@/types/domain'

const WRITE_ERRORS = {
  duplicate_code: 'That code is already in use. Pick another.',
  write_failed: 'Could not save this item.',
} as const

export async function getEquipmentRegister(rawFilters: unknown = {}): Promise<
  { items: EquipmentItem[]; types: EquipmentType[]; filters: EquipmentListFilters; total: number } | { error: string }
> {
  const guard = await requireCoachOrAdmin()
  if ('error' in guard) return guard
  const filters = equipmentListFiltersSchema.parse(rawFilters)
  const [items, types] = await Promise.all([listEquipmentItems(), listEquipmentTypes()])
  return { items: items.filter((item) => matchesEquipmentFilter(item, filters)), types, filters, total: items.length }
}

export async function getEquipmentFormData(itemId?: string): Promise<
  { types: EquipmentType[]; items: EquipmentItem[]; item: EquipmentItem | null; canDelete: boolean } | { error: string }
> {
  const guard = await requireCoachOrAdmin()
  if ('error' in guard) return guard
  const [types, items] = await Promise.all([listEquipmentTypes(), listEquipmentItems()])
  if (!itemId) return { types, items, item: null, canDelete: false }
  const item = await getEquipmentItemById(itemId)
  if (!item) return { error: 'Equipment item not found' }
  return { types, items, item, canDelete: guard.profile.staff_type === 'admin' }
}

async function writeItem(
  rawData: unknown,
  write: (input: EquipmentItemInput) => Promise<EquipmentWriteResult>,
): Promise<{ item: EquipmentItem } | { error: string }> {
  const guard = await requireCoachOrAdmin()
  if ('error' in guard) return guard

  const parsed = equipmentItemSchema.safeParse(rawData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const type = await getEquipmentTypeById(parsed.data.type_id)
  if (!type) return { error: 'Select an equipment type' }

  const ruled = applyTypeRules(parsed.data, type)
  if ('error' in ruled) return ruled

  const result = await write(ruled.data)
  return 'error' in result ? { error: WRITE_ERRORS[result.error] } : result
}

export async function createEquipmentItem(rawData: unknown) {
  return writeItem(rawData, insertEquipmentItem)
}

export async function editEquipmentItem(itemId: string, rawData: unknown) {
  return writeItem(rawData, (input) => updateEquipmentItem(itemId, input))
}

// Deliberately stricter than the rest of the register: coaches add and edit,
// only admins remove kit from the books.
export async function removeEquipmentItem(itemId: string): Promise<{ success: true } | { error: string }> {
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const deleted = await deleteEquipmentItem(itemId)
  return deleted ? { success: true } : { error: 'Could not delete this item.' }
}
