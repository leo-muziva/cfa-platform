import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const requireAdmin = vi.fn()
const getCurrentAccountContext = vi.fn()
vi.mock('@/lib/services/MemberService', () => ({
  requireAdmin: () => requireAdmin(),
  requireStaff: () => requireAdmin(),
  getCurrentAccountContext: () => getCurrentAccountContext(),
  getCurrentProfile: vi.fn(),
}))

const getMembershipTypes = vi.fn()
vi.mock('@/lib/repositories/MemberRepository', () => ({ getMembershipTypes: () => getMembershipTypes() }))

const repo = {
  reviewMembershipRequest: vi.fn(),
  getMembershipPaymentNotice: vi.fn(),
  recordMembershipPaymentEmail: vi.fn(),
  listMembershipPaymentsDue: vi.fn(),
  listMembershipRequestsForMember: vi.fn(),
  getMembership: vi.fn(),
}
vi.mock('@/lib/repositories/PlatformRepository', () => ({
  reviewMembershipRequest: (...args: unknown[]) => repo.reviewMembershipRequest(...args),
  getMembershipPaymentNotice: (...args: unknown[]) => repo.getMembershipPaymentNotice(...args),
  recordMembershipPaymentEmail: (...args: unknown[]) => repo.recordMembershipPaymentEmail(...args),
  listMembershipPaymentsDue: () => repo.listMembershipPaymentsDue(),
  listMembershipRequestsForMember: (...args: unknown[]) => repo.listMembershipRequestsForMember(...args),
  getMembership: (...args: unknown[]) => repo.getMembership(...args),
}))

const sendMembershipPaymentRequest = vi.fn()
const getEmailProvider = vi.fn()
vi.mock('@/lib/providers/contracts', () => ({ getEmailProvider: () => getEmailProvider() }))
vi.mock('@/lib/services/payment-service', () => ({ onlinePaymentsAvailable: () => true }))

import { decideMembershipRequest, getMembershipRequestPageData, membershipPayUrl } from './PlatformService'

const applicationId = '44444444-4444-4444-8444-444444444444'
const notice = {
  applicationId, applicantId: 'dependent-1', applicantName: 'Alex Fencer', payerId: 'guardian-1',
  payerName: 'Sam Guardian', payerEmail: 'guardian@example.test', membershipName: 'Month-to-month', totalCents: '90000',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://cfa.example')
  requireAdmin.mockResolvedValue({ profile: { id: 'admin-1' } })
  repo.reviewMembershipRequest.mockResolvedValue({ success: true })
  repo.getMembershipPaymentNotice.mockResolvedValue(notice)
  repo.recordMembershipPaymentEmail.mockResolvedValue(true)
  getEmailProvider.mockReturnValue({ sendMembershipPaymentRequest })
  sendMembershipPaymentRequest.mockResolvedValue({ ok: true })
})

