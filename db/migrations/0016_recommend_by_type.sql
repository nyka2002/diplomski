-- ============================================================================
-- Migration 0016 — Type-scoped personal recommendations (upgrade phase 8)
-- Run this in the Supabase SQL editor once per project (after 0015).
--
-- Why: the browse pages (/buy, /rent) show a personal-recommendations row at the
-- top, but a sale page must only recommend sale listings and a rent page only
-- rent listings. This replaces recommend_for_user with a version that takes an
-- optional p_type ('sale' | 'rent'); when null (the home page) both types are
-- recommended, exactly as before.
--
-- The taste profile is still built from ALL of the caller's saved/viewed
-- listings (a user's preferences in size, location and amenities carry across
-- sale and rent); only the recommended candidates are restricted to p_type.
--
-- The old single-argument function is dropped first so the two signatures don't
-- become an ambiguous overload for PostgREST. Everything else (security, cold
-- start, exclusions) is unchanged from 0015. Idempotent / safe to re-run.
-- ============================================================================

drop function if exists public.recommend_for_user(int);

create or replace function public.recommend_for_user(
  match_count int default 12,
  p_type text default null
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
    and (p_type is null or l.type = p_type)
    and l.id not in (select listing_id from seen)
  order by l.embedding <=> p.vec
  limit match_count;
$$;
