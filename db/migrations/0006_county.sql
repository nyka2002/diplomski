-- ============================================================================
-- Phase 5 follow-up — county as a top-level location dimension
-- Run in the Supabase SQL editor after 0005_scraping.sql.
--
-- Scraped sources (Njuškalo) report location as "County, City, Neighborhood".
-- We store the county in its own column and keep `city` as the existing
-- "City, Neighborhood" string, so the county → city → neighborhood cascade in
-- the browse filters works uniformly across seeded and scraped data.
-- ============================================================================

alter table public.listings add column if not exists county text;
create index if not exists listings_county_idx on public.listings (county);

-- ── Backfill existing scraped rows ───────────────────────────────────────────
-- Rows ingested before this column existed stored the full
-- "County, City, Neighborhood" in `city`. Split off the leading county and
-- collapse `city` back to "City, Neighborhood".
update public.listings
set county = split_part(city, ', ', 1),
    city   = substring(city from position(', ' in city) + 2)
where source <> 'manual'
  and (county is null or county = '')
  and city ~ ', .*, ';   -- has at least two ", " separators (3+ parts)

-- Two-part scraped rows ("County, City", no neighborhood): lift the county out
-- and leave the city alone.
update public.listings
set county = split_part(city, ', ', 1),
    city   = split_part(city, ', ', 2)
where source <> 'manual'
  and (county is null or county = '')
  and city ~ ', '
  and city !~ ', .*, ';

-- ── Backfill seed rows ───────────────────────────────────────────────────────
-- The demo listings are all in Zagreb ("Zagreb, <neighborhood>").
update public.listings
set county = 'Grad Zagreb'
where source = 'manual'
  and (county is null or county = '')
  and city like 'Zagreb,%';