describe('decideMembershipRequest', () => {
  it('emails the payer a portal link after approval and records it', async () => {
    const result = await decideMembershipRequest({ application_id: applicationId, decision: 'approve' })
    expect(result).toEqual({ success: true, emailStatus: 'sent' })
    expect(sendMembershipPaymentRequest).toHaveBeenCalledWith(expect.objectContaining({
      to: 'guardian@example.test',
      recipientIsApplicant: false,
      amountCents: '90000',
      payUrl: 'https://cfa.example/protected/billing',
    }))
    expect(repo.recordMembershipPaymentEmail).toHaveBeenCalledWith(applicationId, 'sent')
  })

  it('keeps the approval when the email fails', async () => {
    sendMembershipPaymentRequest.mockResolvedValue({ ok: false, error: 'Resend responded with 500' })
    expect(await decideMembershipRequest({ application_id: applicationId, decision: 'approve' }))
      .toEqual({ success: true, emailStatus: 'failed' })
    expect(repo.recordMembershipPaymentEmail).toHaveBeenCalledWith(applicationId, 'failed')
  })

  it('records that email is not configured instead of failing', async () => {
    getEmailProvider.mockReturnValue(null)
    expect(await decideMembershipRequest({ application_id: applicationId, decision: 'approve' }))
      .toEqual({ success: true, emailStatus: 'not_configured' })
    expect(sendMembershipPaymentRequest).not.toHaveBeenCalled()
  })

  it('sends nothing for other decisions or failed reviews', async () => {
    expect(await decideMembershipRequest({ application_id: applicationId, decision: 'reject' }))
      .toEqual({ success: true, emailStatus: null })
    repo.reviewMembershipRequest.mockResolvedValue({ errorCode: 'review_failed' })
    expect(await decideMembershipRequest({ application_id: applicationId, decision: 'approve' }))
      .toEqual({ error: 'Unable to update this membership request. Please try again.' })
    expect(sendMembershipPaymentRequest).not.toHaveBeenCalled()
  })

  it('sends one payment email when approve is clicked twice', async () => {
    // the database only approves a pending application once
    repo.reviewMembershipRequest.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ errorCode: 'already_reviewed' })
    const [first, second] = await Promise.all([
      decideMembershipRequest({ application_id: applicationId, decision: 'approve' }),
      decideMembershipRequest({ application_id: applicationId, decision: 'approve' }),
    ])
    expect(first).toEqual({ success: true, emailStatus: 'sent' })
    expect(second).toEqual({ error: expect.stringContaining('already been decided') })
    expect(sendMembershipPaymentRequest).toHaveBeenCalledOnce()
    expect(repo.recordMembershipPaymentEmail).toHaveBeenCalledOnce()
  })

  it('refuses non-admins before reviewing', async () => {
    requireAdmin.mockResolvedValue({ error: 'Forbidden' })
    expect(await decideMembershipRequest({ application_id: applicationId, decision: 'approve' })).toEqual({ error: 'Forbidden' })
    expect(repo.reviewMembershipRequest).not.toHaveBeenCalled()
  })
})

describe('membershipPayUrl', () => {
  it('sends applicants to Membership and guardians to Billing', () => {
    expect(membershipPayUrl('https://cfa.example', true)).toBe('https://cfa.example/protected/membership')
    expect(membershipPayUrl('https://cfa.example/', false)).toBe('https://cfa.example/protected/billing')
  })
})

describe('getMembershipRequestPageData', () => {
  beforeEach(() => {
    getMembershipTypes.mockResolvedValue([{ id: 'type-1', code: 'month_to_month', name: 'Month-to-month', price: 550, term_months: 1, joining_fee: 350 }])
    repo.listMembershipRequestsForMember.mockResolvedValue([])
    repo.getMembership.mockResolvedValue(null)
  })

  it('gives dependents no prices or amounts due', async () => {
    getCurrentAccountContext.mockResolvedValue({ profile: { id: 'dependent-1' }, capabilities: { canSeeHouseholdMoney: false } })
    const data = await getMembershipRequestPageData()
    expect(data).toMatchObject({ canSeeMoney: false, ownPaymentDue: null, dependentPaymentsDue: [] })
    expect('membershipTypes' in data && data.membershipTypes).toEqual([{ id: 'type-1', code: 'month_to_month', name: 'Month-to-month', priceLabel: null }])
    expect(repo.listMembershipPaymentsDue).not.toHaveBeenCalled()
  })

  it('splits a payer\'s own payment from the dependents they pay for', async () => {
    getCurrentAccountContext.mockResolvedValue({ profile: { id: 'guardian-1' }, capabilities: { canSeeHouseholdMoney: true } })
    const own = { applicationId: 'a1', applicantId: 'guardian-1', totalCents: '90000' }
    const dependent = { applicationId: 'a2', applicantId: 'dependent-1', totalCents: '55000' }
    repo.listMembershipPaymentsDue.mockResolvedValue([own, dependent])
    const data = await getMembershipRequestPageData()
    expect(data).toMatchObject({ ownPaymentDue: own, dependentPaymentsDue: [dependent] })
    expect('membershipTypes' in data && data.membershipTypes?.[0].priceLabel).toBe('R550 + R350 joining fee')
  })
})
