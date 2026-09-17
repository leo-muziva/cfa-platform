import { describe, expect, it } from 'vitest'
import {
  groupItemsByCategory, itemDetail, matchesEquipmentFilter, nextItemCode, summariseRegister,
} from './equipment-register'
import type { EquipmentItem, EquipmentType } from '@/types/domain'

const foil: EquipmentType = {
  id: 'type-foil', name: 'Foil', code_prefix: 'WF', category: 'weapons',
  requires_size: false, requires_hand: true, sort_order: 1,
}
const epeeMask: EquipmentType = {
  id: 'type-epee-mask', name: 'Épée Mask', code_prefix: 'ME', category: 'masks',
  requires_size: true, requires_hand: false, sort_order: 5,
}
const jacket: EquipmentType = {
  id: 'type-jacket', name: 'Jacket', code_prefix: 'JK', category: 'clothing',
  requires_size: true, requires_hand: false, sort_order: 9,
}

const item = (code: string, type: EquipmentType, overrides: Partial<EquipmentItem> = {}): EquipmentItem => ({
  id: `item-${code}`, type_id: type.id, equipment_type: type, code,
  hand: null, size: null, condition: 'good', status: 'in_storage', notes: null,
  assigned_to: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('nextItemCode', () => {
  it('starts a type that has no items yet at 001', () => {
    expect(nextItemCode('WF', [])).toBe('WF001')
  })

  it('continues from the highest suffix rather than the item count', () => {
    expect(nextItemCode('WF', ['WF001', 'WF002', 'WF010'])).toBe('WF011')
  })

  it('ignores gaps, other prefixes and malformed codes', () => {
    expect(nextItemCode('WF', ['WF001', 'WE009', 'WF00X', 'MC050', 'WF004'])).toBe('WF005')
  })

  it('tolerates lowercase and padded input', () => {
    expect(nextItemCode('WF', [' wf007 '])).toBe('WF008')
  })

  it('widens past three digits instead of wrapping', () => {
    expect(nextItemCode('WF', ['WF999'])).toBe('WF1000')
  })
})

describe('matchesEquipmentFilter', () => {
  const broken = item('WF007', foil, { condition: 'poor', status: 'awaiting_repair', notes: 'Blade cracked' })

  it('keeps everything when no filters are set', () => {
    expect(matchesEquipmentFilter(broken, {})).toBe(true)
  })

  it('matches on code, notes and type name', () => {
    expect(matchesEquipmentFilter(broken, { search: 'wf007' })).toBe(true)
    expect(matchesEquipmentFilter(broken, { search: 'cracked' })).toBe(true)
    expect(matchesEquipmentFilter(broken, { search: 'foil' })).toBe(true)
    expect(matchesEquipmentFilter(broken, { search: 'jacket' })).toBe(false)
  })

  it('ignores accents so "epee" finds Épée', () => {
    const mask = item('ME001', epeeMask, { size: 'M' })
    expect(matchesEquipmentFilter(mask, { search: 'epee' })).toBe(true)
    expect(matchesEquipmentFilter(mask, { search: 'Épée' })).toBe(true)
  })

  it('combines status and condition with the search term', () => {
    expect(matchesEquipmentFilter(broken, { status: 'awaiting_repair', condition: 'poor' })).toBe(true)
    expect(matchesEquipmentFilter(broken, { status: 'in_storage' })).toBe(false)
    expect(matchesEquipmentFilter(broken, { search: 'cracked', condition: 'good' })).toBe(false)
  })
})

describe('itemDetail', () => {
  it('shows only the attributes the type actually uses', () => {
    expect(itemDetail(item('WF001', foil, { hand: 'left' }))).toBe('Left-handed')
    expect(itemDetail(item('JK001', jacket, { size: 'M' }))).toBe('M')
    expect(itemDetail(item('MC001', foil))).toBe('')
  })
})

describe('groupItemsByCategory', () => {
  const items = [
    item('JK002', jacket, { size: 'S', status: 'with_member' }),
    item('WF002', foil, { hand: 'right' }),
    item('JK001', jacket, { size: 'XS' }),
    item('WF001', foil, { hand: 'right', status: 'awaiting_repair' }),
  ]

  it('orders categories and types by the register, and items by code', () => {
    const groups = groupItemsByCategory(items)
    expect(groups.map((group) => group.category)).toEqual(['weapons', 'clothing'])
    expect(groups[0].types[0].items.map((i) => i.code)).toEqual(['WF001', 'WF002'])
  })

  it('counts statuses per type group', () => {
    const [weapons, clothing] = groupItemsByCategory(items)
    expect(weapons.types[0].counts).toEqual({ in_storage: 1, with_member: 0, awaiting_repair: 1 })
    expect(clothing.types[0].counts).toEqual({ in_storage: 1, with_member: 1, awaiting_repair: 0 })
  })

  it('leaves out categories that have no items', () => {
    expect(groupItemsByCategory([]).length).toBe(0)
    expect(groupItemsByCategory([item('WF001', foil)]).map((group) => group.category)).toEqual(['weapons'])
  })
})

describe('summariseRegister', () => {
  it('counts the register by status', () => {
    expect(summariseRegister([])).toEqual({ total: 0, in_storage: 0, with_member: 0, awaiting_repair: 0 })
    expect(summariseRegister([
      item('WF001', foil),
      item('WF002', foil, { status: 'with_member' }),
      item('WF003', foil, { status: 'with_member' }),
    ])).toEqual({ total: 3, in_storage: 1, with_member: 2, awaiting_repair: 0 })
  })
})
