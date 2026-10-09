import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { EquipmentItem, EquipmentMemberOption, EquipmentType } from '@/types/domain'
import type { EquipmentItemInput } from '@/lib/validations/equipment.schema'

const EQUIPMENT_TYPE_SELECT = 'id,name,code_prefix,category,requires_size,requires_hand,sort_order'

const EQUIPMENT_SELECT = `
  id,type_id,code,hand,size,condition,status,notes,assigned_to,created_at,updated_at,
  equipment_type:equipment_types(${EQUIPMENT_TYPE_SELECT})
`

export type EquipmentWriteResult =
  | { item: EquipmentItem }
  | { error: 'duplicate_code' | 'write_failed' }

export async function listEquipmentTypes(): Promise<EquipmentType[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('equipment_types').select(EQUIPMENT_TYPE_SELECT).order('sort_order')
  return error || !data ? [] : data as EquipmentType[]
}

export async function getEquipmentTypeById(id: string): Promise<EquipmentType | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('equipment_types').select(EQUIPMENT_TYPE_SELECT).eq('id', id).single()
  return error || !data ? null : data as EquipmentType
}

// Goes through the RPC rather than selecting profiles: coaches have no read
// policy on that table, so a direct join would come back empty for them.
export async function listEquipmentMemberOptions(): Promise<EquipmentMemberOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('equipment_member_options')
  return error || !data ? [] : data as EquipmentMemberOption[]
}

export async function listEquipmentItems(): Promise<EquipmentItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('equipment_items').select(EQUIPMENT_SELECT).order('code')
  return error || !data ? [] : data as unknown as EquipmentItem[]
}

export async function getEquipmentItemById(id: string): Promise<EquipmentItem | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('equipment_items').select(EQUIPMENT_SELECT).eq('id', id).single()
  return error || !data ? null : data as unknown as EquipmentItem
}

// A unique-violation is the one database error worth telling apart: two people
// adding the same type at once both get offered the same suggested code.
const writeResult = (
  data: unknown, error: { code?: string } | null,
): EquipmentWriteResult => {
  if (error) return { error: error.code === '23505' ? 'duplicate_code' : 'write_failed' }
  return data ? { item: data as EquipmentItem } : { error: 'write_failed' }
}

export async function insertEquipmentItem(input: EquipmentItemInput): Promise<EquipmentWriteResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('equipment_items').insert(input).select(EQUIPMENT_SELECT).single()
  return writeResult(data, error)
}

export async function updateEquipmentItem(id: string, input: EquipmentItemInput): Promise<EquipmentWriteResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('equipment_items').update(input).eq('id', id).select(EQUIPMENT_SELECT).single()
  return writeResult(data, error)
}

/** A delete blocked by RLS comes back as a success with no rows, so the
 *  deleted row is selected back rather than trusting the absence of an error. */
export async function deleteEquipmentItem(id: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('equipment_items').delete().eq('id', id).select('id')
  return !error && (data?.length ?? 0) > 0
}
