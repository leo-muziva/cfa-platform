import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./0003_cfa_platform_foundation.sql', import.meta.url), 'utf8')

describe('CFA foundation migration security invariants', () => {
  it('blocks self-service mutation of every authorization field', () => {
    for (const field of ['email', 'role', 'is_active', 'membership_status', 'membership_type_id', 'is_staff', 'staff_type']) {
      expect(sql).toContain(`new.${field} is distinct from old.${field}`)
    }
  })

  it('keeps charge payer and fencer references separate and mandatory', () => {
    expect(sql).toMatch(/fencer_id uuid not null references public\.profiles/)
    expect(sql).toMatch(/payer_id uuid not null references public\.profiles/)
  })

  it('limits household financial reads to payer or admin', () => {
    for (const table of ['charges', 'invoices', 'receipts', 'payment attempts']) {
      expect(sql).toContain(`payer or admin reads ${table}`)
    }
  })

  it('invoices pay-later lessons and excludes pay-now lessons', () => {
    expect(sql).toContain("c.type='lesson' and b.payment_option='pay_later'")
  })

  it('uses idempotency constraints for invoices and provider events', () => {
    expect(sql).toContain('unique (payer_id, period)')
    expect(sql).toContain('unique(provider, provider_event_id)')
  })
})
