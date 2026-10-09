import { describe, expect, it } from 'vitest'
import { findSection, groupProducts, isShopWeapon, SECTIONS } from './browse'

describe('shop browse', () => {
  it('only weapons and parts ask for a weapon', () => {
    expect(SECTIONS.filter((s) => s.asksForWeapon).map((s) => s.key)).toEqual(['weapons', 'parts'])
  })

  it('finds sections and rejects unknown ones', () => {
    expect(findSection('parts')?.label).toBe('Parts and repairs')
    expect(findSection('nope')).toBeUndefined()
    expect(findSection(undefined)).toBeUndefined()
  })

  it('checks weapon values', () => {
    expect(isShopWeapon('foil')).toBe(true)
    expect(isShopWeapon('general')).toBe(false)
    expect(isShopWeapon(undefined)).toBe(false)
  })

  it('groups by kind in the set order', () => {
    const groups = groupProducts([
      { id: 1, kind: 'grip', level: null },
      { id: 2, kind: 'blade', level: null },
      { id: 3, kind: 'grip', level: null },
    ])
    expect(groups.map((g) => g.label)).toEqual(['Blades', 'Grips'])
    expect(groups[1].items.map((p) => p.id)).toEqual([1, 3])
  })

  it('splits a kind by level when it has more than one', () => {
    const groups = groupProducts([
      { id: 1, kind: 'blade', level: 'fie' },
      { id: 2, kind: 'blade', level: 'practice' },
      { id: 3, kind: 'blade', level: 'electric' },
    ])
    expect(groups.map((g) => g.label)).toEqual(['Blades - Practice', 'Blades - Electric', 'Blades - FIE'])
  })

  it('puts untagged products last under Other', () => {
    const groups = groupProducts([{ id: 1, kind: null, level: null }, { id: 2, kind: 'mask', level: null }])
    expect(groups.map((g) => g.label)).toEqual(['Masks', 'Other'])
  })
})