-- CFA platform foundation: security, identity, households, lessons and billing.
-- Forward-only migration. Existing auth/profile ids are preserved.

-- ---------------------------------------------------------------------------
-- Identity and membership products
-- ---------------------------------------------------------------------------
alter table public.membership_types
  add column if not exists code text,
  add column if not exists term_months integer,
  add column if not exists price numeric(10,2),
  add column if not exists joining_fee numeric(10,2) not null default 0;

update public.profiles set membership_type_id = null;
delete from public.membership_types;

insert into public.membership_types
  (name, code, monthly_fee, price, term_months, joining_fee, description)
values
  ('Month-to-month', 'month_to_month', 550, 550, 1, 350, 'Monthly CFA membership'),
  ('Six-month', 'six_month', 508.33, 3050, 6, 350, 'Six months paid upfront'),
  ('Twelve-month', 'twelve_month', 500, 6000, 12, 350, 'Twelve months paid upfront'),
  ('Beginner package', 'beginner_package', 0, 1000, 3, 0, 'Four introductory individual lessons');

alter table public.membership_types alter column code set not null;
alter table public.membership_types alter column price set not null;
create unique index membership_types_code_key on public.membership_types(code);

alter table public.profiles
  add column if not exists membership_status text not null default 'guest'
    check (membership_status in ('guest', 'member')),
  add column if not exists is_staff boolean not null default false,
  add column if not exists staff_type text check (staff_type in ('admin', 'coach')),
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists profile_completed_at timestamptz;

update public.profiles
set is_staff = role in ('admin', 'coach'),
    staff_type = case when role in ('admin', 'coach') then role else null end;

alter table public.profiles add constraint profiles_staff_consistency check (
  (is_staff and staff_type is not null) or (not is_staff and staff_type is null)
);

create or replace function public.current_user_is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_staff and staff_type = 'admin'
                   from public.profiles where id = auth.uid()), false);
$$;

-- Prevent direct API users from changing protected identity fields on themselves.
create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.current_user_is_admin() and (
    new.email is distinct from old.email or
    new.role is distinct from old.role or
    new.is_active is distinct from old.is_active or
    new.membership_status is distinct from old.membership_status or
    new.membership_type_id is distinct from old.membership_type_id or
    new.is_staff is distinct from old.is_staff or
    new.staff_type is distinct from old.staff_type
  ) then
    raise exception 'protected profile fields may only be changed by an administrator';
  end if;
  return new;
end;
$$;

create trigger protect_profile_security_fields
  before update on public.profiles
  for each row execute function public.protect_profile_security_fields();

-- ---------------------------------------------------------------------------
-- Households: exactly one payer row per household.
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  payer_id uuid not null unique references public.profiles(id) on delete restrict,
  membership_payment_method text not null default 'manual'
    check (membership_payment_method in ('manual', 'recurring_card')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  household_role text not null check (household_role in ('payer', 'dependent')),
  payer_consent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, profile_id)
);

insert into public.households (payer_id)
select id from public.profiles;

insert into public.household_members (household_id, profile_id, household_role)
select h.id, h.payer_id, 'payer' from public.households h;

create unique index household_single_payer
  on public.household_members(household_id) where household_role = 'payer';

create or replace function public.enforce_household_member()
returns trigger language plpgsql set search_path = public as $$
declare payer_dob date;
begin
  if new.household_role = 'payer' and
     new.profile_id <> (select payer_id from public.households where id = new.household_id) then
    raise exception 'payer member must match household payer';
  end if;
  if new.household_role = 'dependent' then
    select date_of_birth into payer_dob from public.profiles
      where id = (select payer_id from public.households where id = new.household_id);
    if payer_dob is not null and payer_dob > current_date - interval '18 years' then
      raise exception 'household payer must be an adult';
    end if;
  end if;
  return new;
end $$;

create trigger enforce_household_member
  before insert or update on public.household_members
  for each row execute function public.enforce_household_member();

