-- ============================================================================
-- Phase 6 hardening — shared per-IP rate limiter for /api/* (edge middleware)
-- Run in the Supabase SQL editor after 0007_llm_budget.sql.
--
-- A fixed-window counter keyed by "<ip>:<bucket>:<window>". The middleware calls
-- rate_limit_hit() on every /api request; it returns false once an IP exceeds the
-- bucket's cap within the window. Shared across the serverless fleet (unlike the
-- old in-memory limiter). Pairs with 0007's global daily LLM budget: this caps
-- request RATE per IP, that caps total LLM SPEND per day.
-- ============================================================================

create table if not exists public.rate_limits (
  bucket  text primary key,           -- "<ip>:<name>:<window-index>"
  count   integer not null default 0,
  expires timestamptz not null        -- end of this window (for cleanup)
);
create index if not exists rate_limits_expires_idx on public.rate_limits (expires);

-- Atomically count one hit in the current fixed window and report whether the
-- caller is still under the cap. SECURITY DEFINER so the anon role can call it
-- without table write grants.
create or replace function public.rate_limit_hit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w bigint := floor(extract(epoch from now()) / p_window_seconds);
  b text   := p_key || ':' || w;
  c integer;
begin
  insert into public.rate_limits (bucket, count, expires)
    values (b, 1, to_timestamp((w + 1) * p_window_seconds))
  on conflict (bucket) do update set count = public.rate_limits.count + 1
  returning count into c;
  return c <= p_max;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public;
grant execute on function public.rate_limit_hit(text, integer, integer) to anon, authenticated;

alter table public.rate_limits enable row level security; -- no policies: definer-only

-- Old windows are harmless (tiny rows) but can be swept periodically.
create or replace function public.purge_rate_limits()
returns void language sql security definer set search_path = public as $$
  delete from public.rate_limits where expires < now() - interval '1 hour';
$$;
