-- ============================================================================
-- Migration 0012 — Zagreb districts become neighborhoods (upgrade phase 2)
-- Run in the Supabase SQL editor after 0011_zagreb.sql.
--
-- Zagreb is ONE city. Every listing in the city of Zagreb (county "Grad Zagreb"
-- / "Zagreb", or a district token that itself names Zagreb) is normalized to
-- city "Zagreb", with the district (Sesvete, Trnje, Maksimir, Novi Zagreb …)
-- kept as the neighborhood. The finer sub-area (e.g. "Sesvetski Kobiljak") is
-- dropped so the neighborhood level is the recognizable Zagreb kvart. Mirrors
-- splitLocation() + fetchLocations().
--
-- Supersedes the narrower 0011 (which only collapsed "Novi Zagreb …" tokens);
-- rows already canonical ("Zagreb, <x>" or "Zagreb") are skipped, so this is
-- idempotent and safe to re-run. The surrounding county "Zagrebačka" (Velika
-- Gorica, Samobor, …) is deliberately NOT matched.
--
-- NOTE: `city` is part of the JS content_hash + embedding text, so touched rows
-- are updated + re-embedded on the next scrape (one-time; filtering reads `city`
-- directly and is correct immediately).
-- ============================================================================

update public.listings
set city = case
    when coalesce(split_part(city, ', ', 1), '') = '' then 'Zagreb'
    else 'Zagreb, ' || split_part(city, ', ', 1)  -- 'Zagreb, <district>' (sub-area dropped)
  end
where (
    lower(btrim(county)) in ('grad zagreb', 'zagreb')          -- Zagreb city county
    or lower(split_part(city, ', ', 1)) like '%zagreb%'        -- district names Zagreb
  )
  and split_part(city, ', ', 1) <> 'Zagreb';                   -- already canonical → skip
