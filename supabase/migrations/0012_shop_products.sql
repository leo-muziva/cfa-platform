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

  