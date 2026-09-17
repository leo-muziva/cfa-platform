import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./0013_equipment_assigned_member.sql', import.meta.url), 'utf8').toLowerCase()

describe('equipment holder names', () => {
  it('exposes names through a security definer function, not a widened profiles policy', () => {
    expect(migration).toContain('create or replace function public.equipment_member_options()')
    expect(migration).toContain('security definer set search_path = public')
    // Widening profiles for everyone is exactly what this avoids.
    expect(migration).not.toContain('create policy')
    expect(migration).not.toContain('on public.profiles')
  })

  it('answers only staff, and only with an id and a display name', () => {
    expect(migration).toContain('public.current_user_is_coach_or_admin()')
    expect(migration).toContain('returns table(id uuid, full_name text)')
    // Checked on the body rather than the whole file, so prose in the comments
    // above it cannot make this pass or fail.
    const body = migration.slice(migration.indexOf('as $$'), migration.indexOf('$$;'))
    for (const column of ['email', 'phone', 'date_of_birth', 'emergency']) {
      expect(body).not.toContain(column)
    }
  })

  it('keeps the function off the public role', () => {
    expect(migration).toContain('revoke all on function public.equipment_member_options() from public')
    expect(migration).toContain('grant execute on function public.equipment_member_options() to authenticated')
  })
})
