export type MembershipStatus = 'guest' | 'member'
export type MembershipLifecycleStatus = 'active' | 'suspended' | 'expired' | 'cancelled'
export type MembershipApplicationStatus = 'pending' | 'changes_requested' | 'rejected' | 'approved'
export type MembershipReviewDecision = 'approve' | 'request_changes' | 'reject'
export type MembershipOperationErrorCode =
  | 'request_failed'
  | 'review_failed'
  | 'resubmit_failed'
  | 'status_change_failed'
export type FamilyLinkStatus = 'pending' | 'active' | 'rejected' | 'ended'
export type LessonAccessRule = 'guest_allowed' | 'active_members_only'
export type HouseholdRole = 'payer' | 'dependent'
export type StaffType = 'admin' | 'coach'
export type PaymentPreference = 'manual' | 'recurring_card'
export type PaymentOption = 'pay_now' | 'pay_later'
export type MembershipRequestStatus = 'pending' | 'approved' | 'declined'
export type BookingStatus = 'upcoming' | 'attended' | 'cancelled'
export type ChargeType = 'lesson' | 'rental' | 'membership' | 'joining_fee'
export type FinancialStatus = 'unpaid' | 'paid' | 'overdue'

export interface MembershipType {
  id: string
  code: 'month_to_month' | 'six_month' | 'twelve_month' | 'beginner_package'
  name: string
  monthly_fee: number
  price: number
  term_months: number | null
  joining_fee: number
  description: string | null
  is_active: boolean
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  date_of_birth: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  membership_status: MembershipStatus
  membership_type_id: string | null
  membership_type?: Pick<MembershipType, 'id' | 'code' | 'name'> | null
  is_staff: boolean
  staff_type: StaffType | null
  is_active: boolean
  terms_accepted_at: string | null
  privacy_accepted_at: string | null
  profile_completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ProfileUpdate {
  full_name?: string
  phone?: string
  date_of_birth?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
}

export interface AdminProfileUpdate extends ProfileUpdate {
  is_active?: boolean
  is_staff?: boolean
  staff_type?: StaffType | null
}

export interface Membership {
  id: string
  profile_id: string
  membership_type_id: string
  status: MembershipLifecycleStatus
  started_at: string
  status_changed_at: string
  cancelled_at: string | null
  membership_type?: Pick<MembershipType, 'id' | 'code' | 'name'>
}

export interface MembershipApplication {
  id: string
  applicant_id: string
  membership_type_id: string
  version: number
  status: MembershipApplicationStatus
  submitted_details: { membership_type_id: string }
  visible_response: string | null
  reviewer_id: string | null
  reviewed_at: string | null
  created_at: string
  applicant?: Pick<Profile, 'id' | 'full_name' | 'email'>
  membership_type?: Pick<MembershipType, 'id' | 'name'>
}

export interface FamilyLink {
  id: string
  guardian_id: string
  dependent_id: string
  status: FamilyLinkStatus
  requested_by: string
  accepted_by: string | null
  requested_at: string
  accepted_at: string | null
  rejected_at: string | null
  ended_at: string | null
  guardian?: Pick<Profile, 'id' | 'full_name' | 'email'>
  dependent?: Pick<Profile, 'id' | 'full_name' | 'email'>
}

export interface DependentBillingLink {
  id: string
  household_id: string
  guardian_id: string
  dependent_id: string
  family_link_id: string
  effective_from: string
  effective_to: string | null
}

export interface AuditEvent {
  id: string
  event_type: string
  actor_id: string | null
  subject_profile_id: string | null
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Household {
  id: string
  payer_id: string
  membership_payment_method: PaymentPreference
  created_at: string
  updated_at: string
}

export interface HouseholdMember {
  household_id: string
  profile_id: string
  household_role: HouseholdRole
  payer_consent_at: string | null
  profile?: Pick<Profile, 'id' | 'full_name' | 'email' | 'membership_status'>
}

export interface MembershipRequest {
  id: string
  applicant_id: string
  membership_type_id: string
  status: MembershipRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  applicant?: Pick<Profile, 'id' | 'full_name' | 'email'>
  membership_type?: Pick<MembershipType, 'id' | 'name'>
}

export interface LessonSlot {
  id: string
  starts_at: string
  ends_at: string
  coach_id: string | null
  capacity: number | null
  price: number
  is_open: boolean
  access_rule: LessonAccessRule
  created_by: string
  created_at: string
}

export interface BookableLessonSlot extends LessonSlot {
  booked_count: number
  remaining_capacity: number | null
  is_full: boolean
}

export interface Booking {
  id: string
  lesson_slot_id: string
  booked_by_id: string
  fencer_id: string
  payment_option: PaymentOption
  status: BookingStatus
  created_at: string
  lesson_slot?: LessonSlot
  fencer?: Pick<Profile, 'id' | 'full_name'>
}

export interface AdminMembershipApplication extends MembershipApplication {
  private_notes: string | null
}

export type BookingErrorCode =
  | 'duplicate'
  | 'unavailable'
  | 'full'
  | 'unauthorized_participant'
  | 'membership_required'
  | 'invalid_payment'
  | 'invalid_input'
  | 'unexpected'

export interface Charge {
  id: string
  fencer_id: string
  payer_id: string
  booking_id: string | null
  type: ChargeType
  amount: number
  status: 'unpaid' | 'paid'
  period: string
  description: string
  created_at: string
  paid_at: string | null
}

export interface InvoiceLine {
  id: string
  invoice_id: string
  charge_id: string
  participant_id: string
  participant?: Pick<Profile, 'id' | 'full_name'>
  description: string
  amount: number
}

export interface Invoice {
  id: string
  payer_id: string
  period: string
  invoice_number: string
  status: FinancialStatus
  total: number
  payment_link: string | null
  issued_at: string
  paid_at: string | null
  lines?: InvoiceLine[]
}

export interface Receipt {
  id: string
  payer_id: string
  invoice_id: string | null
  receipt_number: string
  amount: number
  issued_at: string
}

export interface PaymentAttempt {
  id: string
  payer_id: string
  invoice_id: string | null
  provider: string | null
  provider_reference: string | null
  status: 'pending' | 'succeeded' | 'failed'
  amount: number
  created_at: string
  completed_at: string | null
}

export interface ProviderEvent {
  id: string
  provider: string
  provider_event_id: string
  event_type: string
  processed_at: string | null
  created_at: string
}

export interface Capabilities {
  isAdmin: boolean
  isCoach: boolean
  isPayer: boolean
  isDependent: boolean
  canSeeHouseholdMoney: boolean
  canTriggerPayment: boolean
  canManageDependents: boolean
  canManageStaffArea: boolean
}

export interface MemberListFilters {
  search?: string
  membershipStatus?: MembershipStatus
  staffType?: StaffType
  status?: 'active' | 'inactive'
  page: number
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export interface MemberStatsRow {
  membership_status: MembershipStatus
  is_staff: boolean
  staff_type: StaffType | null
  is_active: boolean
  membership_type: Pick<MembershipType, 'name'> | null
}

export interface MemberStats {
  total: number
  active: number
  inactive: number
  guests: number
  members: number
  admins: number
  coaches: number
  byMembershipType: Record<string, number>
  unassigned: number
}

/** Safe lesson-history DTO. It intentionally has no monetary fields. */
export interface LessonHistoryItem {
  id: string
  starts_at: string
  ends_at: string
  status: BookingStatus
  fencer_id: string
  fencer_name: string | null
}

export interface PayerBillingView {
  balance: number
  outstandingCharges: OutstandingCharge[]
  creditTotal: number
  invoices: Invoice[]
  receipts: Receipt[]
  pendingLessonCharges: PendingLessonCharge[]
  paymentPreference: PaymentPreference
  providerAvailable: boolean
}

export interface OutstandingCharge {
  id: string
  participantName: string
  amount: number
  label: string
  finalizedAt: string | null
}

export interface PendingLessonCharge {
  id: string
  participantName: string
  amount: number
  description: string
  lessonStartsAt: string | null
}

export type Weapon = 'foil' | 'epee' | 'sabre'

export type LessonBookingStatus =
  | 'scheduled'
  | 'attended'
  | 'no_show'
  | 'cancelled'
  | 'rescheduled'

export interface LessonCoachSummary {
  coachId: string
  fullName: string
  weapons: Weapon[]
}

export interface AvailableLessonTime {
  startsAt: string
  endsAt: string
}

/** Pricing is deliberately isolated from availability and booking DTOs. */
export interface LessonQuote {
  participantCount: 1 | 2
  totalCents: number
  currency: 'ZAR'
}

export interface LessonParticipant {
  id: string
  fullName: string
  isSelf?: boolean
}

/** Financially safe lesson DTO for members, dependents, coaches, and admins. */
export interface LessonBooking {
  id: string
  coachId: string
  coachName: string
  startsAt: string
  endsAt: string
  weapon: Weapon
  status: LessonBookingStatus
  participants: LessonParticipant[]
  cancellationDeadline?: string | null
  cancelledAt: string | null
  cancellationReason: string | null
  rescheduledFromBookingId: string | null
  rescheduledToBookingId: string | null
}

export interface CoachAvailabilityRule {
  id: string
  coachId: string
  isoWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7
  startsAtLocal: string
  endsAtLocal: string
  isActive: boolean
}

export interface CoachAvailabilityException {
  id: string
  coachId: string
  exceptionType: 'block' | 'extra'
  startsAt: string
  endsAt: string
  reason: string | null
}

export interface ClubClosure {
  id: string
  startsOn: string
  endsOn: string
  reason: string
  cancelledAt: string | null
  affectedBookingCount?: number
}

/** Money-free preview row returned before an admin confirms a closure. */
export interface ClosureAffectedBooking {
  bookingId: string
  coachId: string
  startsAt: string
  participantNames: string[]
}

export interface LessonBookingSettings {
  cancellationWindowHours: number
  lateCancellationAction: 'allow'
  lateCancellationFeeMultiplier: number
  noShowFeeMultiplier: number
  bookingHorizonDays: number
  bookingCutoffMinutes: number
  paymentMode: 'invoice_only'
  arrearsBlockingEnabled: false
  futureBookingCapPerFencer: null
  coachAssignmentMode: 'any_matching_weapon'
  coachWeaponsMode: 'per_coach'
  singleLessonPriceCents: number
  externalRemindersEnabled: boolean
  doubleLessonMultiplier: 2
  doubleLessonAtomic: true
  closureMode: 'club_wide_date_ranges'
  lessonDurationMinutes: 30
  updatedAt: string
}

export interface CoachLessonProfile {
  coachId: string
  fullName: string
  isActive: boolean
  weapons: Weapon[]
}

export interface LessonActivityItem {
  id: string
  eventType: string
  actorId: string | null
  bookingId: string | null
  createdAt: string
  metadata: Record<string, unknown>
}

export type LessonBookingErrorCode =
  | 'not_authenticated'
  | 'account_incomplete'
  | 'invalid_input'
  | 'invalid_participants'
  | 'participant_unauthorized'
  | 'mixed_payers'
  | 'slot_taken'
  | 'booking_not_scheduled'
  | 'booking_already_started'
  | 'invalid_actor_type'
  | 'invalid_outcome'
  | 'outcome_not_allowed'
  | 'forbidden'
  | 'locked_setting'
  | 'invalid_settings'
  | 'invalid_coach'
  | 'invalid_weapon'
  | 'invalid_exception'
  | 'affected_bookings_require_confirmation'
  | 'invalid_closure'
  | 'waiver_reason_required'
  | 'not_found'
  | 'request_failed'

export type LessonBookingResult<T> =
  | { success: true; data: T }
  | { success: false; errorCode: LessonBookingErrorCode; error: string }
