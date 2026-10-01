import { describe, expect, it } from 'vitest'
import {
  advanceBulkOrderSchema,
  estimatedArrivalSchema,
  isValidBulkOrderTransition,
} from './bulk-order.schema'

const bulkOrderId = '00000000-0000-4000-8000-000000000001'

describe('isValidBulkOrderTransition', () => {
  it('allows each single forward step', () => {
    expect(isValidBulkOrderTransition('collecting', 'placed')).toBe(true)
    expect(isValidBulkOrderTransition('placed', 'shipping')).toBe(true)
    expect(isValidBulkOrderTransition('shipping', 'arrived')).toBe(true)
    expect(isValidBulkOrderTransition('arrived', 'distributed')).toBe(true)
  })

  it('allows cancelling from any non-final status', () => {
    for (const from of ['collecting', 'placed', 'shipping', 'arrived'] as const) {
      expect(isValidBulkOrderTransition(from, 'cancelled')).toBe(true)
    }
  })

  it('rejects skipping, going backwards, staying put and leaving final statuses', () => {
    expect(isValidBulkOrderTransition('collecting', 'shipping')).toBe(false)
    expect(isValidBulkOrderTransition('arrived', 'placed')).toBe(false)
    expect(isValidBulkOrderTransition('placed', 'placed')).toBe(false)
    expect(isValidBulkOrderTransition('placed', 'collecting')).toBe(false)
    expect(isValidBulkOrderTransition('distributed', 'cancelled')).toBe(false)
    expect(isValidBulkOrderTransition('cancelled', 'collecting')).toBe(false)
  })
})

describe('advanceBulkOrderSchema', () => {
  it('accepts a valid transition', () => {
    expect(advanceBulkOrderSchema.safeParse({ bulkOrderId, currentStatus: 'collecting', newStatus: 'placed' }).success).toBe(true)
  })

  it('rejects invalid ids, unknown statuses and invalid transitions', () => {
    expect(advanceBulkOrderSchema.safeParse({ bulkOrderId: 'nope', currentStatus: 'collecting', newStatus: 'placed' }).success).toBe(false)
    expect(advanceBulkOrderSchema.safeParse({ bulkOrderId, currentStatus: 'collecting', newStatus: 'lost' }).success).toBe(false)
    expect(advanceBulkOrderSchema.safeParse({ bulkOrderId, currentStatus: 'collecting', newStatus: 'arrived' }).success).toBe(false)
  })
})

describe('estimatedArrivalSchema', () => {
  it('accepts a YYYY-MM-DD date or an empty value', () => {
    expect(estimatedArrivalSchema.safeParse({ bulkOrderId, date: '2026-11-30' }).success).toBe(true)
    expect(estimatedArrivalSchema.safeParse({ bulkOrderId, date: '' }).success).toBe(true)
  })

  it('rejects other date formats and impossible dates', () => {
    expect(estimatedArrivalSchema.safeParse({ bulkOrderId, date: '30/11/2026' }).success).toBe(false)
    expect(estimatedArrivalSchema.safeParse({ bulkOrderId, date: '2026-02-30' }).success).toBe(false)
    expect(estimatedArrivalSchema.safeParse({ bulkOrderId: 'x', date: '' }).success).toBe(false)
  })
})