create or replace function public.attach_dependent(target_profile uuid, target_payer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare old_household uuid; new_household uuid; old_role text;
begin
  if not public.current_user_is_admin() then raise exception 'forbidden'; end if;
  if target_profile = target_payer then raise exception 'a dependent cannot be their own payer'; end if;
  select household_id,household_role into old_household,old_role from public.household_members where profile_id=target_profile;
  select id into new_household from public.households where payer_id=target_payer;
  if new_household is null then raise exception 'payer household not found'; end if;
  if old_role='payer' and exists(select 1 from public.household_members where household_id=old_household and household_role='dependent') then
    raise exception 'move this payer''s dependents before closing their household';
  end if;
  delete from public.household_members where profile_id=target_profile;
  insert into public.household_members(household_id,profile_id,household_role,payer_consent_at)
    values(new_household,target_profile,'dependent',now());
  delete from public.households where id=old_household and not exists
    (select 1 from public.household_members where household_id=old_household);
end $$;

create or replace function public.current_household_id()
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.household_members where profile_id = auth.uid();
$$;

create or replace function public.current_household_role()
returns text language sql stable security definer set search_path = public as $$
  select household_role from public.household_members where profile_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Membership requests
-- ---------------------------------------------------------------------------
create table public.membership_requests (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  membership_type_id uuid not null references public.membership_types(id),
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_pending_membership_request
  on public.membership_requests(applicant_id) where status = 'pending';

create or replace function public.review_membership_request(request_id uuid, decision text)
returns void language plpgsql security definer set search_path = public as $$
declare request_row public.membership_requests;
begin
  if not public.current_user_is_admin() then raise exception 'forbidden'; end if;
  if decision not in ('approved','declined') then raise exception 'invalid decision'; end if;
  select * into request_row from public.membership_requests
    where id = request_id and status = 'pending' for update;
  if not found then raise exception 'pending request not found'; end if;
  update public.membership_requests set status = decision, reviewed_by = auth.uid(), reviewed_at = now()
    where id = request_id;
  if decision = 'approved' then
    update public.profiles set membership_status = 'member', membership_type_id = request_row.membership_type_id
      where id = request_row.applicant_id;
    insert into public.charges(fencer_id,payer_id,type,amount,status,period,description)
      select request_row.applicant_id,h.payer_id,'membership',mt.price,'unpaid',date_trunc('month',current_date)::date,mt.name
      from public.household_members hm join public.households h on h.id=hm.household_id
      join public.membership_types mt on mt.id=request_row.membership_type_id
      where hm.profile_id=request_row.applicant_id;
    insert into public.charges(fencer_id,payer_id,type,amount,status,period,description)
      select request_row.applicant_id,h.payer_id,'joining_fee',mt.joining_fee,'unpaid',date_trunc('month',current_date)::date,'First-time joining fee'
      from public.household_members hm join public.households h on h.id=hm.household_id
      join public.membership_types mt on mt.id=request_row.membership_type_id
      where hm.profile_id=request_row.applicant_id and mt.joining_fee > 0;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Lessons and atomic charges
-- ---------------------------------------------------------------------------
create table public.lesson_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  coach_id uuid references public.profiles(id),
  capacity integer check (capacity is null or capacity > 0),
  price numeric(10,2) not null check (price >= 0),
  is_open boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  lesson_slot_id uuid not null references public.lesson_slots(id),
  booked_by_id uuid not null references public.profiles(id),
  fencer_id uuid not null references public.profiles(id),
  payment_option text not null check (payment_option in ('pay_now','pay_later')),
  status text not null default 'upcoming' check (status in ('upcoming','attended','cancelled')),
  created_at timestamptz not null default now(),
  unique (lesson_slot_id, fencer_id)
);

create table public.charges (
  id uuid primary key default gen_random_uuid(),
  fencer_id uuid not null references public.profiles(id),
  payer_id uuid not null references public.profiles(id),
  booking_id uuid unique references public.bookings(id),
  type text not null check (type in ('lesson','rental','membership','joining_fee')),
  amount numeric(10,2) not null check (amount >= 0),
  status text not null default 'unpaid' check (status in ('unpaid','paid')),
  period date not null,
  description text not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create or replace function public.create_lesson_booking(
  target_slot uuid, target_fencer uuid, requested_payment text
) returns uuid language plpgsql security definer set search_path = public as $$
declare actor public.profiles; fencer public.profiles; slot public.lesson_slots;
declare actor_role text; payer uuid; final_payment text; booking_id uuid;
begin
  select * into actor from public.profiles where id = auth.uid() and is_active;
  select * into fencer from public.profiles where id = target_fencer and is_active;
  select * into slot from public.lesson_slots where id = target_slot and is_open and starts_at > now();
  if actor.id is null or fencer.id is null or slot.id is null then raise exception 'not available'; end if;
  select household_role into actor_role from public.household_members where profile_id = actor.id;
  if not public.current_user_is_admin() and actor_role = 'dependent' and target_fencer <> actor.id then
    raise exception 'dependents may only book themselves';
  end if;
  if not public.current_user_is_admin() and actor_role = 'payer' and
     not exists (select 1 from public.household_members hm where hm.profile_id = target_fencer
       and hm.household_id = public.current_household_id()) then raise exception 'not in household'; end if;
  select h.payer_id into payer from public.households h join public.household_members hm on hm.household_id=h.id
    where hm.profile_id=target_fencer;
  final_payment := case when actor_role='dependent' then 'pay_later'
                        when fencer.membership_status='guest' then 'pay_now'
                        else requested_payment end;
  if final_payment not in ('pay_now','pay_later') then raise exception 'invalid payment option'; end if;
  insert into public.bookings(lesson_slot_id,booked_by_id,fencer_id,payment_option)
    values(target_slot,actor.id,target_fencer,final_payment) returning id into booking_id;
  insert into public.charges(fencer_id,payer_id,booking_id,type,amount,status,period,description)
    values(target_fencer,payer,booking_id,'lesson',slot.price,
      case when final_payment='pay_now' then 'unpaid' else 'unpaid' end,
      date_trunc('month',slot.starts_at)::date,'Individual lesson');
  return booking_id;
end $$;

-- ---------------------------------------------------------------------------
-- Billing ledger and provider-neutral records
-- ---------------------------------------------------------------------------
create sequence public.invoice_number_seq start 1000;
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  payer_id uuid not null references public.profiles(id),
  period date not null,
  invoice_number text not null unique default ('CFA-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0')),
  status text not null default 'unpaid' check (status in ('unpaid','paid','overdue')),
  total numeric(10,2) not null default 0,
  payment_link text,
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (payer_id, period)
);
create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  charge_id uuid not null unique references public.charges(id),
  description text not null,
  amount numeric(10,2) not null
);
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  payer_id uuid not null references public.profiles(id),
  invoice_id uuid references public.invoices(id),
  receipt_number text not null unique default ('REC-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0')),
  amount numeric(10,2) not null,
  issued_at timestamptz not null default now()
);
create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payer_id uuid not null references public.profiles(id),
  invoice_id uuid references public.invoices(id),
  provider text,
  provider_reference text,
  status text not null default 'pending' check (status in ('pending','succeeded','failed')),
  amount numeric(10,2) not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table public.provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);
