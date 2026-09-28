-- Migration: 0026_favourites
-- Lets members save products they're interested in, so they can find
-- them again without searching. One row per member per product.

create table public.favourites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),

  -- Stops the same product being favourited twice by one member.
  unique (user_id, product_id)
);

create index favourites_user_idx on public.favourites (user_id);

alter table public.favourites enable row level security;

-- Each member sees only their own favourites.
create policy "Users can read own favourites"
  on public.favourites for select
  using (auth.uid() = user_id);

create policy "Users can add own favourites"
  on public.favourites for insert
  with check (auth.uid() = user_id);

create policy "Users can remove own favourites"
  on public.favourites for delete
  using (auth.uid() = user_id);