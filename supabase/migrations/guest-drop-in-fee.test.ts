import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./0047_guest_drop_in_fee.sql', import.meta.url), 'utf8').toLowerCase()

describe('guest drop-in fee migration', () => {
  it('keeps the amount on the settings singleton, defaulting to R120', () => {
    expect(sql).toContain('add column drop_in_fee_cents bigint not null default 12000 check (drop_in_fee_cents >= 0)')
    expect(sql).toContain("drop_in_fee_cents=coalesce((settings_patch->>'drop_in_fee_cents')::bigint,drop_in_fee_cents)")
  })

  it('allows drop_in charges alongside the existing charge types', () => {
    expect(sql).toContain("'lesson', 'rental', 'membership', 'joining_fee', 'lesson_adjustment', 'shop', 'drop_in'")
  })

  it('charges guests only, once per cape town day, ignoring voided fees', () => {
    expect(sql).toContain("where p.membership_status='guest'")
    expect(sql).toContain("v_local_date:=(target_starts_at at time zone 'africa/johannesburg')::date")
    expect(sql).toContain("c.type='drop_in' and c.lifecycle_state not in ('voided','waived')")
    expect(sql).toContain("(b.starts_at at time zone 'africa/johannesburg')::date=v_local_date")
    expect(sql).toContain('if v_settings.drop_in_fee_cents>0 then')
  })

  it('serialises same-day bookings for a guest before checking for an existing fee', () => {
    const lock = sql.indexOf("pg_advisory_xact_lock(hashtextextended('drop-in/'")
    expect(lock).toBeGreaterThan(-1)
    expect(lock).toBeLessThan(sql.indexOf("c.type='drop_in'"))
  })

  it('adds the fee as a provisional charge on the booking so pay-now checkout includes it', () => {
    expect(sql).toContain("v_booking,'drop_in'")
    expect(sql).toContain("'drop-in fee','provisional'")
    expect(sql).toContain("'lesson.drop_in_fee_charged'")
  })

  it('still enforces the existing pay-now and settings rules', () => {
    expect(sql).toContain("message='pay_now_required'")
    expect(sql).toContain("message='locked_setting'")
  })
})

describe('guest drop-in fee lookup', () => {
  it('lets signed-in users read only the fee, not the whole settings row', () => {
    expect(sql).toContain('create function public.get_drop_in_fee_cents() returns bigint')
    expect(sql).toContain('revoke all on function public.get_drop_in_fee_cents() from public,anon')
    expect(sql).toContain('grant execute on function public.get_drop_in_fee_cents() to authenticated')
  })
})
