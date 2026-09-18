-- Drop the v1 lesson booking RPC.
--
-- 0011 moved booking to create_lesson_booking_v2 and revoked execute on v1 from
-- public, anon and authenticated, but left the function defined. Nothing can
-- call it successfully, so it is dead -- except that calling it is not a clean
-- permission error. It segfaults the backend:
--
--   server process (PID 394) was terminated by signal 11: Segmentation fault
--   DETAIL: Failed process was running:
--     select public.create_lesson_booking(...)
--
-- which takes the whole database down with it, not just the caller's session.
-- member-workflows.test.sql still called it and that is exactly what happened
-- there; the same call against v2 raises a normal exception.
--
-- The root cause of the segfault is a Postgres-level crash and is not diagnosed
-- here. Removing the function removes the only way to reach it.

drop function if exists public.create_lesson_booking(uuid,uuid,text);
