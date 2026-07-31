-- ============================================================================
-- Migration 0017 — Saved-search "last seen" watermark (upgrade phase 9)
-- Run this in the Supabase SQL editor once per project (after 0016).
--
-- The saved_searches table already exists (0009). This adds a per-search
-- watermark used by the in-app new-listing notifications: the app counts active
-- listings that match the search and first appeared (listings.created_at) after
-- this timestamp. When null, the search's own created_at is the baseline, so a
-- freshly saved search never notifies about the existing catalogue — only about
-- listings that arrive afterwards. Visiting /saved-searches advances the
-- watermark to now(), clearing the "new" badge.
--
-- No table/RLS changes (saved_searches already has owner-scoped RLS from 0009).
-- Idempotent / safe to re-run.
-- ============================================================================

alter table public.saved_searches
  add column if not exists last_seen_at timestamptz;
