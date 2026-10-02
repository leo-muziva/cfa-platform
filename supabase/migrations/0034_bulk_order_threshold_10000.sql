-- Lower the bulk order threshold from R15 000 to R10 000.
-- New bulk orders pick this up from the column default. The one that is
-- currently collecting is moved over too, so the shop bar uses the new
-- amount straight away. Placed and older bulk orders keep what they had.

alter table public.bulk_orders
  alter column threshold set default 10000;

update public.bulk_orders
set threshold = 10000
where status = 'collecting';
