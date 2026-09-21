-- Migration: 0014_shop_orders
-- Customer orders for the equipment shop.
-- A cart is simply an order with status 'draft'. Submitting it changes
-- the status to 'submitted', so there is no separate cart table.

-- ============================================================
-- 1. Orders
-- ============================================================
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Each customer may only have one draft order (their cart) at a time.
create unique index orders_one_draft_per_user
  on public.orders (user_id)
  where status = 'draft';

create index orders_user_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status);

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 2. Order items
-- ============================================================
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id bigint not null references public.products(id),  quantity integer not null default 1 check (quantity > 0),
  size text,
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);

-- ============================================================
-- 3. Row level security
-- ============================================================
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Users can read own orders"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "Users can create own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

create policy "Users can update own draft orders"
  on public.orders for update
  using (auth.uid() = user_id and status = 'draft');

create policy "Users can delete own draft orders"
  on public.orders for delete
  using (auth.uid() = user_id and status = 'draft');

create policy "Admins can read all orders"
  on public.orders for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update all orders"
  on public.orders for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can read own order items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );

create policy "Users can manage own draft order items"
  on public.order_items for all
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
        and orders.status = 'draft'
    )
  );

create policy "Admins can read all order items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );