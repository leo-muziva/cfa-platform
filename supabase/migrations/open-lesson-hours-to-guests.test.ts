import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./0046_open_lesson_hours_to_guests.sql', import.meta.url), 'utf8').toLowerCase()

describe('open lesson hours to guests migration', () => {
  it('opens every members-only standing hour to guests', () => {
    expect(sql).toContain("update public.coach_availability_rules set access_rule='guest_allowed'")
    expect(sql).toContain("where access_rule='active_members_only'")
  })

  it('records the bulk change only when something changed', () => {
    expect(sql).toContain('insert into public.audit_events')
    expect(sql).toContain("'lesson.availability_opened_to_guests'")
    expect(sql).toContain('having count(*)>0')
  })

  it('keeps the members-only feature so coaches can switch it back on', () => {
    expect(sql).not.toContain('drop column')
    expect(sql).not.toContain('create or replace function')
  })
})
