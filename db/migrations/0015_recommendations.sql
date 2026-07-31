-- ============================================================================
-- Migration 0015 — Recommendation RPCs (upgrade phase 8)
-- Run this in the Supabase SQL editor once per project (after 0001–0014).
--
-- What it adds — two read-only SQL functions over the existing listing
-- embeddings (listings.embedding vector(1536), populated by
-- scripts/embed-listings.mjs). No new tables, no schema changes:
--   • similar_listings(p_listing_id, match_count) — nearest listings of the same
--     type to a given one, by cosine distance ("similar listings").
--   • recommend_for_user(match_count) — content-based personal recommendations:
--     a taste profile is the average embedding of the caller's saved (weighted
--     twice) and viewed (weighted once) listings; the nearest active listings
--     the user hasn't seen are returned ("recommended for you").
--
-- Security: both are SECURITY INVOKER (the default), so existing RLS applies.
--   • similar_listings reads only public.listings (RLS: active rows are world-
--     readable), so it works for anonymous visitors on a listing's detail page.
--   • recommend_for_user reads the caller's own saved_listings / listing_views
--     via auth.uid() under their owner-scoped RLS; for an anonymous caller
--     auth.uid() is null, the profile is empty and it simply returns no rows.
--
-- No new OpenAI calls: the profile is built by averaging already-stored vectors
-- in the database. Duplicate (cross-source) and inactive rows are excluded.
-- Idempotent (create or replace function), so it is safe to re-run.
-- ============================================================================

-- ── Similar listings ────────────────────────────────────────────────────────
create or replace function public.similar_listings(
  p_listing_id text,
  match_count int default 6
)
returns table (id text, similarity float)
language sql
stable
as $$
  with target as (
    select embedding, type
    from public.listings
    where id = p_listing_id
  )
  select l.id, 1 - (l.embedding <=> t.embedding) as similarity
  from public.listings l, target t
  where t.embedding is not null
    and l.id <> p_listing_id
    and l.status = 'active'
    and l.embedding is not null
    and l.duplicate_of is null
    and l.type = t.type
  order by l.embedding <=> t.embedding
  limit match_count;
$$;

-- ── Personal recommendations (content-based) ────────────────────────────────
-- Taste profile = average of the caller's saved-listing embeddings (counted
-- twice, a stronger signal than a view) and distinct viewed-listing embeddings
-- (counted once). Recommends the nearest active, non-duplicate listings the
-- caller has neither saved nor viewed. Returns nothing on a cold start (no
-- saves/views) — the caller then falls back to newest listings.
create or replace function public.recommend_for_user(
  match_count int default 12
)
returns table (id text, similarity float)
language sql
stable
as $$
  with saved_emb as (
    select l.embedding
    from public.saved_listings s
    join public.listings l on l.id = s.listing_id
    where s.user_id = auth.uid()
      and l.embedding is not null
  ),
  viewed_emb as (
    select l.embedding
    from (
      select distinct listing_id
      from public.listing_views
      where user_id = auth.uid()
    ) v
    join public.listings l on l.id = v.listing_id
    where l.embedding is not null
  ),
  profile_rows as (
    select embedding from saved_emb
    union all
    select embedding from saved_emb   -- saved counted twice (stronger than a view)
    union all
    select embedding from viewed_emb
  ),
  profile as (
    select avg(embedding) as vec from profile_rows
  ),
  seen as (
    select listing_id from public.saved_listings where user_id = auth.uid()
    union
    select listing_id from public.listing_views  where user_id = auth.uid()
  )
  select l.id, 1 - (l.embedding <=> p.vec) as similarity
  from public.listings l, profile p
  where p.vec is not null
    and l.status = 'active'
    and l.embedding is not null
    and l.duplicate_of is null
    and l.id not in (select listing_id from seen)
  order by l.embedding <=> p.vec
  limit match_count;
$$;
