-- Five more product photos: EF50, EF92, EF102, EF103 (supplied by CFA)
-- and EF113 (cropped from the supplier catalogue).
-- Upload the five .jpg files to the product-images bucket before running this.

insert into public.product_images (product_id, file_name, sort_order)
select p.id, v.file_name, 1
from (values
  ('EF50',  'EF50-1.jpg'),
  ('EF92',  'EF92-1.jpg'),
  ('EF102', 'EF102-1.jpg'),
  ('EF103', 'EF103-1.jpg'),
  ('EF113', 'EF113-1.jpg')
) as v(item_code, file_name)
join public.products p on p.item_code = v.item_code
on conflict (product_id, file_name) do nothing;

-- Use them as each product's main catalogue image.
update public.products p
set image_path = i.file_name
from public.product_images i
where i.product_id = p.id
  and i.sort_order = 1
  and p.item_code in ('EF50','EF92','EF102','EF103','EF113');