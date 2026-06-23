-- ============================================================================
-- Phase 6 hardening — global daily LLM-call budget (cost circuit breaker)
-- Run in the Supabase SQL editor after 0006_county.sql.
--
-- The per-IP rate limit in /api/ai lives in process memory, which is per-instance
-- and resets on cold starts across Vercel's serverless fleet — so it's not a real
-- spend ceiling. This adds a SHARED, atomic daily counter that every OpenAI-backed
-- path (AI chat + relevance embeddings) increments and checks, bounding total
-- spend no matter how requests are distributed. The OpenAI dashboard usage limit
-- remains the ultimate backstop.
-- ============================================================================

create table if not exists public.llm_budget (
  day   date primary key,
  count integer not null default 0
);

-- Atomically count one call for today and report whether we're still under the
-- cap. SECURITY DEFINER so the anon/auth roles can bump it without table-level
-- write grants; it only ever touches this one counter.
create or replace function public.bump_llm_budget(p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c integer;
begin
  insert into public.llm_budget (day, count)
    values (current_date, 1)
  on conflict (day) do update set count = public.llm_budget.count + 1
  returning count into c;
  return c <= p_max;
end;
$$;

-- Callable by the app's anon/authenticated roles (writes happen inside the
-- SECURITY DEFINER function, not directly against the table).
revoke all on function public.bump_llm_budget(integer) from public;
grant execute on function public.bump_llm_budget(integer) to anon, authenticated;

-- The table itself stays locked down (RLS on, no policies → only the definer
-- function and the service role can touch it).
alter table public.llm_budget enable row level security;
