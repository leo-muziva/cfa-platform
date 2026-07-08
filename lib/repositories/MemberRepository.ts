import { createClient } from '@/lib/supabase/server'
import type { Profile, ProfileUpdate, AdminProfileUpdate } from '@/types/domain'

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*, membership_type:membership_types(*)')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data as Profile
}

export async function updateProfile(id: string, updates: ProfileUpdate): Promise<Profile | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select('*, membership_type:membership_types(*)')
    .single()

  if (error || !data) return null
  return data as Profile
}

export async function getAllProfiles(): Promise<Profile[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*, membership_type:membership_types(*)')
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as Profile[]
}

export async function adminUpdateProfile(id: string, updates: AdminProfileUpdate): Promise<Profile | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select('*, membership_type:membership_types(*)')
    .single()

  if (error || !data) return null
  return data as Profile
}
