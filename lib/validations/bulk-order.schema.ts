// Zod schemas for staff bulk-order actions, plus the rules for which status
// a bulk order may move to next.
import { z } from 'zod'

// collecting: taking paid shop orders. placed: sent to the supplier.
// shipping and arrived: on the way and received. distributed: handed out.
export const bulkOrderStatusSchema = z.enum([
  'collecting', 'placed', 'shipping', 'arrived', 'distributed', 'cancelled',
])

export type BulkOrderStatus = z.infer<typeof bulkOrderStatusSchema>

// The one step forward from each status. distributed and cancelled are final.
export const NEXT_BULK_ORDER_STATUS: Record<BulkOrderStatus, BulkOrderStatus | null> = {
  collecting: 'placed',
  placed: 'shipping',
  shipping: 'arrived',
  arrived: 'distributed',
  distributed: null,
  cancelled: null,
}

/** True for distributed and cancelled, which cannot change again. */
export function isTerminalBulkOrderStatus(status: BulkOrderStatus): boolean {
  return NEXT_BULK_ORDER_STATUS[status] === null
}

// Allowed moves: one step forward, or cancel from any non-final status.
export function isValidBulkOrderTransition(from: BulkOrderStatus, to: BulkOrderStatus): boolean {
  if (isTerminalBulkOrderStatus(from)) return false
  return to === 'cancelled' || NEXT_BULK_ORDER_STATUS[from] === to
}

export const bulkOrderIdSchema = z.uuid('Invalid bulk order.')

// The current status is sent too so a stale page cannot skip a step.
export const advanceBulkOrderSchema = z.object({
  bulkOrderId: bulkOrderIdSchema,
  currentStatus: bulkOrderStatusSchema,
  newStatus: bulkOrderStatusSchema,
}).strict().refine((value) => isValidBulkOrderTransition(value.currentStatus, value.newStatus), {
  message: 'That status change is not allowed.',
  path: ['newStatus'],
})

// An empty date clears the estimate.
export const estimatedArrivalSchema = z.object({
  bulkOrderId: bulkOrderIdSchema,
  date: z.union([z.literal(''), z.iso.date('Use a date in YYYY-MM-DD format.')]),
}).strict()
