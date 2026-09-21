-- Migration: 0013_shop_product_details
-- Adds category and sizing fields to support the shop wireframe.

alter table public.products
  add column category text,
  add column sizes text,
  add column in_stock boolean not null default true;

create index products_category_idx on public.products (category);