-- ============================================================================
-- Migration 0010 — Usage retention (upgrade phase 1)
-- Run this in the Supabase SQL editor after 0009_usage.sql.
--
-- Keeps only the last 90 days of the implicit usage signals (listing_views,
-- search_history) via a daily pg_cron job, so those tables don't grow without
-- bound. saved_searches is user content and is NEVER auto-deleted.
--
-- If the "create extension" line errors, enable pg_cron once via
--   Dashboard → Database → Extensions → pg_cron
-- and then re-run this file. Idempotent (safe to re-run).
-- ============================================================================

create extension if not exists pg_cron;

-- Remove any previous version of the job first (no-op when it doesn't exist),
-- so re-running this file never creates a duplicate schedule.
select cron.unschedule(jobid) from cron.job where jobname = 'usage_retention_90d';

-- Daily at 03:17 UTC: purge rows older than 90 days.
select cron.schedule(
  'usage_retention_90d',
  '17 3 * * *',
  $$
    delete from public.listing_views  where viewed_at  < now() - interval '90 days';
    delete from public.search_history where created_at < now() - interval '90 days';
  $$
);
