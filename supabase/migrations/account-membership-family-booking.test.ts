import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('./0005_account_membership_family_booking.sql', import.meta.url), 'utf8').toLowerCase()

describe('account, membership, family billing and booking migration', () => {
  it('adds independent and versioned membership records', () => {
    expect(sql).toContain('create table public.memberships')
    expect(sql).toContain('create table public.membership_applications')
    expect(sql).toContain('unique(applicant_id,version)')
    expect(sql).toContain("status in ('active','suspended','expired','cancelled')")
  })

  it('migrates legacy members and household relationships without rewriting ledger rows', () => {
    expect(sql).toContain("p.membership_status='member'")
    expect(sql).toContain("hm.household_role='dependent'")
    expect(sql).not.toMatch(/update public\.(charges|invoices|receipts|payment_attempts)\s+set/)
  })

  it('prevents family self-links and multiple active billing guardians', () => {
    expect(sql).toContain('check (guardian_id <> dependent_id)')
    expect(sql).toContain('create unique index one_active_billing_guardian')
    expect(sql).toContain("where status in ('pending','active')")
  })

  it('checks the participant membership and derives the payer in the booking transaction', () => {
    expect(sql).toContain("slot.access_rule='active_members_only'")
    expect(sql).toContain('profile_id=target_fencer')
    expect(sql).toContain('payer:=public.active_billing_payer(target_fencer)')
  })

  it('makes recurring membership charges idempotent and audits lifecycle events', () => {
    expect(sql).toContain('create unique index one_monthly_membership_charge')
    expect(sql).toContain('create table public.audit_events')
    expect(sql).toContain("'membership.status_changed'")
    expect(sql).toContain("'family.link_ended'")
  })
})
