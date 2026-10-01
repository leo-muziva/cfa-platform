-- These ledger and lesson-policy tables were created without RLS, which left
-- them readable and writable through PostgREST. They are maintained only by
-- security-definer RPCs (which run as the table owner and bypass RLS), so API
-- roles get no direct writes and only narrow read access.
alter table public.credit_consumptions enable row level security;
alter table public.invoice_adjustments enable row level security;
alter table public.lesson_products enable row level security;
alter table public.lesson_entitlements enable row level security;

revoke insert, update, delete on public.credit_consumptions, public.invoice_adjustments,
  public.lesson_products, public.lesson_entitlements from anon, authenticated;

-- Financial staff read access, matching lesson_booking_allocations.
create policy "Financial staff can read credit consumptions" on public.credit_consumptions
  for select to authenticated using (public.current_user_is_admin());
create policy "Financial staff can read invoice adjustments" on public.invoice_adjustments
  for select to authenticated using (public.current_user_is_admin());
create policy "Financial staff can read lesson entitlements" on public.lesson_entitlements
  for select to authenticated using (public.current_user_is_admin());

-- Catalog configuration without personal data; inactive products stay staff-only.
create policy "Signed-in users can read active lesson products" on public.lesson_products
  for select to authenticated using (is_active or public.current_user_is_admin());
