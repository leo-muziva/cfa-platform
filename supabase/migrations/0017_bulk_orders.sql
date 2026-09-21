-- Migration: 0017_bulk_orders
-- CFA ships from China in bulk, so customer orders pool together until
-- they are worth enough to justify a shipment. There is always exactly
-- one bulk order with status 'collecting'; submitted orders join it.

-- ============================================================
-- 1. Bulk orders
-- ============================================================
create table public.bulk_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'collecting'
    check (status in ('collecting', 'placed', 'shipping', 'arrived', 'distributed', 'cancelled')),
  threshold numeric(10, 2) not null default 15000,
  placed_at timestamptz,
  estimated_arrival date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one bulk order may be collecting at a time.
create unique index bulk_orders_one_collecting
  on public.bulk_orders (status)
  where status = 'collecting';

create trigger bulk_orders_updated_at
  before update on public.bulk_orders
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 2. Link customer orders to a bulk order
-- ============================================================
alter table public.orders
  add column bulk_order_id uuid references public.bulk_orders(id);

create index orders_bulk_idx on public.orders (bulk_order_id);

-- ============================================================
-- 3. Attach an order to the open bulk order when it is submitted
-- ============================================================
create or replace function public.attach_to_bulk_order()
returns trigger
language plpgsql
security definer
as $$
declare
  open_bulk uuid;
begin
  -- Only act when an order becomes submitted.
  if new.status = 'submitted' and (old.status is distinct from 'submitted') then

    select id into open_bulk
    from public.bulk_orders
    where status = 'collecting'
    limit 1;

    -- No bulk order is collecting, so start one.
    if open_bulk is null then
      insert into public.bulk_orders (reference)
      values ('BO-' || to_char(now(), 'YYYYMMDD-HH24MISS'))
      returning id into open_bulk;
    end if;

    new.bulk_order_id = open_bulk;
  end if;

  return new;
end;
$$;

create trigger orders_attach_to_bulk
  before update on public.orders
  for each row execute function public.attach_to_bulk_order();

-- ============================================================
-- 4. Row level security
-- ============================================================
alter table public.bulk_orders enable row level security;

-- Everyone can see bulk orders — this is what powers the progress bar.
create policy "Anyone can read bulk orders"
  on public.bulk_orders for select
  using (true);

create policy "Admins can manage bulk orders"
  on public.bulk_orders for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- 5. Start the first bulk order
-- ============================================================
insert into public.bulk_orders (reference, status)
values ('BO-0001', 'collecting');