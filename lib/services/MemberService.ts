import { createClient } from '@/lib/supabase/server'
import {
  getProfileById,
  updateProfile,
  getAllProfiles,
  adminUpdateProfile,
} from '@/lib/repositories/MemberRepository'
import { profileUpdateSchema, adminProfileUpdateSchema } from '@/lib/validations/member.schema'
import type { Profile } from '@/types/domain'

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return getProfileById(user.id)
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const currentProfile = await getProfileById(user.id)
  if (!currentProfile || currentProfile.role !== 'admin') {
    return { error: 'Forbidden' }
  }

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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const currentProfile = await getProfileById(user.id)
  if (!currentProfile || currentProfile.role !== 'admin') {
    return { error: 'Forbidden' }
  }

  const profile = await adminUpdateProfile(targetId, parsed.data)
  if (!profile) return { error: 'Failed to update member' }

  return { profile }
}
