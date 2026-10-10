-- Drop-ins (guests) can book any lesson time again. 0039 let coaches mark
-- standing hours as members-only, which shut guests out of those hours. The
-- club wants every hour open, so reset the existing rules. The access_rule
-- column, the coach checkbox and the booking check stay, so a coach can
-- still mark hours members-only later on purpose.
with opened as (
  update public.coach_availability_rules set access_rule='guest_allowed'
  where access_rule='active_members_only'
  returning id
)
insert into public.audit_events(event_type,actor_id,entity_type,metadata)
select 'lesson.availability_opened_to_guests',null,'coach_availability_rule',
  jsonb_build_object('rules_opened',count(*),'migration','0046')
from opened
having count(*)>0;
