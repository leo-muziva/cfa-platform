-- The supplier's catalogue PDF numbers this EF55, but the price list
-- uses EF55 for the point tip spring. The photo is an epee wire, so it
-- belongs with EF51.
update public.product_images
set product_id = (select id from public.products where item_code = 'EF51'),
    sort_order = 2
where file_name = 'EF55-1.jpg';

-- EF55 has no photo now, so clear its main image.
update public.products set image_path = null where item_code = 'EF55';