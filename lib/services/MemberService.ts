import { createClient } from '@/lib/supabase/server'
import {
  getProfileById,
  updateProfile,
  getAllProfiles,
  adminUpdateProfile,
  getMemberStatsRows,
} from '@/lib/repositories/MemberRepository'
import { profileUpdateSchema, adminProfileUpdateSchema } from '@/lib/validations/member.schema'
import type { Profile, MemberStats, MemberStatsRow, Role } from '@/types/domain'

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

export async function getMembersForAdmin(): Promise<
  { profiles: Profile[] } | { error: string }
> {
  const guard = await requireAdmin()
  if ('error' in guard) return guard

  const profiles = await getAllProfiles()
  return { profiles }
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
