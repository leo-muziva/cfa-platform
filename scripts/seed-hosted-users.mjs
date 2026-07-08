/**
 * Seeds the four test accounts on a HOSTED Supabase project.
 *
 * Local Supabase can insert straight into auth.users (see supabase/seed.sql),
 * but hosted projects must go through the Auth Admin API. This script creates
 * the users (auto-confirmed) and applies the same roles/phones/memberships as
 * the SQL seed. Safe to re-run: existing users are updated, not duplicated.
 *
 * Usage:  node scripts/seed-hosted-users.mjs
 * Needs:  NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY in .env.local
 */
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

nextEnv.loadEnvConfig(process.cwd())

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!url || !secretKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_PASSWORD = 'Test1234!'

const USERS = [
  { email: 'admin@cfa.test', full_name: 'Alice Admin', role: 'admin', phone: '+27 21 000 0001' },
  { email: 'coach@cfa.test', full_name: 'Charles Coach', role: 'coach', phone: '+27 21 000 0002', membership: 'Senior' },
  { email: 'fencer@cfa.test', full_name: 'Fiona Fencer', role: 'fencer', phone: '+27 21 000 0003', date_of_birth: '2005-03-15', membership: 'Junior' },
  { email: 'guardian@cfa.test', full_name: 'George Guardian', role: 'guardian', phone: '+27 21 000 0004' },
]

async function findUserIdByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return null
  return data.users.find((u) => u.email === email)?.id ?? null
}

async function membershipTypeId(name) {
  if (!name) return null
  const { data } = await admin.from('membership_types').select('id').eq('name', name).single()
  return data?.id ?? null
}

for (const user of USERS) {
  let userId

  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: TEST_PASSWORD,
    email_confirm: true, // no confirmation email for test accounts
    user_metadata: { full_name: user.full_name },
  })

  if (error) {
    userId = await findUserIdByEmail(user.email)
    if (!userId) {
      console.error(`✗ ${user.email}: ${error.message}`)
      continue
    }
    console.log(`• ${user.email} already exists — updating profile`)
  } else {
    userId = data.user.id
    console.log(`✓ created ${user.email}`)
  }

  // The handle_new_user trigger has created the profile; apply seed details.
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      role: user.role,
      full_name: user.full_name,
      phone: user.phone,
      date_of_birth: user.date_of_birth ?? null,
      is_active: true,
      membership_type_id: await membershipTypeId(user.membership),
    })
    .eq('id', userId)

  if (profileError) {
    console.error(`✗ ${user.email} profile update failed: ${profileError.message}`)
  } else {
    console.log(`  profile set: ${user.role}${user.membership ? ` · ${user.membership}` : ''}`)
  }
}

console.log('\nDone. All test accounts use the password from supabase/seed.sql.')
