-- Migration: 0028_order_handedness
-- Fencers hold the weapon in one hand, so some equipment is made for
-- right or left handers. Which hand is a fact about the ORDER, not the
-- product, so it sits on the order line next to the size.

-- Records the customer's choice.
alter table public.order_items
  add column handedness text
    check (handedness in ('right', 'left'));

-- Marks which products need the customer to choose.
alter table public.products
  add column needs_handedness boolean not null default false;

-- Complete weapons ship with a grip moulded to one hand; grips
-- themselves are moulded; jackets, gloves and lames are cut for the
-- weapon arm.
update public.products set needs_handedness = true
where item_code in (
  -- Complete weapons
  'EF01','EF02','EF03','EF04','EF05','EF07','EF09','EF11',
  'EF13','EF15','EF17','EF19',

  -- Pistol grips
  'EF77','EF78','EF79','EF82a','EF82b','EF83','EF84',

  -- Jackets
  'EF118','EF195','EF201',

  -- Gloves
  'EF124','EF124-1','EF125','EF126','EF159',

  -- Lames
  'EF133','EF134','EF135','EF136','EFX006','EFX007'
);