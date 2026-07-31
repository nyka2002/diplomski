-- Phase 4 — cross-source near-duplicate marking.
--
-- The same physical apartment is sometimes listed on more than one classifieds
-- site. content_hash only dedupes within a single source, so cross-source
-- near-duplicates slip through. We mark them NON-DESTRUCTIVELY: a duplicate row
-- points at its canonical listing via duplicate_of; canonical rows and unique
-- rows keep duplicate_of = null. Browse/search hide rows where duplicate_of is
-- not null. Fully reversible (set the column back to null), and no row is ever
-- deleted. Marking is done offline by scripts/dedup-listings.mjs.
--
-- Idempotent: safe to re-run.
alter table public.listings
  add column if not exists duplicate_of text
  references public.listings(id) on delete set null;

create index if not exists listings_duplicate_of_idx on public.listings (duplicate_of);

comment on column public.listings.duplicate_of is
  'If set, this listing is a cross-source near-duplicate of the referenced canonical listing and is hidden from browse (Phase 4). Null = canonical or unique.';
