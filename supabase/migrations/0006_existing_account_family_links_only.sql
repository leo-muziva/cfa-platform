-- Family relationships are created only by linking two existing accounts.
-- The previous dependent-invite helper is no longer part of the product flow.
drop function if exists public.request_family_link_to_profile(uuid);
