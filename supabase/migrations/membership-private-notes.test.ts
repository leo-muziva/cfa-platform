import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./0010_membership_private_notes.sql', import.meta.url), 'utf8').toLowerCase()
const repository = readFileSync(new URL('../../lib/repositories/PlatformRepository.ts', import.meta.url), 'utf8')
const service = readFileSync(new URL('../../lib/services/PlatformService.ts', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../../app/actions/platform.ts', import.meta.url), 'utf8')
const decisionForm = readFileSync(new URL('../../components/portal/membership-decision-form.tsx', import.meta.url), 'utf8')

describe('membership application privacy and safe errors', () => {
  it('migrates private notes out of applicant-readable application rows', () => {
    const copyPosition = migration.indexOf('insert into public.membership_application_admin_notes')
    const dropPosition = migration.indexOf('alter table public.membership_applications drop column private_notes')

    expect(migration).toContain('create table public.membership_application_admin_notes')
    expect(migration).toContain('select id,trim(private_notes),reviewer_id,coalesce(reviewed_at,updated_at)')
    expect(copyPosition).toBeGreaterThan(-1)
    expect(dropPosition).toBeGreaterThan(copyPosition)
  })

  it('allows only administrators to select private notes', () => {
    expect(migration).toContain('alter table public.membership_application_admin_notes enable row level security')
    expect(migration).toContain('revoke all on public.membership_application_admin_notes from anon')
    expect(migration).toContain('for select to authenticated')
    expect(migration).toContain('using(public.current_user_is_admin())')
    expect(migration).not.toContain('applicant_id=auth.uid()')
  })

  it('preserves the review RPC contract and stores trimmed notes privately', () => {
    expect(migration).toContain('application_id uuid, decision text, visible_response text default null, private_notes text default null')
    expect(migration).toContain('select $1,trim($4),auth.uid()')
    expect(migration).toContain("where nullif(trim($4),'') is not null")
    expect(migration).toContain('on conflict on constraint membership_application_admin_notes_pkey do update set')
  })

  it('uses separate safe member and private admin repository queries', () => {
    const memberStart = repository.indexOf('export async function listMembershipRequestsForMember')
    const adminStart = repository.indexOf('export async function listMembershipRequestsForAdmin')
    const reviewStart = repository.indexOf('export async function reviewMembershipRequest')
    const memberListing = repository.slice(memberStart, adminStart)
    const adminListing = repository.slice(adminStart, reviewStart)

    expect(memberListing).toContain(".eq('applicant_id', applicantId)")
    expect(memberListing).not.toContain('private_notes')
    expect(adminListing).toContain('membership_application_admin_notes(private_notes)')
  })

  it('does not pass raw database errors through membership operations', () => {
    const membershipFlows = repository.slice(
      repository.indexOf('export async function createMembershipRequest'),
      repository.indexOf('export async function listFamilyLinks'),
    )

    expect(membershipFlows).not.toContain('error.message')
    expect(membershipFlows).toContain("membershipOperationResult(error, 'request_failed')")
    expect(membershipFlows).toContain("membershipOperationResult(error, 'review_failed')")
    expect(membershipFlows).toContain("membershipOperationResult(error, 'resubmit_failed')")
    expect(membershipFlows).toContain("membershipOperationResult(error, 'status_change_failed')")
    expect(service).toContain('membershipErrorMessages')
  })

  it('returns visible review state and refreshes both admin and member views', () => {
    expect(actions).toContain('export async function decideMembershipRequestAction(_: ActionState, formData: FormData): Promise<ActionState>')
    expect(actions).toContain("revalidatePath('/protected/admin/membership-requests')")
    expect(actions).toContain("revalidatePath('/protected')")
    expect(decisionForm).toContain('role="alert"')
    expect(decisionForm).toContain('role="status"')
  })
})
