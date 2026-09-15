-- Migration: 0015_fix_order_submit_policy
-- The update policy had no explicit `with check`, so Postgres reused the
-- `using` clause and required the row to still be 'draft' afterwards.
-- That blocked customers from submitting. This allows a draft order to
-- become submitted or cancelled, but nothing else.

drop policy "Users can update own draft orders" on public.orders;

create policy "Users can update own draft orders"
  on public.orders for update
  using (auth.uid() = user_id and status = 'draft')
  with check (auth.uid() = user_id and status in ('draft', 'submitted', 'cancelled'));