'use server'

// Server Actions for refunds, for payers and staff.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ActionState } from '@/app/actions/platform'
import { failureState } from '@/lib/validations/form-errors'
import {
  completeManualRefund, decideRefund, raiseRefundForPayer, requestRefund, resolveProcessingRefund,
  sendProviderRefund,
} from '@/lib/services/refund-service'

// Every page that shows refunds or the payments they come from.
const REFUND_PATHS = [
  '/protected/refunds', '/protected/billing', '/protected/shop/orders',
  '/protected/admin/refunds', '/protected/admin/payments',
]

// Refreshes every page in REFUND_PATHS.
function revalidateRefundPages() {
  for (const path of REFUND_PATHS) revalidatePath(path)
}

// A text form field, or undefined.
function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name)
  return typeof value === 'string' ? value : undefined
}

/** Payer requests a refund, then returns to the refunds page. */
export async function requestRefundAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await requestRefund({
    attemptId: field(formData, 'attemptId'), amount: field(formData, 'amount'), reason: field(formData, 'reason'),
  })
  if (!result.ok) return failureState(result)
  revalidateRefundPages()
  redirect('/protected/refunds?requested=1')
}

/** Staff raise a refund on a payer's behalf. */
export async function staffRaiseRefundAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await raiseRefundForPayer({
    attemptId: field(formData, 'attemptId'), amount: field(formData, 'amount'), reason: field(formData, 'reason'),
  })
  if (!result.ok) return failureState(result)
  revalidateRefundPages()
  return { success: 'Refund request raised' }
}

/** Staff approve or reject a refund. */
export async function decideRefundAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await decideRefund({
    refundId: field(formData, 'refundId'), decision: field(formData, 'decision'), method: field(formData, 'method'),
    note: field(formData, 'note'), amount: field(formData, 'amount'),
  })
  if (!result.ok) return failureState(result)
  revalidateRefundPages()
  return { success: result.data.decision === 'approve' ? 'Refund approved' : 'Refund rejected' }
}

/** Staff record that a bank transfer refund was paid. */
export async function completeManualRefundAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await completeManualRefund({
    refundId: field(formData, 'refundId'), reference: field(formData, 'reference'),
  })
  if (!result.ok) return failureState(result)
  revalidateRefundPages()
  return { success: result.data.alreadyProcessed ? 'Refund was already marked as paid' : 'Refund marked as paid' }
}

/** Staff send an approved refund back through PayFast. */
export async function sendProviderRefundAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await sendProviderRefund({ refundId: field(formData, 'refundId') })
  // Even an uncertain PayFast answer changes the refund to 'processing'.
  revalidateRefundPages()
  if (!result.ok) return failureState(result)
  if (result.data.status === 'failed') return { error: `PayFast rejected the refund: ${result.data.reason}` }
  return { success: 'Refund sent through PayFast' }
}

/** Staff record the outcome of a PayFast refund that was left unconfirmed. */
export async function resolveProcessingRefundAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await resolveProcessingRefund({
    refundId: field(formData, 'refundId'), outcome: field(formData, 'outcome'),
    reference: field(formData, 'reference'), note: field(formData, 'note'),
  })
  if (!result.ok) return failureState(result)
  revalidateRefundPages()
  return { success: result.data.outcome === 'processed' ? 'Refund recorded as paid' : 'Refund recorded as failed' }
}
