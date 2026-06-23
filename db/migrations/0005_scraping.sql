-- ============================================================================
-- Phase 5 — Scraping & ingestion pipeline
-- Run in the Supabase SQL editor after 0004_admin.sql.
--
-- Adds the ingest-side machinery the Playwright scrapers need:
--   • dedupe / freshness columns on `listings`
--   • a `listing_images` provenance table (source URL → Storage path)
--   • a public `listing-images` Storage bucket (images copied off the source)
--   • a `scrape_runs` log so the admin "trigger update" button can enqueue and
--     report runs, and the worker can pick up queued work.
--
-- The scrapers themselves run out-of-process (Playwright) with the SERVICE ROLE
-- key, which bypasses RLS — so the policies below only concern app-facing reads
-- and the admin-triggered enqueue.
-- ============================================================================

-- ── listings: dedupe + freshness ────────────────────────────────────────────
-- external_id  = the source's own ad id (stable across re-crawls)
-- content_hash = hash of the normalized fields; lets a re-crawl skip unchanged
--                rows (no needless UPDATE / re-embed)
-- last_seen_at = last crawl that still found this ad live at the source; drives
--                "mark inactive when it disappears" reconciliation.
alter table public.listings add column if not exists external_id  text;
alter table public.listings add column if not exists content_hash text;
alter table public.listings add column if not exists last_seen_at  timestamptz;

-- One ad per (source, external_id). Scraped ids are `${source}-${external_id}`
-- so the primary key already dedupes; this guards against accidental dupes and
-- documents the natural key.
create unique index if not exists listings_source_external_idx
  on public.listings (source, external_id)
  where external_id is not null;

create index if not exists listings_last_seen_idx on public.listings (source, last_seen_at);

-- ── listing_images: provenance for copied media ─────────────────────────────
-- The browse UI still reads the denormalized `listings.images` text[] (public
-- Storage URLs). This table records where each image came from and where it
-- landed in our bucket, so we can re-fetch or prune without re-scraping.
create table if not exists public.listing_images (
  id           uuid primary key default gen_random_uuid(),
  listing_id   text not null references public.listings (id) on delete cascade,
  storage_path text not null,            -- path within the `listing-images` bucket
  url          text not null,            -- public URL served to the app
  source_url   text,                     -- original (hotlink) URL it was copied from
  position     int  not null default 0,  -- gallery order
  created_at   timestamptz not null default now(),
  unique (listing_id, position)
);
create index if not exists listing_images_listing_idx on public.listing_images (listing_id, position);

alter table public.listing_images enable row level security;

-- Readable alongside the listings they belong to (active listings are public;
-- admins see all). Writes are service-role only (scraper) → no write policy.
drop policy if exists "listing_images_select" on public.listing_images;
create policy "listing_images_select" on public.listing_images
  for select using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and (l.status = 'active' or public.is_admin())
    )
  );

-- ── scrape_runs: enqueue + audit log ────────────────────────────────────────
create table if not exists public.scrape_runs (
  id           uuid primary key default gen_random_uuid(),
  source       text not null default 'all',         -- 'all' | 'njuskalo' | 'indeks' | …
  status       text not null default 'queued'
                 check (status in ('queued', 'running', 'success', 'error')),
  trigger      text not null default 'manual',       -- 'manual' | 'cron'
  triggered_by uuid references auth.users (id) on delete set null,
  found        int  not null default 0,
  inserted     int  not null default 0,
  updated      int  not null default 0,
  deactivated  int  not null default 0,
  error        text,
  queued_at    timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);
create index if not exists scrape_runs_status_idx on public.scrape_runs (status, queued_at);
create index if not exists scrape_runs_recent_idx on public.scrape_runs (queued_at desc);

alter table public.scrape_runs enable row level security;

-- Admins may read the log and enqueue manual runs from the panel. The worker
-- (service role) updates rows as it processes them, bypassing RLS.
drop policy if exists "scrape_runs_admin_select" on public.scrape_runs;
create policy "scrape_runs_admin_select" on public.scrape_runs
  for select using (public.is_admin());

drop policy if exists "scrape_runs_admin_insert" on public.scrape_runs;
create policy "scrape_runs_admin_insert" on public.scrape_runs
  for insert with check (public.is_admin() and triggered_by = auth.uid());

-- ── Storage bucket for copied images ────────────────────────────────────────
-- Public bucket → images are served by public URL (resilient to the source
-- removing or hotlink-blocking the original). Uploads are done by the scraper
-- with the service role (bypasses RLS); public read is implicit for public
-- buckets, plus an explicit select policy for clarity.
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

drop policy if exists "listing_images_public_read" on storage.objects;
create policy "listing_images_public_read" on storage.objects
  for select using (bucket_id = 'listing-images');
