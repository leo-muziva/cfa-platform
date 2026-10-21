import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./0055_refund_drop_in_fee.sql', import.meta.url), 'utf8').toLowerCase()

describe('drop-in fee refund migration', () => {
  it('runs on every cancel and reschedule of a scheduled lesson', () => {
    expect(sql).toContain('after update of status on public.bookings')
    expect(sql).toContain("when (old.status='scheduled' and new.status in ('cancelled','rescheduled'))")
  })

  it('refunds through the same policy as lesson fees', () => {
    expect(sql).toContain("perform public.apply_lesson_charge_policy(c.id,0,'drop-in fee refund')")
    expect(sql).toContain("'lesson.drop_in_fee_refunded'")
  })

  it('keeps the fee once per day by moving it to another lesson that day', () => {
    expect(sql).toContain("b.status='scheduled' and b.payment_state is distinct from 'expired'")
    expect(sql).toContain('v_other:=new.rescheduled_to_booking_id')
    expect(sql).toContain('update public.charges set booking_id=v_other')
    expect(sql).toContain("'lesson.drop_in_fee_moved'")
  })

  it('skips fees that are already voided, such as expired holds', () => {
    expect(sql).toContain("type='drop_in' and lifecycle_state not in ('voided','waived') for update")
  })

  it('cannot be called directly', () => {
    expect(sql).toContain('revoke all on function public.release_drop_in_fees() from public,anon,authenticated')
  })
})
