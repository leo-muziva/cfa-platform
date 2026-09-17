import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))

const repository = vi.hoisted(() => ({
  listEquipmentItems: vi.fn(),
  listEquipmentTypes: vi.fn(),
  listEquipmentMemberOptions: vi.fn(),
  getEquipmentItemById: vi.fn(),
  getEquipmentTypeById: vi.fn(),
  insertEquipmentItem: vi.fn(),
  updateEquipmentItem: vi.fn(),
  deleteEquipmentItem: vi.fn(),
}))
const guards = vi.hoisted(() => ({ requireAdmin: vi.fn(), requireCoachOrAdmin: vi.fn() }))

vi.mock('@/lib/repositories/EquipmentRepository', () => repository)
vi.mock('@/lib/services/MemberService', () => guards)

import {
  createEquipmentItem, editEquipmentItem, getEquipmentRegister, removeEquipmentItem,
} from './EquipmentService'
import type { EquipmentItem, EquipmentType } from '@/types/domain'

const TYPE_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'

const foil: EquipmentType = {
  id: TYPE_ID, name: 'Foil', code_prefix: 'WF', category: 'weapons',
  requires_size: false, requires_hand: true, sort_order: 1,
}
const jacket: EquipmentType = { ...foil, name: 'Jacket', code_prefix: 'JK', category: 'clothing', requires_size: true, requires_hand: false }

const item = (code: string, overrides: Partial<EquipmentItem> = {}): EquipmentItem => ({
  id: `item-${code}`, type_id: TYPE_ID, equipment_type: foil, code,
  hand: 'right', size: null, condition: 'good', status: 'in_storage', notes: null,
  assigned_to: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

const validForm = (overrides: Record<string, unknown> = {}) => ({
  type_id: TYPE_ID, code: 'WF011', hand: 'right', size: '',
  condition: 'good', status: 'in_storage', notes: '', ...overrides,
})

const asCoach = () => guards.requireCoachOrAdmin.mockResolvedValue({ profile: { staff_type: 'coach' } })
const asAdmin = () => {
  guards.requireCoachOrAdmin.mockResolvedValue({ profile: { staff_type: 'admin' } })
  guards.requireAdmin.mockResolvedValue({ profile: { staff_type: 'admin' } })
}
const asMember = () => {
  guards.requireCoachOrAdmin.mockResolvedValue({ error: 'Forbidden' })
  guards.requireAdmin.mockResolvedValue({ error: 'Forbidden' })
}

beforeEach(() => {
  vi.clearAllMocks()
  repository.listEquipmentTypes.mockResolvedValue([foil])
  repository.listEquipmentMemberOptions.mockResolvedValue([
    { id: MEMBER_ID, full_name: 'Fiona Fencer' },
  ])
  repository.listEquipmentItems.mockResolvedValue([item('WF001')])
  repository.getEquipmentTypeById.mockResolvedValue(foil)
  repository.insertEquipmentItem.mockResolvedValue({ item: item('WF011') })
  repository.updateEquipmentItem.mockResolvedValue({ item: item('WF011') })
  repository.deleteEquipmentItem.mockResolvedValue(true)
  guards.requireAdmin.mockResolvedValue({ error: 'Forbidden' })
})

describe('equipment register access', () => {
  it('keeps ordinary members out of every entry point', async () => {
    asMember()
    expect(await getEquipmentRegister()).toEqual({ error: 'Forbidden' })
    expect(await createEquipmentItem(validForm())).toEqual({ error: 'Forbidden' })
    expect(await editEquipmentItem('item-WF001', validForm())).toEqual({ error: 'Forbidden' })
    expect(await removeEquipmentItem('item-WF001')).toEqual({ error: 'Forbidden' })
    expect(repository.insertEquipmentItem).not.toHaveBeenCalled()
    expect(repository.deleteEquipmentItem).not.toHaveBeenCalled()
  })

  it('lets a coach add and edit but not delete', async () => {
    asCoach()
    expect(await createEquipmentItem(validForm())).toMatchObject({ item: { code: 'WF011' } })
    expect(await editEquipmentItem('item-WF001', validForm())).toMatchObject({ item: { code: 'WF011' } })
    expect(await removeEquipmentItem('item-WF001')).toEqual({ error: 'Forbidden' })
    expect(repository.deleteEquipmentItem).not.toHaveBeenCalled()
  })

  it('lets an admin delete', async () => {
    asAdmin()
    expect(await removeEquipmentItem('item-WF001')).toEqual({ success: true })
    expect(repository.deleteEquipmentItem).toHaveBeenCalledWith('item-WF001')
  })

  it('reports a delete that the database refused rather than claiming success', async () => {
    asAdmin()
    repository.deleteEquipmentItem.mockResolvedValue(false)
    expect(await removeEquipmentItem('item-WF001')).toEqual({ error: 'Could not delete this item.' })
  })
})

describe('equipment register writes', () => {
  beforeEach(asCoach)

  it('explains a duplicate code instead of leaking a database error', async () => {
    repository.insertEquipmentItem.mockResolvedValue({ error: 'duplicate_code' })
    expect(await createEquipmentItem(validForm())).toEqual({ error: 'That code is already in use. Pick another.' })
  })

  it('gives a generic message for any other write failure', async () => {
    repository.insertEquipmentItem.mockResolvedValue({ error: 'write_failed' })
    expect(await createEquipmentItem(validForm())).toEqual({ error: 'Could not save this item.' })
  })

  it('rejects an item missing what its type requires', async () => {
    repository.getEquipmentTypeById.mockResolvedValue(jacket)
    expect(await createEquipmentItem(validForm({ hand: '', size: '' }))).toEqual({ error: 'Select a size.' })
    expect(repository.insertEquipmentItem).not.toHaveBeenCalled()
  })

  it('clears attributes the chosen type does not use before saving', async () => {
    repository.getEquipmentTypeById.mockResolvedValue(jacket)
    await createEquipmentItem(validForm({ code: 'JK012', size: 'M', hand: 'left' }))
    expect(repository.insertEquipmentItem).toHaveBeenCalledWith(expect.objectContaining({ size: 'M', hand: null }))
  })

  it('rejects an unknown type before touching the table', async () => {
    repository.getEquipmentTypeById.mockResolvedValue(null)
    expect(await createEquipmentItem(validForm())).toEqual({ error: 'Select an equipment type' })
    expect(repository.insertEquipmentItem).not.toHaveBeenCalled()
  })

  it('surfaces the first validation message for a malformed code', async () => {
    const result = await createEquipmentItem(validForm({ code: 'nope' }))
    expect(result).toMatchObject({ error: expect.stringContaining('two letters') })
  })
})

describe('getEquipmentRegister', () => {
  beforeEach(asCoach)

  it('filters the register but reports the untouched total', async () => {
    repository.listEquipmentItems.mockResolvedValue([
      item('WF001'),
      item('WF002', { status: 'with_member' }),
      item('WF003', { status: 'awaiting_repair', condition: 'poor' }),
    ])
    const result = await getEquipmentRegister({ status: 'with_member' })
    expect(result).toMatchObject({ total: 3 })
    expect('items' in result && result.items.map((i) => i.code)).toEqual(['WF002'])
  })

  it('ignores junk filter values instead of failing the page', async () => {
    const result = await getEquipmentRegister({ status: 'nonsense' })
    expect('items' in result && result.items.length).toBe(1)
  })
})
