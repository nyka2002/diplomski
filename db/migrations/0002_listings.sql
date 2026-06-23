-- ============================================================================
-- Phase 2 — Listings on real data
-- Run in the Supabase SQL editor AFTER 0001_auth_profiles.sql, then run the
-- seed in db/seed/0001_listings.sql.
--
-- Pragmatic swap vs the plan: images are stored as a text[] column here. The
-- separate listing_images table + Supabase Storage copy is introduced in
-- Phase 5 (scraping), where source images are downloaded into our own bucket.
-- ============================================================================

create table if not exists public.listings (
  id            text primary key,
  type          text not null check (type in ('sale', 'rent')),
  title         text not null,
  title_hr      text not null,
  price_eur     numeric not null,            -- numeric value for sorting
  price_display text not null,               -- e.g. "€185,000" / "€650/mo"
  city          text not null,               -- e.g. "Zagreb, Centar"
  area_m2       numeric not null default 0,  -- base floor area, for sorting
  rooms         numeric not null default 0,  -- bedrooms (0 = studio)
  description    text not null,
  description_hr text not null,
  images        text[] not null default '{}',
  specs         jsonb not null default '[]'::jsonb,  -- [{label,labelHr,value,valueHr}]
  seller        jsonb not null default '{}'::jsonb,  -- {name,phone,email,agency}
  attributes    jsonb not null default '{}'::jsonb,  -- {balcony,parking,furnished,pets}
  posted_at     timestamptz not null default now(),
  source        text not null default 'manual',
  source_url    text,
  status        text not null default 'active' check (status in ('active', 'inactive', 'removed')),
  embedding     vector(1536),                -- populated in Phase 3
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Indexes for the sort/filter dimensions.
create index if not exists listings_type_idx     on public.listings (type);
create index if not exists listings_status_idx   on public.listings (status);
create index if not exists listings_posted_idx   on public.listings (posted_at desc);
create index if not exists listings_price_idx     on public.listings (price_eur);
create index if not exists listings_area_idx      on public.listings (area_m2);
create index if not exists listings_rooms_idx     on public.listings (rooms);
create index if not exists listings_city_idx      on public.listings (city);

-- Keep updated_at fresh (reuses the function from 0001).
drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.handle_updated_at();

-- ── RLS: anyone can read active listings; only admins write (Phase 4) ───────
alter table public.listings enable row level security;

drop policy if exists "listings_select_active" on public.listings;
create policy "listings_select_active" on public.listings
  for select using (status = 'active' or public.is_admin());

drop policy if exists "listings_admin_write" on public.listings;
create policy "listings_admin_write" on public.listings
  for all using (public.is_admin()) with check (public.is_admin());

-- ── saved_listings now references real listings ─────────────────────────────
-- (the wishlist table was created empty in 0001, so adding the FK is safe).
alter table public.saved_listings
  drop constraint if exists saved_listings_listing_id_fkey;
alter table public.saved_listings
  add constraint saved_listings_listing_id_fkey
  foreign key (listing_id) references public.listings (id) on delete cascade;