create table public.payment_method_references (
  id uuid primary key default gen_random_uuid(), payer_id uuid not null references public.profiles(id),
  provider text not null, provider_customer_id text not null, provider_method_id text not null,
  display_label text, created_at timestamptz not null default now(), unique(payer_id,provider)
);

create or replace function public.run_monthly_invoices(target_period date)
returns integer language plpgsql security definer set search_path = public as $$
declare payer_row record; v_invoice_id uuid; made integer := 0;
begin
  if not public.current_user_is_admin() then raise exception 'forbidden'; end if;
  target_period := date_trunc('month', target_period)::date;
  for payer_row in select distinct c.payer_id from public.charges c
    left join public.bookings b on b.id=c.booking_id
    where c.status='unpaid' and c.period=target_period and
      (c.type in ('membership','joining_fee') or (c.type='lesson' and b.payment_option='pay_later')) loop
    insert into public.invoices(payer_id,period) values(payer_row.payer_id,target_period)
      on conflict(payer_id,period) do update set payer_id=excluded.payer_id returning id into v_invoice_id;
    insert into public.invoice_lines(invoice_id,charge_id,description,amount)
      select v_invoice_id,c.id,c.description,c.amount from public.charges c
      left join public.bookings b on b.id=c.booking_id
      where c.payer_id=payer_row.payer_id and c.period=target_period and c.status='unpaid'
        and (c.type in ('membership','joining_fee') or (c.type='lesson' and b.payment_option='pay_later'))
      on conflict(charge_id) do nothing;
    update public.invoices i set total=(select coalesce(sum(il.amount),0) from public.invoice_lines il where il.invoice_id=v_invoice_id)
      where i.id=v_invoice_id;
    made := made + 1;
  end loop;
  return made;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: household financial records are payer/admin only.
