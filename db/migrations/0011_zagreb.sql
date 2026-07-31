-- ============================================================================
-- Migration 0011 — collapse "Zagreb" city tokens (upgrade phase 2)
-- Run in the Supabase SQL editor after 0010_usage_retention.sql.
--
-- Groups every listing whose city token contains "Zagreb" (e.g.
-- "Novi Zagreb - Istok", "Novi Zagreb - Zapad") under the single canonical
-- city "Zagreb", keeping any neighborhood remainder. Only the leading city
-- token (the part before the first ", ") is rewritten; a neighborhood that
-- happens to contain "Zagreb" is left untouched. Mirrors splitLocation() and
-- fetchLocations() in the app. Idempotent (rows already "Zagreb" are skipped).
--
-- NOTE: `city` is part of the JS-computed content_hash and of the embedding
-- text, so these rows will be updated + re-embedded on the next scrape (the
-- stored content_hash no longer matches). That is expected and one-time; it
-- does not affect correctness of filtering, which reads `city` directly.
-- ============================================================================

update public.listings
set city = case
    when position(', ' in city) > 0
      then 'Zagreb' || substring(city from position(', ' in city))  -- 'Zagreb' + ', <neighborhood…>'
    else 'Zagreb'
  end
where (
    -- leading city token (before the first ", ", or the whole string)
    case when position(', ' in city) > 0
      then substring(city from 1 for position(', ' in city) - 1)
      else city
    end
  ) ilike '%zagreb%'
  and (
    case when position(', ' in city) > 0
      then substring(city from 1 for position(', ' in city) - 1)
      else city
    end
  ) <> 'Zagreb';  -- already canonical → skip (keeps this migration idempotent)
