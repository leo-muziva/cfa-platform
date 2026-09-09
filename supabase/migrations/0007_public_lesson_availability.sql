-- Public-safe lesson availability with aggregate capacity information.
-- Individual bookings and participant details remain protected by RLS.
create or replace function public.list_open_lesson_slots()
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  coach_id uuid,
  capacity integer,
  price numeric,
  is_open boolean,
  access_rule text,
  created_by uuid,
  created_at timestamptz,
  booked_count bigint,
  remaining_capacity bigint,
  is_full boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    slot.id,
    slot.starts_at,
    slot.ends_at,
    slot.coach_id,
    slot.capacity,
    slot.price,
    slot.is_open,
    slot.access_rule,
    slot.created_by,
    slot.created_at,
    count(booking.id) filter (where booking.status <> 'cancelled') as booked_count,
    case
      when slot.capacity is null then null
      else greatest(
        slot.capacity - count(booking.id) filter (where booking.status <> 'cancelled'),
        0
      )
    end as remaining_capacity,
    slot.capacity is not null
      and count(booking.id) filter (where booking.status <> 'cancelled') >= slot.capacity
      as is_full
  from public.lesson_slots slot
  left join public.bookings booking on booking.lesson_slot_id = slot.id
  where slot.is_open = true and slot.starts_at > now()
  group by slot.id
  order by slot.starts_at;
$$;

revoke all on function public.list_open_lesson_slots() from public;
grant execute on function public.list_open_lesson_slots() to anon, authenticated;