-- ---------------------------------------------------------------------------
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.membership_requests enable row level security;
alter table public.lesson_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.charges enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.receipts enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.provider_events enable row level security;
alter table public.payment_method_references enable row level security;

create policy "household members read own household" on public.household_members for select
  using (household_id=public.current_household_id() or public.current_user_is_admin());
create policy "admins manage household members" on public.household_members for all
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy "payer or admin reads household" on public.households for select
  using (payer_id=auth.uid() or public.current_user_is_admin());
create policy "admins manage households" on public.households for all
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy "applicant reads own request" on public.membership_requests for select
  using (applicant_id=auth.uid() or public.current_user_is_admin());
create policy "applicant creates request" on public.membership_requests for insert
  with check (applicant_id=auth.uid() and status='pending');
create policy "public reads open slots" on public.lesson_slots for select using (is_open=true or public.current_user_is_admin());
create policy "admins manage slots" on public.lesson_slots for all
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy "booking participants read" on public.bookings for select
  using (fencer_id=auth.uid() or booked_by_id=auth.uid() or
    (public.current_household_role()='payer' and fencer_id in
      (select profile_id from public.household_members where household_id=public.current_household_id())) or
    public.current_user_is_admin());
create policy "payer or admin reads charges" on public.charges for select
  using (payer_id=auth.uid() or public.current_user_is_admin());
create policy "admins manage charges" on public.charges for all
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy "payer or admin reads invoices" on public.invoices for select
  using (payer_id=auth.uid() or public.current_user_is_admin());
create policy "admins manage invoices" on public.invoices for all
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy "payer or admin reads invoice lines" on public.invoice_lines for select
  using (exists(select 1 from public.invoices i where i.id=invoice_id and
    (i.payer_id=auth.uid() or public.current_user_is_admin())));
create policy "admins manage invoice lines" on public.invoice_lines for all
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy "payer or admin reads receipts" on public.receipts for select
  using (payer_id=auth.uid() or public.current_user_is_admin());
create policy "admins manage receipts" on public.receipts for all
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy "payer or admin reads payment attempts" on public.payment_attempts for select
  using (payer_id=auth.uid() or public.current_user_is_admin());
create policy "admins manage payment attempts" on public.payment_attempts for all
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy "payer manages own payment references" on public.payment_method_references for all
  using (payer_id=auth.uid()) with check (payer_id=auth.uid());
create policy "admins read provider events" on public.provider_events for select using (public.current_user_is_admin());

-- Update legacy authorization policies to the independent staff model.
drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles" on public.profiles for select using (public.current_user_is_admin());
drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles" on public.profiles for update
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());
drop policy if exists "Coaches can read fencer profiles" on public.profiles;
drop policy if exists "Admins can manage membership types" on public.membership_types;
create policy "Admins can manage membership types" on public.membership_types for all
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

-- New signups remain guests and become a household of one after profile creation.
create or replace function public.handle_new_profile_household()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_household uuid;
begin
  insert into public.households(payer_id) values(new.id) returning id into new_household;
  insert into public.household_members(household_id,profile_id,household_role)
    values(new_household,new.id,'payer');
  return new;
end $$;
create trigger on_profile_created_household after insert on public.profiles
  for each row execute function public.handle_new_profile_household();
