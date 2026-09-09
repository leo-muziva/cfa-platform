import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./0009_protected_booking_errors.sql', import.meta.url), 'utf8').toLowerCase()

describe('protected booking error migration', () => {
  it('locks the slot and checks duplicate bookings before capacity', () => {
    expect(sql).toContain('for update')
    expect(sql.indexOf("message='booking_duplicate'")).toBeLessThan(sql.indexOf("message='booking_full'"))
    expect(sql).toContain('where lesson_slot_id=slot.id and fencer_id=target_fencer')
  })

  it('keeps booking and charge creation in one database function', () => {
    expect(sql).toContain('insert into public.bookings')
    expect(sql).toContain('insert into public.charges')
  })
})
