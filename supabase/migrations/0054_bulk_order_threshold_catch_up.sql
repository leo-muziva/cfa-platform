-- 0034 was used twice: once for the supplier order sheets (later renumbered
-- to 0052) and once for the R10 000 bulk order threshold. The hosted database
-- recorded 0034 when it ran the supplier sheets, so the threshold change
-- never ran there. This repeats it. It is safe to run where 0034 already
-- lowered the threshold: the result is the same.

alter table public.bulk_orders
  alter column threshold set default 10000;

update public.bulk_orders
set threshold = 10000
where status = 'collecting';
