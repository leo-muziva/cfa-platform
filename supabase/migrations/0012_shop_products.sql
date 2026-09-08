-- Shop: product catalogue
-- Products are keyed on item_code (supplier codes like EF105) so the
-- catalogue can be re-imported from CFA's spreadsheet without duplicating rows.

create table public.products (
  id           bigint generated always as identity primary key,
  item_code    text not null unique,
  name         text not null,
  description  text,
  price        numeric(10,2) not null default 0 check (price >= 0),
  image_path   text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index products_name_idx on public.products (lower(name));
create index products_active_idx on public.products (is_active);

-- Keep updated_at current on every change; Postgres has no built-in for this.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

-- Anyone may read active products; writes are service-role only for now.
alter table public.products enable row level security;

create policy "anyone can read active products"
  on public.products
  for select
  using (is_active = true);

  -- ============================================================
-- 3. Seed catalogue (placeholder until CFA supplies the spreadsheet)
-- ============================================================
insert into public.products (item_code, name, description, price) values
  ('EF101', 'Fencing Mask - Senior', 'FIE-certified 1600N fencing mask, senior sizing', 1850.00),
  ('EF102', 'Fencing Mask - Junior', 'Junior 350N training mask', 950.00),
  ('EF103', 'Foil Blade - Size 5', 'Standard size 5 foil blade, non-electric', 420.00),
  ('EF104', 'Epee Blade - Size 5', 'Standard size 5 epee blade, non-electric', 480.00),
  ('EF106', 'Fencing Jacket - Senior', '800N fencing jacket, right-handed', 1250.00),
  ('EF107', 'Fencing Jacket - Junior', '350N training jacket', 780.00),
  ('EF108', 'Chest Protector', 'Moulded chest protector, sizes S-XL', 390.00),
  ('EF109', 'Fencing Glove', 'Padded fencing glove, right hand', 285.00),
  ('EF110', 'Body Wire - Foil', '2m foil body wire', 220.00),
  ('EF111', 'Fencing Breeches', '350N breeches with knee padding', 890.00),
  ('EF112', 'Fencing Shoes', 'Lateral-support fencing shoes', 1450.00),
  ('EF113', 'Equipment Bag', 'Rolling equipment bag, 3-weapon capacity', 1100.00);