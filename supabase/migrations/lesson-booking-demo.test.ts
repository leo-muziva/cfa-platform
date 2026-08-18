import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("./0011_lesson_booking_demo.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("lesson booking demo migration", () => {
  it("defines the single authoritative invoice-only configuration", () => {
    expect(sql).toContain("create table public.lesson_booking_settings");
    expect(sql).toContain("single_lesson_price_cents integer not null default 30000");
    expect(sql).toContain("payment_mode text not null default 'invoice_only'");
    expect(sql).toContain("lesson_duration_minutes integer not null default 30");
    expect(sql).toContain("primary key default true check (singleton)");
  });

  it("models recurring coach offerings, exceptions, and inclusive closures", () => {
    for (const table of [
      "coach_lesson_profiles",
      "coach_lesson_weapons",
      "coach_availability_rules",
      "coach_availability_exceptions",
      "club_closures",
      "closure_affected_bookings",
    ]) expect(sql).toContain(`create table public.${table}`);
    expect(sql).toContain("iso_weekday smallint not null check (iso_weekday between 1 and 7)");
    expect(sql).toContain("between c.starts_on and c.ends_on");
  });

  it("generates aligned Cape Town 30-minute occurrences", () => {
    expect(sql).toContain("at time zone 'africa/johannesburg'");
    expect(sql).toContain("g.slot_number*b.lesson_duration_minutes");
    expect(sql).toContain("mod(extract(epoch from (l.local_start::time-r.starts_at_local)),l.lesson_duration_minutes*60)=0");
    expect(sql).toContain("(now() at time zone 'africa/johannesburg')::date");
    expect(sql).toContain("and target_starts_at < l.horizon_end");
    expect(sql).toMatch(/as horizon_end,\s+cfg\.\* from cfg/);
  });

  it("supports one or two participants and one charge per participant", () => {
    expect(sql).toContain("create table public.booking_participants");
    expect(sql).toContain("check (ordinal in (1,2))");
    expect(sql).toContain("create unique index one_lesson_charge_per_booking_participant");
    expect(sql).toContain("raise exception using message='mixed_payers'");
    expect(sql).toContain("v_payer:=public.active_billing_payer");
  });

  it("uses atomic slot locking and stable error tokens", () => {
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("'lesson-coach/'||target_coach::text");
    expect(sql).toContain("b.starts_at<target_starts_at+make_interval");
    expect(sql).toContain("and b.ends_at>target_starts_at");
    expect(sql).toContain("message='slot_taken'");
    expect(sql).toContain("one_active_v2_booking_per_coach_time");
    expect(sql).toContain("message='participant_unauthorized'");
    expect(sql).toContain("message='booking_not_scheduled'");
  });

  it("keeps provisional charges out of invoices and supports waivers and credits", () => {
    expect(sql).toContain("lifecycle_state in ('provisional','finalized','voided','waived')");
    expect(sql).toContain("c.lifecycle_state='finalized'");
    expect(sql).toContain("create table public.ledger_credits");
    expect(sql).toContain("delete from public.invoice_lines where charge_id=c.id");
    expect(sql).toContain("c.status='unpaid' and c.lifecycle_state in ('voided','waived')");
    expect(sql).toContain("set replaced_charge_id=old_charge.id");
  });

  it("exposes coaches only through a money-free agenda DTO", () => {
    expect(sql).toContain("function public.list_coach_lesson_agenda");
    expect(sql).not.toMatch(/returns table\([^)]*(price|amount|payer|charge|invoice|receipt)/);
    expect(sql).not.toContain("coach_id=auth.uid() or fencer_id=auth.uid()");
    expect(sql).toContain("p.is_staff and p.staff_type='coach'");
    expect(sql).toContain("public.active_billing_payer(auth.uid())=auth.uid()");
  });

  it("uses a security-definer predicate instead of mutually recursive booking policies", () => {
    expect(sql).toContain("function public.lesson_actor_can_manage_booking");
    expect(sql).toContain("security definer set search_path=public");
    expect(sql).toContain("using(public.lesson_actor_can_manage_booking(booking_id))");
    expect(sql).toContain("public.lesson_actor_can_manage_booking(id)");
    expect(sql).toContain("grant execute on function public.lesson_actor_can_manage_booking(uuid) to authenticated");
    expect(sql).not.toMatch(/policy "booking parties read participants"[\s\S]*?select 1 from public\.bookings/);
    expect(sql).not.toMatch(/policy "booking parties read"[\s\S]*?select 1 from public\.booking_participants/);
    expect(sql).not.toContain("or b.booked_by_id=auth.uid()");
  });

  it("gates monetary and raw booking rows on effective billing responsibility", () => {
    expect(sql).toContain("function public.current_user_can_view_lesson_finances");
    expect(sql).toContain("grant execute on function public.current_user_can_view_lesson_finances() to authenticated");
    expect(sql).toContain("public.active_billing_payer(target_participant)=auth.uid()");
    expect(sql).toContain("v_payer<>auth.uid()");
    expect(sql).toContain("public.lesson_actor_can_manage_booking(id) and public.current_user_can_view_lesson_finances()");
    expect(sql).toContain("payer_id=auth.uid() and public.current_user_can_view_lesson_finances()");
  });

  it("revalidates lifecycle time, participant completion, and legacy API closure", () => {
    expect(sql).toContain("is_active and profile_completed_at is not null");
    expect(sql).toContain("public.active_billing_payer(auth.uid())<>auth.uid()");
    expect(sql).toContain("if b.starts_at<=now()");
    expect(sql).toContain("if old_b.starts_at<=now()");
    expect(sql).toContain("b.ends_at>now()");
    expect(sql).toContain("revoke all on function public.create_lesson_booking(uuid,uuid,text) from public,anon,authenticated");
  });

  it("uses exact horizon dates and preview-before-apply closure semantics", () => {
    expect(sql).toContain("cfg.booking_horizon_days-1");
    expect(sql).toContain("function public.admin_preview_club_closure");
    expect(sql).toContain("function public.preview_coach_availability_exception");
    expect(sql).toContain("message='affected_bookings_require_confirmation'");
  });

  it("revokes public access to every v2 mutation before authenticated grants", () => {
    for (const signature of [
      "create_lesson_booking_v2(uuid,timestamptz,uuid[],text)",
      "cancel_lesson_booking_v2(uuid,text,text)",
      "reschedule_lesson_booking_v2(uuid,timestamptz)",
      "record_lesson_outcome(uuid,text)",
      "admin_waive_booking_charges(uuid,text)",
    ]) {
      expect(sql).toContain(`revoke all on function public.${signature} from public`);
      expect(sql).toContain(`grant execute on function public.${signature} to authenticated`);
    }
  });

  it("records lifecycle audits and payer notifications", () => {
    expect(sql).toContain("'lesson.booking_created'");
    expect(sql).toContain("'lesson.booking_rescheduled'");
    expect(sql).toContain("create table public.lesson_notifications");
    expect(sql).toContain("notify_payer_of_cfa_lesson_change");
  });
});
