-- Migration: 0056_product_photo_uploads
-- Admins can add or change a product's photo from the admin panel.
-- Uploaded photos live in Supabase Storage. The photos that shipped with the
-- code stay in public/product-images. products.image_path tells them apart:
-- an uploaded photo's path starts with the bucket name, for example
-- "product-photos/12/3f2a....jpg", while a shipped one is a bare file name.

-- Public bucket: shop visitors load photos by URL without signing in.
-- The size and type limits are enforced by Storage itself, on top of the
-- checks in lib/services/product-photo-service.ts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-photos',
  'product-photos',
  true,
  4194304, -- 4 MB, under Vercel's request size limit
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Only admins can write. Deleting needs select as well, because Storage
-- looks the object up before removing it.
create policy "Admins read product photo objects"
  on storage.objects for select
  using (bucket_id = 'product-photos' and public.current_user_is_admin());
create policy "Admins upload product photos"
  on storage.objects for insert
  with check (bucket_id = 'product-photos' and public.current_user_is_admin());
create policy "Admins replace product photos"
  on storage.objects for update
  using (bucket_id = 'product-photos' and public.current_user_is_admin())
  with check (bucket_id = 'product-photos' and public.current_user_is_admin());
create policy "Admins delete product photos"
  on storage.objects for delete
  using (bucket_id = 'product-photos' and public.current_user_is_admin());
