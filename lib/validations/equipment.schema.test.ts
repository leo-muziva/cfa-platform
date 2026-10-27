import { describe, expect, it } from 'vitest'
import { applyTypeRules, equipmentItemSchema, equipmentListFiltersSchema } from './equipment.schema'

const TYPE_ID = '11111111-1111-4111-8111-111111111111'

const form = (overrides: Record<string, unknown> = {}) => ({
  type_id: TYPE_ID, code: 'wf011', hand: '', size: '',
  condition: 'good', status: 'in_storage', notes: '', ...overrides,
})

describe('equipmentItemSchema', () => {
  it('uppercases and trims the code', () => {
    const parsed = equipmentItemSchema.parse(form({ code: '  wf011 ' }))
    expect(parsed.code).toBe('WF011')
  })

  it('turns blank optional fields into null', () => {
    const parsed = equipmentItemSchema.parse(form())
    expect(parsed).toMatchObject({ hand: null, size: null, notes: null })
  })

  it.each([
    ['W1', 'a code that is not two letters plus digits'],
    ['WF01', 'a code with too few digits'],
    ['WFO11', 'a code with a letter where digits belong'],
  ])('rejects %s (%s)', (code) => {
    expect(equipmentItemSchema.safeParse(form({ code })).success).toBe(false)
  })

  it.each(['status', 'condition', 'hand', 'size'])('rejects an unknown %s', (field) => {
    expect(equipmentItemSchema.safeParse(form({ [field]: 'nonsense' })).success).toBe(false)
  })

  it('rejects display strings left over from the standalone tool', () => {
    expect(equipmentItemSchema.safeParse(form({ status: 'In Storage' })).success).toBe(false)
    expect(equipmentItemSchema.safeParse(form({ condition: 'Good' })).success).toBe(false)
  })

  it('accepts a member id for the holder, and blank means nobody recorded', () => {
    const member = '22222222-2222-4222-8222-222222222222'
    expect(equipmentItemSchema.parse(form({ assigned_to: member })).assigned_to).toBe(member)
    expect(equipmentItemSchema.parse(form({ assigned_to: '' })).assigned_to).toBeNull()
  })

  it('rejects a holder that is not a member id', () => {
    expect(equipmentItemSchema.safeParse(form({ assigned_to: 'Fiona Fencer' })).success).toBe(false)
  })
})

describe('equipmentListFiltersSchema', () => {
  it('drops junk filter values instead of failing the page', () => {
    expect(equipmentListFiltersSchema.parse({ status: 'nonsense', condition: 'nope', search: '' }))
      .toEqual({ status: undefined, condition: undefined, search: undefined })
  })

  it('keeps valid filters', () => {
    expect(equipmentListFiltersSchema.parse({ search: ' foil ', status: 'with_member' }))
      .toMatchObject({ search: 'foil', status: 'with_member' })
  })
})

describe('applyTypeRules', () => {
  const sized = { code_prefix: 'WF', requires_size: true, requires_hand: false }
  const handed = { code_prefix: 'WF', requires_size: false, requires_hand: true }
  const both = { code_prefix: 'WF', requires_size: true, requires_hand: true }
  const neither = { code_prefix: 'WF', requires_size: false, requires_hand: false }

  it('demands the fields the type actually uses', () => {
    const input = equipmentItemSchema.parse(form())
    expect(applyTypeRules(input, sized)).toEqual({ error: 'Select a size.' })
    expect(applyTypeRules(input, handed)).toEqual({ error: 'Select handedness.' })
    expect(applyTypeRules(input, both)).toEqual({ error: 'Select a size.' })
  })

  it('accepts an item that carries what its type needs', () => {
    const input = equipmentItemSchema.parse(form({ size: 'M', hand: 'left' }))
    const result = applyTypeRules(input, both)
    expect(result).toMatchObject({ data: { size: 'M', hand: 'left' } })
  })

  it('clears attributes the type does not use', () => {
    const input = equipmentItemSchema.parse(form({ size: 'M', hand: 'left' }))
    expect(applyTypeRules(input, neither)).toMatchObject({ data: { size: null, hand: null } })
    expect(applyTypeRules(input, sized)).toMatchObject({ data: { size: 'M', hand: null } })
  })

  it('rejects a code that belongs to a different type', () => {
    const input = equipmentItemSchema.parse(form({ code: 'JK999' }))
    expect(applyTypeRules(input, neither)).toEqual({ error: 'Codes for this type start with WF, like WF001.' })
  })

  it('only keeps a holder while the item is actually with a member', () => {
    const member = '22222222-2222-4222-8222-222222222222'
    const out = equipmentItemSchema.parse(form({ status: 'with_member', assigned_to: member }))
    expect(applyTypeRules(out, neither)).toMatchObject({ data: { assigned_to: member } })

    // Returned to storage — the holder goes with it, rather than lingering.
    const back = equipmentItemSchema.parse(form({ status: 'in_storage', assigned_to: member }))
    expect(applyTypeRules(back, neither)).toMatchObject({ data: { assigned_to: null } })
  })
})
