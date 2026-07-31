-- ============================================================================
-- Migration 0009 — Usage signals (upgrade phase 1)
-- Run this in the Supabase SQL editor once per project (after 0001–0008).
--
-- What it adds — implicit usage signals that feed the recommendation system and
-- the behavioural analysis (upgrade phases 7–12):
--   • listing_views    — one row per listing detail view (logged-in or anon).
--   • search_history   — one row per intentional search (criteria snapshot).
--   • saved_searches   — a search a user stores to be notified about later.
--
-- Conventions match 0001: owner-scoped RLS (template: saved_listings), listing_id
-- kept as free text (no FK, like saved_listings), is_admin() for admin reads.
-- Idempotent throughout (create ... if not exists, drop policy + create policy),
-- so it is safe to re-run.
-- ============================================================================

-- ── listing_views ───────────────────────────────────────────────────────────
-- Implicit interest signal. user_id is nullable so anonymous views can be
-- recorded too; the server action stays best-effort and never blocks a request.
create table if not exists public.listing_views (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles (id) on delete cascade,
  listing_id text not null,
  viewed_at  timestamptz not null default now()
);

create index if not exists listing_views_user_idx    on public.listing_views (user_id);
create index if not exists listing_views_listing_idx on public.listing_views (listing_id);
create index if not exists listing_views_viewed_idx  on public.listing_views (viewed_at);

-- ── search_history ──────────────────────────────────────────────────────────
-- Snapshot of the criteria for an intentional search (agent or filter search).
-- criteria is the same JSON shape the app already passes around.
create table if not exists public.search_history (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles (id) on delete cascade,
  criteria   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists search_history_user_idx    on public.search_history (user_id);
create index if not exists search_history_created_idx on public.search_history (created_at);

-- ── saved_searches ──────────────────────────────────────────────────────────
-- A stored search (owner-scoped, always attached to a logged-in user). Used by
-- the "saved searches & notifications" phase; uuid id avoids client enumeration.
create table if not exists public.saved_searches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null,
  criteria   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists saved_searches_user_idx on public.saved_searches (user_id);

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.listing_views  enable row level security;
alter table public.search_history enable row level security;
alter table public.saved_searches enable row level security;

-- listing_views: a caller may only attribute a view to themselves (or leave it
-- anonymous); reads are own rows only, admins see all for analytics.
drop policy if exists "listing_views_insert_self" on public.listing_views;
create policy "listing_views_insert_self" on public.listing_views
  for insert with check (user_id is null or auth.uid() = user_id);

drop policy if exists "listing_views_select_own" on public.listing_views;
create policy "listing_views_select_own" on public.listing_views
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "listing_views_delete_own" on public.listing_views;
create policy "listing_views_delete_own" on public.listing_views
  for delete using (auth.uid() = user_id);

-- search_history: same shape as listing_views.
drop policy if exists "search_history_insert_self" on public.search_history;
create policy "search_history_insert_self" on public.search_history
  for insert with check (user_id is null or auth.uid() = user_id);

drop policy if exists "search_history_select_own" on public.search_history;
create policy "search_history_select_own" on public.search_history
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "search_history_delete_own" on public.search_history;
create policy "search_history_delete_own" on public.search_history
  for delete using (auth.uid() = user_id);

-- saved_searches: strictly owner-scoped (create / read / rename / delete own).
drop policy if exists "saved_searches_select_own" on public.saved_searches;
create policy "saved_searches_select_own" on public.saved_searches
  for select using (auth.uid() = user_id);

drop policy if exists "saved_searches_insert_own" on public.saved_searches;
create policy "saved_searches_insert_own" on public.saved_searches
  for insert with check (auth.uid() = user_id);

drop policy if exists "saved_searches_update_own" on public.saved_searches;
create policy "saved_searches_update_own" on public.saved_searches
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saved_searches_delete_own" on public.saved_searches;
create policy "saved_searches_delete_own" on public.saved_searches
  for delete using (auth.uid() = user_id);
