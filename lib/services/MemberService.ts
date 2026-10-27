import 'server-only'
import { cache } from 'react'
import { validationFailure, type ValidationFailure } from '@/lib/validations/form-errors'

// Field names as the profile forms label them, for validation messages.
const PROFILE_FIELD_LABELS: Record<string, string> = {
  full_name: 'Full name',
  phone: 'Phone',
  date_of_birth: 'Date of birth',
  emergency_contact_name: 'Emergency contact',
  emergency_contact_phone: 'Emergency phone',
  terms_accepted: 'Terms and Conditions',
  privacy_accepted: 'Privacy notice',
  payer_consent: 'Payer consent',
}
import { createClient } from '@/lib/supabase/server'
import {
  getProfileById, updateProfile, getProfilesPage, adminUpdateProfile,
  getMemberStatsRows, getMembershipTypes, inviteMemberByEmail,
  getHouseholdMembership, getHouseholdMembers, completeProfile,
  getActiveBillingPayer,
} from '@/lib/repositories/MemberRepository'
import { getMembership, listActiveFamilyLinksForProfile } from '@/lib/repositories/PlatformRepository'
import {
  profileUpdateSchema, adminProfileUpdateSchema, memberListFiltersSchema, inviteMemberSchema, registrationDetailsSchema,
  reminderPreferenceAllowed,
} from '@/lib/validations/member.schema'
import { whatsAppRemindersAvailable } from '@/lib/providers/notification-providers'
import type {
  Profile, MemberStats, MemberStatsRow, MemberListFilters, MembershipType, Paged,
  Capabilities, HouseholdMember, FamilyLink,
} from '@/types/domain'

// The layout, header and page each ask who is signed in. cache() makes that
// one Supabase Auth round trip and one profile query per request; outside a
// server render (Server Actions, route handlers) it simply runs each time.
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ? getProfileById(user.id) : null
})

export async function requireAdmin(): Promise<{ profile: Profile } | { error: string }> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!profile.is_staff || profile.staff_type !== 'admin') return { error: 'Forbidden' }
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
    isDependent: !isPayer,
    canSeeHouseholdMoney: isPayer,
    canTriggerPayment: isPayer,
    canManageDependents: isPayer,
    canManageStaffArea: isAdmin,
  }
}

export const getCurrentAccountContext = cache(async (): Promise<
  { profile: Profile; household: HouseholdMember; householdMembers: HouseholdMember[]; capabilities: Capabilities } |
  { error: string }
> => {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  // Household and payer are independent lookups, so fetch them together.
  const [household, effectivePayerId] = await Promise.all([
    getHouseholdMembership(profile.id),
    getActiveBillingPayer(profile.id),
  ])
  if (!household) return { error: 'Household setup is incomplete' }
  if (!effectivePayerId) return { error: 'Billing responsibility is unavailable' }
  const householdMembers = await getHouseholdMembers(household.household_id)
  return { profile, household, householdMembers, capabilities: deriveCapabilities(profile, household, effectivePayerId) }
})

export async function requireStaff(): Promise<{ profile: Profile } | { error: string }> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!profile.is_staff) return { error: 'Forbidden' }
  return { profile }
}

export async function updateCurrentProfile(rawData: unknown): Promise<{ profile: Profile } | { error: string } | ValidationFailure> {
  const parsed = profileUpdateSchema.safeParse(rawData)
  if (!parsed.success) return validationFailure(parsed.error, PROFILE_FIELD_LABELS)
  if (!reminderPreferenceAllowed(parsed.data.reminder_preference, whatsAppRemindersAvailable())) {
    return { error: 'WhatsApp reminders are not available yet. Choose email.' }
  }
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }
  const updated = await updateProfile(profile.id, parsed.data)
  return updated ? { profile: updated } : { error: 'Failed to update profile' }
}

export async function completeCurrentProfile(rawData: unknown): Promise<{ profile: Profile } | { error: string } | ValidationFailure> {
  const parsed = registrationDetailsSchema.safeParse(rawData)
  if (!parsed.success) return validationFailure(parsed.error, PROFILE_FIELD_LABELS)
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
  { profile: Profile; membershipTypes: MembershipType[]; membership: Awaited<ReturnType<typeof getMembership>>; familyLinks: FamilyLink[]; isOwnRecord: boolean } | { error: string }
> {
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const profile = await getProfileById(targetId)
  if (!profile) return { error: 'Member not found' }
  const [membershipTypes, membership, familyLinks] = await Promise.all([
    getMembershipTypes(), getMembership(targetId), listActiveFamilyLinksForProfile(targetId),
  ])
  return { profile, membershipTypes, membership, familyLinks, isOwnRecord: guard.profile.id === targetId }
}

export const OWN_STAFF_ACCESS_MESSAGE = "You can't change your own staff access or deactivate your own account."

// An admin must not remove (or change) their own staff access, or deactivate
// themselves, or they could lock themselves out. Another admin can still do it.
export function changesOwnStaffAccess(
  actor: Pick<Profile, 'id' | 'is_staff' | 'staff_type' | 'is_active'>,
  targetId: string,
  input: { is_staff?: boolean; staff_type?: string | null; is_active?: boolean },
): boolean {
  if (actor.id !== targetId) return false
  // a field that wasn't sent isn't a change
  const isStaff = input.is_staff ?? actor.is_staff
  const staffType = input.staff_type === undefined ? actor.staff_type : input.staff_type
  const isActive = input.is_active ?? actor.is_active
  return isStaff !== actor.is_staff || staffType !== actor.staff_type || isActive !== actor.is_active
}

export async function adminUpdateMember(targetId: string, rawData: unknown): Promise<{ profile: Profile } | { error: string } | ValidationFailure> {
  const parsed = adminProfileUpdateSchema.safeParse(rawData)
  if (!parsed.success) return validationFailure(parsed.error, PROFILE_FIELD_LABELS)
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  if (changesOwnStaffAccess(guard.profile, targetId, parsed.data)) return { error: OWN_STAFF_ACCESS_MESSAGE }
  const profile = await adminUpdateProfile(targetId, parsed.data)
  return profile ? { profile } : { error: 'Failed to update member' }
}

export async function inviteMemberForAdmin(rawData: unknown): Promise<{ success: true } | { error: string }> {
  const parsed = inviteMemberSchema.safeParse(rawData)
  if (!parsed.success) return validationFailure(parsed.error)
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

