-- Migration: 0027_product_images
-- A product can have several photos (different angles, colour options).
-- The products table only holds one, so gallery images live here.
-- sort_order 1 is the main photo shown on the catalogue card.

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null references public.products(id) on delete cascade,
  file_name text not null,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),

  -- The same file can only be attached to a product once.
  unique (product_id, file_name)
);

create index product_images_product_idx
  on public.product_images (product_id, sort_order);

alter table public.product_images enable row level security;

-- Anyone browsing the shop can see product photos.
create policy "Anyone can read product images"
  on public.product_images for select
  using (true);

-- Only admins can change them.
create policy "Admins can manage product images"
  on public.product_images for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- Load the photos
-- ============================================================
insert into public.product_images (product_id, file_name, sort_order)
select p.id, v.file_name, v.sort_order
from (values
  ('EF01', 'EF01-1.jpg', 1),
  ('EF02', 'EF02-1.jpg', 1),
  ('EF03', 'EF03-1.jpg', 1),
  ('EF05', 'EF05-1.jpg', 1),
  ('EF05', 'EF05-2.jpg', 2),
  ('EF09', 'EF09-1.jpg', 1),
  ('EF100', 'EF100-1.jpg', 1),
  ('EF101', 'EF101-1.jpg', 1),
  ('EF102', 'EF102-1.jpg', 1),
  ('EF103', 'EF103-1.jpg', 1),
  ('EF104', 'EF104-1.jpg', 1),
  ('EF105', 'EF105-1.jpg', 1),
  ('EF105', 'EF105-2.jpg', 2),
  ('EF106', 'EF106-1.jpg', 1),
  ('EF109', 'EF109-1.jpg', 1),
  ('EF11', 'EF11-1.jpg', 1),
  ('EF11', 'EF11-2.jpg', 2),
  ('EF110', 'EF110-1.jpg', 1),
  ('EF117', 'EF117-1.jpg', 1),
  ('EF118', 'EF118-1.jpg', 1),
  ('EF119', 'EF119-1.jpg', 1),
  ('EF120', 'EF120-1.jpg', 1),
  ('EF124', 'EF124-1.jpg', 1),
  ('EF124', 'EF124-2.jpg', 2),
  ('EF125', 'EF125-1.jpg', 1),
  ('EF126', 'EF126-1.jpg', 1),
  ('EF127', 'EF127-1.jpg', 1),
  ('EF128', 'EF128-1.jpg', 1),
  ('EF128', 'EF128-2.jpg', 2),
  ('EF129', 'EF129-1.jpg', 1),
  ('EF129', 'EF129-2.jpg', 2),
  ('EF13', 'EF13-1.jpg', 1),
  ('EF130', 'EF130-1.jpg', 1),
  ('EF131A', 'EF131A-1.jpg', 1),
  ('EF131B', 'EF131B-1.jpg', 1),
  ('EF132', 'EF132-1.jpg', 1),
  ('EF133', 'EF133-1.jpg', 1),
  ('EF133', 'EF133-2.jpg', 2),
  ('EF134', 'EF134-1.jpg', 1),
  ('EF135', 'EF135-1.jpg', 1),
  ('EF135', 'EF135-2.jpg', 2),
  ('EF135', 'EF135-3.jpg', 3),
  ('EF135', 'EF135-4.jpg', 4),
  ('EF136', 'EF136-1.jpg', 1),
  ('EF136', 'EF136-2.jpg', 2),
  ('EF137', 'EF137-1.jpg', 1),
  ('EF137', 'EF137-2.jpg', 2),
  ('EF137', 'EF137-3.jpg', 3),
  ('EF138', 'EF138-1.jpg', 1),
  ('EF138', 'EF138-2.jpg', 2),
  ('EF138', 'EF138-3.jpg', 3),
  ('EF138', 'EF138-4.jpg', 4),
  ('EF139', 'EF139-1.jpg', 1),
  ('EF139', 'EF139-2.jpg', 2),
  ('EF140', 'EF140-1.jpg', 1),
  ('EF140', 'EF140-2.jpg', 2),
  ('EF141', 'EF141-1.jpg', 1),
  ('EF141', 'EF141-2.jpg', 2),
  ('EF141', 'EF141-3.jpg', 3),
  ('EF141', 'EF141-4.jpg', 4),
  ('EF141', 'EF141-5.jpg', 5),
  ('EF141', 'EF141-6.jpg', 6),
  ('EF142', 'EF142-1.jpg', 1),
  ('EF143', 'EF143-1.jpg', 1),
  ('EF144', 'EF144-1.jpg', 1),
  ('EF145', 'EF145-1.jpg', 1),
  ('EF146', 'EF146-1.jpg', 1),
  ('EF147', 'EF147-1.jpg', 1),
  ('EF148', 'EF148-1.jpg', 1),
  ('EF149', 'EF149-1.jpg', 1),
  ('EF150', 'EF150-1.jpg', 1),
  ('EF151', 'EF151-1.jpg', 1),
  ('EF152A', 'EF152A-1.jpg', 1),
  ('EF153', 'EF153-1.jpg', 1),
  ('EF154', 'EF154-1.jpg', 1),
  ('EF155', 'EF155-1.jpg', 1),
  ('EF157', 'EF157-1.jpg', 1),
  ('EF159', 'EF159-1.jpg', 1),
  ('EF160', 'EF160-1.jpg', 1),
  ('EF161', 'EF161-1.jpg', 1),
  ('EF162', 'EF162-1.jpg', 1),
  ('EF163', 'EF163-1.jpg', 1),
  ('EF165-A', 'EF165-A-1.jpg', 1),
  ('EF165-B', 'EF165-B-1.jpg', 1),
  ('EF165-C', 'EF165-C-1.jpg', 1),
  ('EF165-D', 'EF165-D-1.jpg', 1),
  ('EF166', 'EF166-1.jpg', 1),
  ('EF168', 'EF168-1.jpg', 1),
  ('EF169', 'EF169-1.jpg', 1),
  ('EF17', 'EF17-1.jpg', 1),
  ('EF181', 'EF181-1.jpg', 1),
  ('EF186', 'EF186-1.jpg', 1),
  ('EF188', 'EF188-1.jpg', 1),
  ('EF188', 'EF188-2.jpg', 2),
  ('EF19', 'EF19-1.jpg', 1),
  ('EF190', 'EF190-1.jpg', 1),
  ('EF190', 'EF190-2.jpg', 2),
  ('EF195', 'EF195-1.jpg', 1),
  ('EF196', 'EF196-1.jpg', 1),
  ('EF197', 'EF197-1.jpg', 1),
  ('EF21', 'EF21-1.jpg', 1),
  ('EF22', 'EF22-1.jpg', 1),
  ('EF22', 'EF22-2.jpg', 2),
  ('EF25', 'EF25-1.jpg', 1),
  ('EF25', 'EF25-2.jpg', 2),
  ('EF25', 'EF25-3.jpg', 3),
  ('EF26', 'EF26-1.jpg', 1),
  ('EF26', 'EF26-2.jpg', 2),
  ('EF26', 'EF26-3.jpg', 3),
  ('EF27', 'EF27-1.jpg', 1),
  ('EF27', 'EF27-2.jpg', 2),
  ('EF27', 'EF27-3.jpg', 3),
  ('EF28', 'EF28-1.jpg', 1),
  ('EF28', 'EF28-2.jpg', 2),
  ('EF28', 'EF28-3.jpg', 3),
  ('EF29', 'EF29-1.jpg', 1),
  ('EF29', 'EF29-2.jpg', 2),
  ('EF30', 'EF30-1.jpg', 1),
  ('EF30', 'EF30-2.jpg', 2),
  ('EF31', 'EF31-1.jpg', 1),
  ('EF31', 'EF31-2.jpg', 2),
  ('EF32', 'EF32-1.jpg', 1),
  ('EF32', 'EF32-2.jpg', 2),
  ('EF33', 'EF33-1.jpg', 1),
  ('EF34', 'EF34-1.jpg', 1),
  ('EF35', 'EF35-1.jpg', 1),
  ('EF36', 'EF36-1.jpg', 1),
  ('EF36', 'EF36-2.jpg', 2),
  ('EF37', 'EF37-1.jpg', 1),
  ('EF38', 'EF38-1.jpg', 1),
  ('EF39', 'EF39-1.jpg', 1),
  ('EF40', 'EF40-1.jpg', 1),
  ('EF40', 'EF40-2.jpg', 2),
  ('EF41', 'EF41-1.jpg', 1),
  ('EF47', 'EF47-1.jpg', 1),
  ('EF48', 'EF48-1.jpg', 1),
  ('EF49', 'EF49-1.jpg', 1),
  ('EF51', 'EF51-1.jpg', 1),
  ('EF55', 'EF55-1.jpg', 1),
  ('EF58', 'EF58-1.jpg', 1),
  ('EF59', 'EF59-1.jpg', 1),
  ('EF60', 'EF60-1.jpg', 1),
  ('EF61', 'EF61-1.jpg', 1),
  ('EF62', 'EF62-1.jpg', 1),
  ('EF63', 'EF63-1.jpg', 1),
  ('EF63', 'EF63-2.jpg', 2),
  ('EF64', 'EF64-1.jpg', 1),
  ('EF65', 'EF65-1.jpg', 1),
  ('EF65', 'EF65-2.jpg', 2),
  ('EF66', 'EF66-1.jpg', 1),
  ('EF67', 'EF67-1.jpg', 1),
  ('EF70', 'EF70-1.jpg', 1),
  ('EF71', 'EF71-1.jpg', 1),
  ('EF72', 'EF72-1.jpg', 1),
  ('EF73', 'EF73-1.jpg', 1),
  ('EF74', 'EF74-1.jpg', 1),
  ('EF75', 'EF75-1.jpg', 1),
  ('EF76', 'EF76-1.jpg', 1),
  ('EF77', 'EF77-1.jpg', 1),
  ('EF78', 'EF78-1.jpg', 1),
  ('EF79', 'EF79-1.jpg', 1),
  ('EF82A', 'EF82A-1.jpg', 1),
  ('EF83', 'EF83-1.jpg', 1),
  ('EF84', 'EF84-1.jpg', 1),
  ('EF85', 'EF85-1.jpg', 1),
  ('EF86', 'EF86-1.jpg', 1),
  ('EF87', 'EF87-1.jpg', 1),
  ('EF87', 'EF87-2.jpg', 2),
  ('EF89', 'EF89-1.jpg', 1),
  ('EF90', 'EF90-1.jpg', 1),
  ('EF91-A', 'EF91-A-1.jpg', 1),
  ('EF91-A', 'EF91-A-2.jpg', 2),
  ('EF93', 'EF93-1.jpg', 1),
  ('EF94', 'EF94-1.jpg', 1),
  ('EF95', 'EF95-1.jpg', 1),
  ('EF96', 'EF96-1.jpg', 1),
  ('EF97', 'EF97-1.jpg', 1),
  ('EF98', 'EF98-1.jpg', 1),
  ('EF99', 'EF99-1.jpg', 1),
  ('EFX006', 'EFX006-1.jpg', 1)
) as v(item_code, file_name, sort_order)
join public.products p on p.item_code = v.item_code
on conflict (product_id, file_name) do nothing;

-- Point each product's main image at its first photo, so the
-- catalogue cards keep working without any code change.
update public.products p
set image_path = i.file_name
from public.product_images i
where i.product_id = p.id and i.sort_order = 1;
