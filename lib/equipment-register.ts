import type {
  EquipmentCategory, EquipmentCondition, EquipmentItem, EquipmentListFilters,
  EquipmentSize, EquipmentStatus, EquipmentType,
} from '@/types/domain'

export const EQUIPMENT_SIZES: EquipmentSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
export const EQUIPMENT_CONDITIONS: EquipmentCondition[] = ['good', 'fair', 'poor', 'broken']
export const EQUIPMENT_STATUSES: EquipmentStatus[] = ['in_storage', 'with_member', 'awaiting_repair']

export const CATEGORY_ORDER: EquipmentCategory[] =
  ['weapons', 'masks', 'lames', 'clothing', 'gloves', 'wires', 'accessories']

export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  weapons: 'Weapons', masks: 'Masks', lames: 'Lamés', clothing: 'Clothing',
  gloves: 'Gloves', wires: 'Wires', accessories: 'Accessories',
}
export const CONDITION_LABELS: Record<EquipmentCondition, string> = {
  good: 'Good', fair: 'Fair', poor: 'Poor', broken: 'Broken',
}
export const STATUS_LABELS: Record<EquipmentStatus, string> = {
  in_storage: 'In storage', with_member: 'With member', awaiting_repair: 'Awaiting repair',
}
export const HAND_LABELS = { left: 'Left-handed', right: 'Right-handed' } as const

export interface EquipmentTypeGroup {
  type: EquipmentType
  items: EquipmentItem[]
  counts: Record<EquipmentStatus, number>
}

export interface EquipmentCategoryGroup {
  category: EquipmentCategory
  label: string
  types: EquipmentTypeGroup[]
}

/** Suffix numbers are uneven across types (WF runs to 010, FW to 012), so this
 *  reads the existing codes rather than counting rows. Only a suggestion — the
 *  unique constraint is what actually prevents a collision. */
export function nextItemCode(prefix: string, existingCodes: string[]): string {
  let highest = 0
  for (const code of existingCodes) {
    const upper = code.trim().toUpperCase()
    if (!upper.startsWith(prefix)) continue
    const suffix = upper.slice(prefix.length)
    if (!/^\d+$/.test(suffix)) continue
    highest = Math.max(highest, Number(suffix))
  }
  return `${prefix}${String(highest + 1).padStart(3, '0')}`
}

/** Strips accents so searching "epee" finds Épée. */
function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function itemDetail(item: EquipmentItem): string {
  const parts: string[] = []
  if (item.size) parts.push(item.size)
  if (item.hand) parts.push(HAND_LABELS[item.hand])
  return parts.join(' · ')
}

export function matchesEquipmentFilter(item: EquipmentItem, filters: EquipmentListFilters): boolean {
  if (filters.status && item.status !== filters.status) return false
  if (filters.condition && item.condition !== filters.condition) return false
  if (!filters.search) return true
  const term = fold(filters.search.trim())
  if (!term) return true
  const haystack = [item.code, item.equipment_type?.name ?? '', item.notes ?? '', itemDetail(item)]
  return haystack.some((value) => fold(value).includes(term))
}

export function groupItemsByCategory(items: EquipmentItem[]): EquipmentCategoryGroup[] {
  const byType = new Map<string, EquipmentTypeGroup>()
  for (const item of items) {
    const type = item.equipment_type
    if (!type) continue
    let group = byType.get(type.id)
    if (!group) {
      group = { type, items: [], counts: { in_storage: 0, with_member: 0, awaiting_repair: 0 } }
      byType.set(type.id, group)
    }
    group.items.push(item)
    group.counts[item.status] += 1
  }

  for (const group of byType.values()) {
    group.items.sort((a, b) => a.code.localeCompare(b.code))
  }

  return CATEGORY_ORDER
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      types: [...byType.values()]
        .filter((group) => group.type.category === category)
        .sort((a, b) => a.type.sort_order - b.type.sort_order),
    }))
    .filter((group) => group.types.length > 0)
}

export function summariseRegister(items: EquipmentItem[]): Record<EquipmentStatus, number> & { total: number } {
  const summary = { total: items.length, in_storage: 0, with_member: 0, awaiting_repair: 0 }
  for (const item of items) summary[item.status] += 1
  return summary
}
