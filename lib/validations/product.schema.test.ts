import { describe, expect, it } from 'vitest'
import { productIdSchema, productInputSchema } from './product.schema'

const base = {
  item_code: ' ef105 ',
  name: ' Sabre Mask ',
  description: '',
  price: '350.50',
  category: ' Masks ',
  sizes: '',
  section: 'clothing',
  is_active: true,
}

describe('productInputSchema', () => {
  it('trims, uppercases the item code and nulls empty optional text', () => {
    const result = productInputSchema.safeParse(base)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toEqual({
      item_code: 'EF105',
      name: 'Sabre Mask',
      description: null,
      price: 350.5,
      category: 'Masks',
      sizes: null,
      section: 'clothing',
      is_active: true,
    })
  })

  it('needs a shop section, so new products show up when browsing', () => {
    expect(productInputSchema.safeParse({ ...base, section: '' }).success).toBe(false)
    expect(productInputSchema.safeParse({ ...base, section: 'nope' }).success).toBe(false)
    expect(productInputSchema.safeParse({ item_code: 'EF1', name: 'Foil', price: '10', is_active: false }).success)
      .toBe(false)
  })

  it('accepts a zero price and whole numbers', () => {
    expect(productInputSchema.safeParse({ ...base, price: '0' }).success).toBe(true)
    expect(productInputSchema.safeParse({ ...base, price: '1200' }).success).toBe(true)
  })

  it('rejects negative, non-numeric and over-precise prices', () => {
    for (const price of ['-1', 'abc', '', '1.234', '1e3', '1.']) {
      expect(productInputSchema.safeParse({ ...base, price }).success).toBe(false)
    }
  })

  it('requires an item code and name within length limits', () => {
    expect(productInputSchema.safeParse({ ...base, item_code: '   ' }).success).toBe(false)
    expect(productInputSchema.safeParse({ ...base, item_code: 'X'.repeat(41) }).success).toBe(false)
    expect(productInputSchema.safeParse({ ...base, name: '' }).success).toBe(false)
    expect(productInputSchema.safeParse({ ...base, name: 'N'.repeat(201) }).success).toBe(false)
  })

  it('allows optional fields to be missing but rejects unknown fields', () => {
    const required = { item_code: 'EF1', name: 'Foil', price: '10', section: 'weapons', is_active: false }
    expect(productInputSchema.safeParse(required).success).toBe(true)
    expect(productInputSchema.safeParse({ ...base, id: 1 }).success).toBe(false)
  })

  it('requires is_active to be a boolean', () => {
    expect(productInputSchema.safeParse({ ...base, is_active: 'true' }).success).toBe(false)
  })
})

describe('productIdSchema', () => {
  it('accepts positive integers only', () => {
    expect(productIdSchema.safeParse(3).success).toBe(true)
    expect(productIdSchema.safeParse(0).success).toBe(false)
    expect(productIdSchema.safeParse(1.5).success).toBe(false)
  })
})
