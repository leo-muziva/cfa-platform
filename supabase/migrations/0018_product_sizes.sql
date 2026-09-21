-- Migration: 0018_product_sizes
-- Fills in which products come in sizes, and what the options are.
-- Size lists follow the supplier's sizing chart. Derived from product
-- names, so CFA should review before this goes live.

-- Masks: measured around the head
update public.products set sizes = 'XX-Small, X-Small, Small, Medium, Large, X-Large'
where item_code in (
  'EF105','EF106','EF107','EF108','EF109','EF110','EF111','EF112',
  'EF113','EF114','EF115','EF116','EFX002','EFX003',
  'EF160','EF186','EF188','EF190','EFX021'
);

-- Jackets, pants and plastrons: EU sizing, men's and women's ranges combined
update public.products set sizes = '36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60'
where item_code in (
  'EF118','EF119','EF120','EF195','EF196','EF197','EF201','EF203'
);

-- Coach gear: sized S to XXL rather than EU numbers
update public.products set sizes = 'S, M, L, XL, XXL'
where item_code in (
  'EF154','EF155','EF156','EF157','EF158','EF162','EF163'
);

-- Lames: EU sizing, same range as jackets
update public.products set sizes = '36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60'
where item_code in (
  'EF133','EF134','EF135','EF136','EFX006','EFX007'
);

-- Gloves: measured across the palm
update public.products set sizes = '6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11'
where item_code in (
  'EF124','EF124-1','EF125','EF126','EF159'
);

-- Shoes: order by EU size
update public.products set sizes = '35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46'
where item_code in (
  'EF131A','EF131B','EF131C','EF131D'
);

-- Chest protectors
update public.products set sizes = 'XXS, XS, S, M, L, XL'
where item_code in (
  'EF128','EF129','EFX004','EFX005'
);

-- Socks
update public.products set sizes = 'XXS, XS, S, M, L, XL'
where item_code = 'EF132';

-- Sabre cuff
update public.products set sizes = 'S, M, L, XL'
where item_code = 'EF127';