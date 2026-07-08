import { createClient } from '@/lib/supabase/server'
import type {
  Profile,
  ProfileUpdate,
  AdminProfileUpdate,
  MemberStatsRow,
  MemberListFilters,
  MembershipType,
} from '@/types/domain'

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

/**
 * Filtered + paginated members query. `count: 'exact'` makes PostgREST return
 * the total matching rows alongside the requested page in one round-trip.
 */
export async function getProfilesPage(
  filters: MemberListFilters,
  pageSize: number
): Promise<{ profiles: Profile[]; total: number }> {
  const supabase = await createClient()
  let query = supabase
    .from('profiles')
    .select('*, membership_type:membership_types(*)', { count: 'exact' })

  if (filters.search) {
    // Strip characters that have meaning in PostgREST's or() filter syntax.
    const term = filters.search.replace(/[,%()]/g, ' ').trim()
    if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
  }
  if (filters.role) query = query.eq('role', filters.role)
  if (filters.status) query = query.eq('is_active', filters.status === 'active')

  const from = (filters.page - 1) * pageSize
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (error || !data) return { profiles: [], total: 0 }
  return { profiles: data as Profile[], total: count ?? 0 }
}

export async function getMembershipTypes(): Promise<MembershipType[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('membership_types')
    .select('*')
    .eq('is_active', true)
    .order('monthly_fee', { ascending: true })

  if (error || !data) return []
  return data as MembershipType[]
}

/** Lean select used for dashboard stats — avoids pulling full profiles just to count them. */
export async function getMemberStatsRows(): Promise<MemberStatsRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('role, is_active, membership_type:membership_types(name)')

  if (error || !data) return []
  return data as unknown as MemberStatsRow[]
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
