// Shared types used across pages, services and repositories. snake_case
// interfaces mirror database rows as Supabase returns them; camelCase ones
// are shaped by a repository for the UI. DTO types meant for dependents or
// coaches deliberately leave out money fields.

// guest: has an account but no membership. member: has a paid membership.
export type MembershipStatus = 'guest' | 'member'
// Status of a membership after it has started.
export type MembershipLifecycleStatus = 'active' | 'suspended' | 'expired' | 'cancelled'
// pending -> approved by staff -> awaiting_payment -> approved once paid.
// Staff can also ask for changes or reject.
export type MembershipApplicationStatus = 'pending' | 'changes_requested' | 'awaiting_payment' | 'rejected' | 'approved'
export type MembershipPaymentEmailStatus = 'sent' | 'failed' | 'not_configured'
export type MembershipReviewDecision = 'approve' | 'request_changes' | 'reject'
export type MembershipOperationErrorCode =
  | 'request_failed'
  | 'review_failed'
  | 'resubmit_failed'
  | 'status_change_failed'
  | 'payment_record_failed'
  | 'withdraw_failed'
// A guardian/dependent link between two existing accounts.
export type FamilyLinkStatus = 'pending' | 'active' | 'rejected' | 'ended'
// Whether guests may book a time, or only active members.
export type LessonAccessRule = 'guest_allowed' | 'active_members_only'
// The payer pays for everyone in the household; dependents never see money.
export type HouseholdRole = 'payer' | 'dependent'
export type StaffType = 'admin' | 'coach'
export type PaymentPreference = 'manual' | 'recurring_card'
export type PaymentOption = 'pay_now' | 'pay_later'
export type ReminderPreference = 'email' | 'whatsapp' | 'both'
// Legacy membership request flow, replaced by MembershipApplication.
export type MembershipRequestStatus = 'pending' | 'approved' | 'declined'
// Status of a legacy slot booking.
export type BookingStatus = 'upcoming' | 'attended' | 'cancelled'
// What a charge on the payer's account is for.
export type ChargeType = 'lesson' | 'rental' | 'membership' | 'joining_fee' | 'lesson_adjustment' | 'shop' | 'drop_in'
// 'submitted' is historical: orders placed before pay-now checkout existed.
export type OrderStatus = 'draft' | 'pending_payment' | 'paid' | 'submitted' | 'cancelled' | 'refunded'
export type Handedness = 'right' | 'left'
// Payment status of an invoice.
export type FinancialStatus = 'unpaid' | 'paid' | 'overdue'

// A membership product. Amounts are in rands.
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

// A person's account details from the profiles table. Staff rights come from
// is_staff and staff_type. profile_completed_at is set once sign-up details
// are filled in, which unlocks the portal.
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
  reminder_preference: ReminderPreference
  created_at: string
  updated_at: string
}

// Fields a member may change on their own profile.
export interface ProfileUpdate {
  full_name?: string
  phone?: string
  date_of_birth?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  reminder_preference?: ReminderPreference
}

// Fields an admin may also change on someone else's profile.
export interface AdminProfileUpdate extends ProfileUpdate {
  is_active?: boolean
  is_staff?: boolean
  staff_type?: StaffType | null
}

// A started membership for one profile.
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

// One application for a membership. `version` goes up each time the
// applicant resubmits after staff ask for changes.
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
  payment_email_status: MembershipPaymentEmailStatus | null
  payment_email_at: string | null
  applicant?: Pick<Profile, 'id' | 'full_name' | 'email'>
  membership_type?: Pick<MembershipType, 'id' | 'name'>
}

/** An approved application the signed-in payer still has to pay. Payers only. */
export interface MembershipPaymentDue {
  applicationId: string
  applicantId: string
  applicantName: string
  membershipName: string
  membershipCents: string
  joiningFeeCents: string
  totalCents: string
  approvedAt: string | null
}

// A guardian/dependent link. The guardian becomes the dependent's payer.
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

// Mirrors the dependent billing link table. Not used by app code yet.
export interface DependentBillingLink {
  id: string
  household_id: string
  guardian_id: string
  dependent_id: string
  family_link_id: string
  effective_from: string
  effective_to: string | null
}

// Mirrors the audit_events table. Not used by app code yet.
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

// A household and its paying account.
export interface Household {
  id: string
  payer_id: string
  membership_payment_method: PaymentPreference
  created_at: string
  updated_at: string
}

