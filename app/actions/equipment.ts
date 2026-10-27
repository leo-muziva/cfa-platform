'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  createEquipmentItem, editEquipmentItem, removeEquipmentItem,
} from '@/lib/services/EquipmentService'

export type EquipmentActionState = { error?: string; success?: string }

const REGISTER_PATH = '/protected/equipment'

const itemFields = (formData: FormData) => ({
  type_id: String(formData.get('type_id') ?? ''),
  code: String(formData.get('code') ?? ''),
  hand: String(formData.get('hand') ?? ''),
  size: String(formData.get('size') ?? ''),
  condition: String(formData.get('condition') ?? ''),
  status: String(formData.get('status') ?? ''),
  notes: String(formData.get('notes') ?? ''),
  assigned_to: String(formData.get('assigned_to') ?? ''),
})

export async function createEquipmentItemAction(
  _prevState: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const result = await createEquipmentItem(itemFields(formData))
  if ('error' in result) return { error: result.error }
  revalidatePath(REGISTER_PATH)
  redirect(`${REGISTER_PATH}?added=${encodeURIComponent(result.item.code)}`)
}

export async function updateEquipmentItemAction(
  _prevState: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const itemId = String(formData.get('item_id') ?? '')
  if (!itemId) return { error: 'Missing item id' }

  const result = await editEquipmentItem(itemId, itemFields(formData))
  if ('error' in result) return { error: result.error }
  revalidatePath(REGISTER_PATH)
  revalidatePath(`${REGISTER_PATH}/${itemId}`)
  return { success: `${result.item.code} saved.` }
}

export async function deleteEquipmentItemAction(
  _prevState: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const itemId = String(formData.get('item_id') ?? '')
  if (!itemId) return { error: 'Missing item id' }

  const result = await removeEquipmentItem(itemId)
  if ('error' in result) return { error: result.error }
  revalidatePath(REGISTER_PATH)
  // The code only feeds the confirmation line on the register, which checks it
  // looks like a real code before showing it.
  const code = String(formData.get('code') ?? '')
  redirect(code ? `${REGISTER_PATH}?removed=${encodeURIComponent(code)}` : REGISTER_PATH)
}
