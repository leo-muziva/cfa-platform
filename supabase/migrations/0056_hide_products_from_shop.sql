-- Migration: 0056_hide_products_from_shop
-- CFA asked for two groups of products to be taken out of the shop:
--
--   1. Anything without a photo. A card with no image looks unfinished,
--      and the supplier has no photo for these.
--   2. The complete scoring machines. These are club equipment rather
--      than individual member purchases, and at R7,700 to R22,000 a
--      single one would fill the bulk order threshold on its own.
--
-- Nothing is deleted. is_active = false removes a product from the
-- catalogue while keeping it in the admin product list and preserving
-- any order history that references it. Setting is_active back to true
-- puts it straight back in the shop.

-- 1. No photo available (64 products)
update public.products set is_active = false 
where item_code in (
  'EF04', 'EF07', 'EF107', 'EF108', 'EF111', 'EF112',
  'EF114', 'EF115', 'EF116', 'EF124-1', 'EF131C', 'EF131D',
  'EF15', 'EF152b', 'EF156', 'EF158', 'EF164-A', 'EF164-B',
  'EF165-A-1', 'EF170', 'EF171', 'EF171-1', 'EF172', 'EF172-1',
  'EF180', 'EF184', 'EF185', 'EF201', 'EF203', 'EF205',
  'EF35', 'EF36', 'EF43', 'EF44', 'EF45', 'EF53',
  'EF54', 'EF68', 'EF69', 'EF75-1', 'EF80', 'EF81',
  'EF82b', 'EF91-B', 'EFX001', 'EFX002', 'EFX003', 'EFX004',
  'EFX005', 'EFX007', 'EFX008', 'EFX009', 'EFX010', 'EFX011',
  'EFX012', 'EFX013', 'EFX014', 'EFX015', 'EFX016', 'EFX017',
  'EFX018', 'EFX019', 'EFX020', 'EFX021'
);

-- 2. Complete scoring machines (5 further products)
update public.products set is_active = false
where item_code in (
  'EF165-A', 'EF165-B', 'EF165-C', 'EF165-D', 'EF166'
);