// A profile's place in a household.
export interface HouseholdMember {
  household_id: string
  profile_id: string
  household_role: HouseholdRole
  payer_consent_at: string | null
  profile?: Pick<Profile, 'id' | 'full_name' | 'email' | 'membership_status'>
}

// Legacy membership request row. Not used by app code.
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

// Legacy slot booking types (see PlatformService). Lesson booking now uses
// the LessonBooking types further down.
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

// An application with the private staff notes. Admins only.
export interface AdminMembershipApplication extends MembershipApplication {
  private_notes: string | null
}

// Error codes for legacy slot booking.
export type BookingErrorCode =
  | 'duplicate'
  | 'unavailable'
  | 'full'
  | 'unauthorized_participant'
  | 'membership_required'
  | 'invalid_payment'
  | 'invalid_input'
  | 'unexpected'

// Billing rows. Amounts are in rands as stored in numeric columns.
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
  payer?: Pick<Profile, 'full_name' | 'email'> | null
}

export interface Receipt {
  id: string
  payer_id: string
  invoice_id: string | null
  receipt_number: string
  amount: number
  issued_at: string
}

// Mirrors payment rows. Not used by app code yet; the payment flow uses the
// row types in payment-repository.ts.
export interface PaymentAttempt {
  id: string
  payer_id: string
  invoice_id: string | null
  order_id: string | null
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

// What the signed-in person may do. Worked out by deriveCapabilities in
// MemberService. Hiding a button is not security: services and RLS check again.
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

// Admin member list filters, from the URL.
export interface MemberListFilters {
  search?: string
  membershipStatus?: MembershipStatus
  staffType?: StaffType
  status?: 'active' | 'inactive'
  page: number
}

// One page of results plus totals for pagination.
export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

// Profile columns the admin dashboard counts are built from.
export interface MemberStatsRow {
  membership_status: MembershipStatus
  is_staff: boolean
  staff_type: StaffType | null
  is_active: boolean
  membership_type: Pick<MembershipType, 'name'> | null
}

// Counts shown on the admin dashboard.
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

// The payer's billing page. Amounts are in rands.
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

// Lesson booking types. Times are ISO strings; cents are strings so large
// values keep their precision.
export type Weapon = 'foil' | 'epee' | 'sabre'

export type LessonBookingStatus =
  | 'scheduled'
  | 'attended'
  | 'no_show'
  | 'cancelled'
  | 'rescheduled'

// A bookable coach and the weapons they teach.
export interface LessonCoachSummary {
  coachId: string
  fullName: string
  weapons: Weapon[]
}

export interface AvailableLessonTime {
  startsAt: string
  endsAt: string
}

/** A coach-offered 30-minute occurrence, with availability intentionally reason-free. */
export interface LessonTimeOption extends AvailableLessonTime {
  isAvailable: boolean
  /** Coach marked these standing hours for active members only. */
  membersOnly?: boolean
}

/** Pricing is deliberately isolated from availability and booking DTOs. */
export interface LessonQuote {
  participantCount: 1 | 2
  totalCents: string
  currency: 'ZAR'
}

/** Payer-only booking warning. It deliberately contains no balance or amount. */
export interface LessonArrearsWarning {
  shouldWarn: boolean
}

/** Staff-finance-only record. Never add this to coach or dependent DTOs. */
export interface LessonBookingAllocation {
  id: string
  bookingId: string
  participantId: string
  coachId: string
  productCode: 'standard_30' | 'intro' | 'beginner_package'
  coachPayableCents: string
  clubAllocationCents: string
  status: 'pending' | 'payable' | 'voided'
}

// Someone the signed-in person can book a lesson for.
export interface LessonParticipant {
  id: string
  fullName: string
  isSelf?: boolean
  membershipStatus?: MembershipStatus
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
  /** True while a pay-now hold is live. Money-free, so dependents may see it. */
  awaitingPayment?: boolean
  holdExpiresAt?: string | null
  /** After this time a cancellation costs partialFeePercent of the lesson. */
  partialFeeDeadline?: string | null
  partialFeePercent?: number | null
  /** Fee share inside the partial window. Percentages only, never amounts. */
  lateFeePercent?: number | null
}

/** Payer-only row for a pay-now lesson whose hold can still be paid. */
export interface PayableLessonHold {
  bookingId: string
  coachName: string
  startsAt: string
  weapon: Weapon
  participantNames: string[]
  amountCents: string
  holdExpiresAt: string
}

// A weekly repeating window when a coach teaches, in local time.
export interface CoachAvailabilityRule {
  id: string
  coachId: string
  isoWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7
  startsAtLocal: string
  endsAtLocal: string
  isActive: boolean
  accessRule: LessonAccessRule
}

// A one-off change to a coach's week: "block" removes time, "extra" adds it.
export interface CoachAvailabilityException {
  id: string
  coachId: string
  exceptionType: 'block' | 'extra'
  startsAt: string
  endsAt: string
  reason: string | null
}

// Dates when the whole club is closed and no lessons run.
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

// Lesson rules from lesson_booking_settings. Fields typed as a single literal
// are fixed in this build and not stored in the database.
export interface LessonBookingSettings {
  cancellationWindowHours: number
  lateCancellationAction: 'allow'
  lateCancellationFeeMultiplier: number
  cancellationPartialWindowHours: number
  cancellationPartialFeeMultiplier: number
  noShowFeeMultiplier: number
  bookingHorizonDays: number
  bookingHorizonCalendarMonths: number
  bookingCutoffMinutes: number
  paymentMode: 'invoice_only'
  arrearsBlockingEnabled: false
  futureBookingCapPerFencer: null
  coachAssignmentMode: 'any_matching_weapon'
  coachWeaponsMode: 'per_coach'
  singleLessonPriceCents: number
  dropInFeeCents: number
  externalRemindersEnabled: boolean
  doubleLessonMultiplier: 2
  doubleLessonAtomic: true
  closureMode: 'club_wide_date_ranges'
  lessonDurationMinutes: 30
  updatedAt: string
}

// Whether a coach takes bookings, and for which weapons.
export interface CoachLessonProfile {
  coachId: string
  fullName: string
  isActive: boolean
  weapons: Weapon[]
}

// One lesson audit event for the admin activity feed.
export interface LessonActivityItem {
  id: string
  eventType: string
  actorId: string | null
  bookingId: string | null
  createdAt: string
  metadata: Record<string, unknown>
}

// Every error a lesson operation can return. LessonBookingRepository maps
// each code to a user-facing message.
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
  | 'pay_now_required'
  | 'members_only'
  | 'entitlement_unavailable'
  | 'invalid_product'
  | 'checkout_unavailable'
  | 'payments_unavailable'
  | 'not_found'
  | 'request_failed'

// Result of every lesson booking operation.
export type LessonBookingResult<T> =
  | { success: true; data: T }
  | { success: false; errorCode: LessonBookingErrorCode; error: string; fieldErrors?: Record<string, string> }

// Shop cart types. Money is in cents.
export interface ShopCartLine {
  id: string
  productId: number
  itemCode: string
  name: string
  imagePath: string | null
  size: string | null
  handedness: Handedness | null
  quantity: number
  unitPriceCents: number
}

export interface ShopCart {
  orderId: string
  status: Extract<OrderStatus, 'draft' | 'pending_payment'>
  notes: string | null
  lines: ShopCartLine[]
  totalCents: number
}

// requested -> approved -> processing -> processed, or rejected/failed.
export type RefundStatus = 'requested' | 'approved' | 'rejected' | 'processing' | 'processed' | 'failed'
// manual_bank: staff pay by bank transfer. provider: refunded through PayFast.
export type RefundMethod = 'manual_bank' | 'provider'
export type PaymentKind = 'booking' | 'order' | 'membership' | 'invoice'

// A settled payment and how much of it can still be refunded.
export interface RefundablePayment {
  attemptId: string
  payerId: string
  payerName: string
  kind: PaymentKind
  provider: string | null
  amountCents: number
  refundableCents: number
  completedAt: string | null
  receiptNumber: string | null
  orderId: string | null
  invoiceNumber: string | null
}

// A refund request as shown to payers and staff. Money is in cents.
export interface RefundRequest {
  id: string
  refundNumber: string
  paymentAttemptId: string
  payerId: string
  payerName: string
  kind: PaymentKind
  paymentAmountCents: number
  refundableCents: number
  amountCents: number
  reason: string
  status: RefundStatus
  method: RefundMethod | null
  decisionNote: string | null
  externalReference: string | null
  failureReason: string | null
  provider: string | null
  hasProviderPayment: boolean
  createdAt: string
  decidedAt: string | null
  processedAt: string | null
}

/**
 * Validation details a Server Action form state can carry. `fieldErrors` comes
 * from the server; `values` and `submission` are filled in on the client after
 * a failed submit so valid input survives React's form reset.
 */
export interface FormFieldState {
  error?: string
  fieldErrors?: Record<string, string>
  values?: Record<string, string[]>
  submission?: number
}
