import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  Profile, ProfileUpdate, AdminProfileUpdate, MemberStatsRow, MemberListFilters,
  MembershipType, HouseholdMember,
} from '@/types/domain'

const PROFILE_SELECT = `
  id,email,full_name,phone,date_of_birth,emergency_contact_name,emergency_contact_phone,
  membership_status,membership_type_id,is_staff,staff_type,is_active,terms_accepted_at,
  privacy_accepted_at,profile_completed_at,created_at,updated_at,
  membership_type:membership_types(id,code,name)
`

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('profiles').select(PROFILE_SELECT).eq('id', id).single()
  if (error || !data) return null
  return data as unknown as Profile
}

export async function updateProfile(id: string, updates: ProfileUpdate): Promise<Profile | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select(PROFILE_SELECT).single()
  if (error || !data) return null
  return data as unknown as Profile
}

export async function completeProfile(id: string, updates: ProfileUpdate): Promise<Profile | null> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('profiles').update({
    ...updates, terms_accepted_at: now, privacy_accepted_at: now, profile_completed_at: now,
  }).eq('id', id).select(PROFILE_SELECT).single()
  return error ? null : data as unknown as Profile
}

export async function getHouseholdMembership(profileId: string): Promise<HouseholdMember | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('household_members')
    .select('household_id,profile_id,household_role,payer_consent_at').eq('profile_id', profileId).single()
  return error ? null : data as HouseholdMember
}

export async function getHouseholdMembers(): Promise<HouseholdMember[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('household_members').select(`
    household_id,profile_id,household_role,payer_consent_at,
    profile:profiles!household_members_profile_id_fkey(id,full_name,email,membership_status)
  `).order('created_at')
  return error ? [] : data as unknown as HouseholdMember[]
}

export async function getActiveBillingPayer(profileId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('active_billing_payer', { target_participant: profileId })
  return error || typeof data !== 'string' ? null : data
}

export async function getProfilesPage(filters: MemberListFilters, pageSize: number) {
  const supabase = await createClient()
  let query = supabase.from('profiles').select(PROFILE_SELECT, { count: 'exact' })
  if (filters.search) {
    const term = filters.search.replace(/[,%()]/g, ' ').trim()
    if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
  }
  if (filters.membershipStatus) query = query.eq('membership_status', filters.membershipStatus)
  if (filters.staffType) query = query.eq('staff_type', filters.staffType)
  if (filters.status) query = query.eq('is_active', filters.status === 'active')
  const from = (filters.page - 1) * pageSize
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1)
  if (error || !data) return { profiles: [] as Profile[], total: 0 }
  return { profiles: data as unknown as Profile[], total: count ?? 0 }
}

export async function inviteMemberByEmail(
  email: string,
  fullName: string,
  isStaff: boolean,
  staffType: "admin" | "coach" | null,
) {
  const admin = createAdminClient()
  if (!admin) return { error: 'Invites are not configured on this server' } as const
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      cfa_is_staff: isStaff,
      cfa_staff_type: isStaff ? staffType ?? 'coach' : null,
    },
    redirectTo: `${siteUrl}/auth/update-password`,
  })
  if (error) return { error: error.message.toLowerCase().includes('already') ? 'A user with this email already exists' : 'Failed to send invite' } as const
  return { userId: data.user.id }
}

export async function getMembershipTypes(): Promise<MembershipType[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('membership_types')
    .select('id,code,name,monthly_fee,price,term_months,joining_fee,description,is_active,created_at')
    .eq('is_active', true).order('price')
  return error ? [] : data as MembershipType[]
}

export async function getMemberStatsRows(): Promise<MemberStatsRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('profiles')
    .select('membership_status,is_staff,staff_type,is_active,membership_type:membership_types(name)')
  return error ? [] : data as unknown as MemberStatsRow[]
}

export async function adminUpdateProfile(id: string, updates: AdminProfileUpdate): Promise<Profile | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select(PROFILE_SELECT).single()
  return error ? null : data as unknown as Profile
}

export async function attachDependent(profileId: string, payerId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('attach_dependent', { target_profile: profileId, target_payer: payerId })
  return error ? { error: error.message } : { success: true as const }
}
