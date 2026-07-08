import { createClient } from '@/lib/supabase/server'
import {
  getProfileById,
  updateProfile,
  getProfilesPage,
  adminUpdateProfile,
  getMemberStatsRows,
  getMembershipTypes,
  inviteMemberByEmail,
} from '@/lib/repositories/MemberRepository'
import {
  profileUpdateSchema,
  adminProfileUpdateSchema,
  memberListFiltersSchema,
  inviteMemberSchema,
} from '@/lib/validations/member.schema'
import type {
  Profile,
  MemberStats,
  MemberStatsRow,
  MemberListFilters,
  MembershipType,
  Paged,
  Role,
} from '@/types/domain'

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return getProfileById(user.id)
}

/**
 * Early-exit guard shared by all admin-only service functions.
 * The DB's RLS policies remain the real security boundary.
 */
async function requireAdmin(): Promise<{ profile: Profile } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const profile = await getProfileById(user.id)
  if (!profile || profile.role !== 'admin') return { error: 'Forbidden' }

  return { profile }
}

export async function updateCurrentProfile(rawData: unknown): Promise<
  { profile: Profile } | { error: string }
> {
  const parsed = profileUpdateSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const profile = await updateProfile(user.id, parsed.data)
  if (!profile) return { error: 'Failed to update profile' }

  return { profile }
}

const MEMBERS_PAGE_SIZE = 20

export async function getMembersForAdmin(rawFilters: unknown = {}): Promise<
  { page: Paged<Profile>; filters: MemberListFilters } | { error: string }
> {
  const guard = await requireAdmin()
  if ('error' in guard) return guard

  // Every schema field has a catch(), so parsing raw URL params never throws.
  const filters = memberListFiltersSchema.parse(rawFilters)
  const { profiles, total } = await getProfilesPage(filters, MEMBERS_PAGE_SIZE)

  return {
    page: {
      items: profiles,
      total,
      page: filters.page,
      pageSize: MEMBERS_PAGE_SIZE,
      pageCount: Math.max(1, Math.ceil(total / MEMBERS_PAGE_SIZE)),
    },
    filters,
  }
}

/** Membership types for the admin invite form. */
export async function getInviteFormDataForAdmin(): Promise<
  { membershipTypes: MembershipType[] } | { error: string }
> {
  const guard = await requireAdmin()
  if ('error' in guard) return guard

  return { membershipTypes: await getMembershipTypes() }
}

/** Everything the admin member-edit screen needs in one call. */
export async function getMemberEditDataForAdmin(targetId: string): Promise<
  { profile: Profile; membershipTypes: MembershipType[] } | { error: string }
> {
  const guard = await requireAdmin()
  if ('error' in guard) return guard

  const profile = await getProfileById(targetId)
  if (!profile) return { error: 'Member not found' }

  const membershipTypes = await getMembershipTypes()
  return { profile, membershipTypes }
}

export async function adminUpdateMember(targetId: string, rawData: unknown): Promise<
  { profile: Profile } | { error: string }
> {
  const parsed = adminProfileUpdateSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const guard = await requireAdmin()
  if ('error' in guard) return guard

  const profile = await adminUpdateProfile(targetId, parsed.data)
  if (!profile) return { error: 'Failed to update member' }

  return { profile }
}

/**
 * Invites a new member by email. The auth invite auto-creates the profile
 * (via trigger) with the default 'fencer' role; a follow-up update applies
 * the chosen role/membership when they differ from the defaults.
 */
export async function inviteMemberForAdmin(rawData: unknown): Promise<
  { success: true } | { error: string }
> {
  const parsed = inviteMemberSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const guard = await requireAdmin()
  if ('error' in guard) return guard

  const invited = await inviteMemberByEmail(parsed.data.email, parsed.data.full_name)
  if ('error' in invited) return invited

  if (parsed.data.role !== 'fencer' || parsed.data.membership_type_id) {
    const updated = await adminUpdateProfile(invited.userId, {
      role: parsed.data.role,
      membership_type_id: parsed.data.membership_type_id ?? null,
    })
    if (!updated) {
      return { error: 'Invite sent, but assigning role/membership failed — edit the member manually' }
    }
  }

  return { success: true }
}

const ALL_ROLES: Role[] = ['admin', 'coach', 'fencer', 'guardian']

/**
 * Pure aggregation over stats rows — exported separately so it can be
 * unit-tested without touching Supabase.
 */
export function aggregateMemberStats(rows: MemberStatsRow[]): MemberStats {
  const byRole = Object.fromEntries(ALL_ROLES.map((r) => [r, 0])) as Record<Role, number>
  const byMembershipType: Record<string, number> = {}
  let active = 0
  let unassigned = 0

  for (const row of rows) {
    byRole[row.role] += 1
    if (row.is_active) active += 1
    if (row.membership_type) {
      byMembershipType[row.membership_type.name] =
        (byMembershipType[row.membership_type.name] ?? 0) + 1
    } else {
      unassigned += 1
    }
  }

  return {
    total: rows.length,
    active,
    inactive: rows.length - active,
    byRole,
    byMembershipType,
    unassigned,
  }
}

export async function getMemberStatsForAdmin(): Promise<
  { stats: MemberStats } | { error: string }
> {
  const guard = await requireAdmin()
  if ('error' in guard) return guard

  const rows = await getMemberStatsRows()
  return { stats: aggregateMemberStats(rows) }
}
