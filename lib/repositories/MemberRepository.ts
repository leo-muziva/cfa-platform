import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

/**
 * Sends a Supabase Auth invite email. Creating the auth user fires the
 * handle_new_user trigger, which auto-creates the profile row (with
 * full_name from the metadata). Returns the new user's id.
 */
export async function inviteMemberByEmail(
  email: string,
  fullName: string
): Promise<{ userId: string } | { error: string }> {
  const admin = createAdminClient()
  if (!admin) return { error: 'Invites are not configured on this server' }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${siteUrl}/auth/confirm?next=/auth/update-password`,
  })

  if (error) {
    // Surface the common case in plain words; keep the rest generic.
    if (error.message.toLowerCase().includes('already')) {
      return { error: 'A user with this email already exists' }
    }
    return { error: 'Failed to send invite' }
  }
  return { userId: data.user.id }
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
