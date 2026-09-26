-- Four more product photos supplied by CFA.
-- Upload EF46-1.jpg, EF55-1.jpg, EF56-1.jpg and EF57-1.jpg first.

-- EF55 previously had a wrongly-matched photo. The supplier's catalogue
-- PDF numbers "Epee Wire for Normal Point" as EF55, but the price list
-- uses EF55 for the point tip spring. Move that photo to EF51, where the
-- epee wire actually lives.
delete from public.product_images
where file_name = 'EF55-1.jpg'
  and product_id = (select id from public.products where item_code = 'EF55');

-- Now add the four correct photos.
insert into public.product_images (product_id, file_name, sort_order)
select p.id, v.file_name, 1
from (values
  ('EF46', 'EF46-1.jpg'),
  ('EF55', 'EF55-1.jpg'),
  ('EF56', 'EF56-1.jpg'),
  ('EF57', 'EF57-1.jpg')
) as v(item_code, file_name)
join public.products p on p.item_code = v.item_code
on conflict (product_id, file_name) do nothing;

-- Use them as each product's main catalogue image.
update public.products p
set image_path = i.file_name
from public.product_images i
where i.product_id = p.id
  and i.sort_order = 1
  and p.item_code in ('EF46','EF55','EF56','EF57');