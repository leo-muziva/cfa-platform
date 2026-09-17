import 'server-only'
import { createClient } from '@/lib/supabase/server'
import {
  getProfileById, updateProfile, getProfilesPage, adminUpdateProfile,
  getMemberStatsRows, getMembershipTypes, inviteMemberByEmail,
  getHouseholdMembership, getHouseholdMembers, completeProfile, attachDependent,
  getActiveBillingPayer,
} from '@/lib/repositories/MemberRepository'
import { getMembership } from '@/lib/repositories/PlatformRepository'
import {
  profileUpdateSchema, adminProfileUpdateSchema, memberListFiltersSchema, inviteMemberSchema, registrationDetailsSchema,
} from '@/lib/validations/member.schema'
import type {
  Profile, MemberStats, MemberStatsRow, MemberListFilters, MembershipType, Paged,
  Capabilities, HouseholdMember,
} from '@/types/domain'

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ? getProfileById(user.id) : null
}

export async function requireAdmin(): Promise<{ profile: Profile } | { error: string }> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!profile.is_staff || profile.staff_type !== 'admin') return { error: 'Forbidden' }
  return { profile }
}

// Matches the SQL predicate current_user_is_coach_or_admin() used by the
// equipment register's RLS policies. LessonBookingService has its own private
// copy of this rule with a different result shape; the two want collapsing into
// one helper, but booking code is owned by another branch.
export async function requireCoachOrAdmin(): Promise<{ profile: Profile } | { error: string }> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!profile.is_staff || !['admin', 'coach'].includes(profile.staff_type ?? '')) return { error: 'Forbidden' }
  return { profile }
}

export function deriveCapabilities(profile: Profile, household: HouseholdMember, effectivePayerId: string | null): Capabilities {
  const isAdmin = profile.is_staff && profile.staff_type === 'admin'
  const isCoach = profile.is_staff && profile.staff_type === 'coach'
  const isPayer = effectivePayerId === profile.id
  void household
  return {
    isAdmin,
    isCoach,
    isPayer,
    isDependent: !isAdmin && !isPayer,
    canSeeHouseholdMoney: isAdmin || (isPayer && !isCoach),
    canTriggerPayment: isAdmin || (isPayer && !isCoach),
    canManageDependents: isPayer || isAdmin,
    canManageStaffArea: isAdmin,
    canManageEquipment: isAdmin || isCoach,
  }
}

export async function getCurrentAccountContext(): Promise<
  { profile: Profile; household: HouseholdMember; householdMembers: HouseholdMember[]; capabilities: Capabilities } |
  { error: string }
> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  const household = await getHouseholdMembership(profile.id)
  if (!household) return { error: 'Household setup is incomplete' }
  const effectivePayerId = await getActiveBillingPayer(profile.id)
  if (!effectivePayerId) return { error: 'Billing responsibility is unavailable' }
  const householdMembers = await getHouseholdMembers()
  return { profile, household, householdMembers, capabilities: deriveCapabilities(profile, household, effectivePayerId) }
}

export async function updateCurrentProfile(rawData: unknown): Promise<{ profile: Profile } | { error: string }> {
  const parsed = profileUpdateSchema.safeParse(rawData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  const updated = await updateProfile(profile.id, parsed.data)
  return updated ? { profile: updated } : { error: 'Failed to update profile' }
}

export async function completeCurrentProfile(rawData: unknown): Promise<{ profile: Profile } | { error: string }> {
  const parsed = registrationDetailsSchema.safeParse(rawData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  const details = {
    full_name: parsed.data.full_name,
    phone: parsed.data.phone,
    date_of_birth: parsed.data.date_of_birth,
    emergency_contact_name: parsed.data.emergency_contact_name,
    emergency_contact_phone: parsed.data.emergency_contact_phone,
  }
  const updated = await completeProfile(profile.id, details)
  return updated ? { profile: updated } : { error: 'Failed to complete profile' }
}

const MEMBERS_PAGE_SIZE = 20

export async function getMembersForAdmin(rawFilters: unknown = {}): Promise<
  { page: Paged<Profile>; filters: MemberListFilters } | { error: string }
> {
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const filters = memberListFiltersSchema.parse(rawFilters)
  const { profiles, total } = await getProfilesPage(filters, MEMBERS_PAGE_SIZE)
  return { page: { items: profiles, total, page: filters.page, pageSize: MEMBERS_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / MEMBERS_PAGE_SIZE)) }, filters }
}

export async function getInviteFormDataForAdmin(): Promise<{ membershipTypes: MembershipType[] } | { error: string }> {
  const guard = await requireAdmin()
  return 'error' in guard ? guard : { membershipTypes: await getMembershipTypes() }
}

export async function getMemberEditDataForAdmin(targetId: string): Promise<
  { profile: Profile; membershipTypes: MembershipType[]; membership: Awaited<ReturnType<typeof getMembership>> } | { error: string }
> {
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const profile = await getProfileById(targetId)
  return profile ? { profile, membershipTypes: await getMembershipTypes(), membership: await getMembership(targetId) } : { error: 'Member not found' }
}

export async function adminUpdateMember(targetId: string, rawData: unknown): Promise<{ profile: Profile } | { error: string }> {
  const parsed = adminProfileUpdateSchema.safeParse(rawData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const profile = await adminUpdateProfile(targetId, parsed.data)
  return profile ? { profile } : { error: 'Failed to update member' }
}

export async function inviteMemberForAdmin(rawData: unknown): Promise<{ success: true } | { error: string }> {
  const parsed = inviteMemberSchema.safeParse(rawData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const invited = await inviteMemberByEmail(
    parsed.data.email,
    parsed.data.full_name,
    parsed.data.is_staff,
    parsed.data.is_staff ? parsed.data.staff_type ?? 'coach' : null,
  )
  if (typeof invited.userId !== 'string') return { error: invited.error ?? 'Failed to send invite' }
  return { success: true }
}

export function aggregateMemberStats(rows: MemberStatsRow[]): MemberStats {
  const byMembershipType: Record<string, number> = {}
  let active = 0, guests = 0, members = 0, admins = 0, coaches = 0, unassigned = 0
  for (const row of rows) {
    if (row.is_active) active++
    if (row.membership_status === 'guest') guests++; else members++
    if (row.staff_type === 'admin') admins++
    if (row.staff_type === 'coach') coaches++
    if (row.membership_type) byMembershipType[row.membership_type.name] = (byMembershipType[row.membership_type.name] ?? 0) + 1
    else unassigned++
  }
  return { total: rows.length, active, inactive: rows.length - active, guests, members, admins, coaches, byMembershipType, unassigned }
}

export async function getMemberStatsForAdmin(): Promise<{ stats: MemberStats } | { error: string }> {
  const guard = await requireAdmin()
  return 'error' in guard ? guard : { stats: aggregateMemberStats(await getMemberStatsRows()) }
}

export async function getHouseholdAdminData() {
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const { profiles } = await getProfilesPage({ page: 1 }, 1000)
  return { profiles, memberships: await getHouseholdMembers() }
}

export async function attachDependentForAdmin(profileId: string, payerId: string) {
  const guard = await requireAdmin()
  return 'error' in guard ? guard : attachDependent(profileId, payerId)
}
