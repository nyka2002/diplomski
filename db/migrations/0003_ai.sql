-- ============================================================================
-- Phase 3 — AI conversational filtering agent
-- Run in the Supabase SQL editor after 0002_listings.sql.
-- (listings.embedding vector(1536) already exists from 0002.)
-- ============================================================================

-- ── Conversation memory (per-user) ──────────────────────────────────────────
create table if not exists public.ai_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references public.ai_sessions (id) on delete cascade,
  role               text not null check (role in ('user', 'assistant')),
  content            text not null,
  extracted_criteria jsonb,
  created_at         timestamptz not null default now()
);
create index if not exists ai_messages_session_idx on public.ai_messages (session_id, created_at);

-- RLS: a user can only see/modify their own sessions and the messages under them.
alter table public.ai_sessions enable row level security;
drop policy if exists "ai_sessions_owner" on public.ai_sessions;
create policy "ai_sessions_owner" on public.ai_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.ai_messages enable row level security;
drop policy if exists "ai_messages_owner" on public.ai_messages;
create policy "ai_messages_owner" on public.ai_messages
  for all
  using (exists (select 1 from public.ai_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.ai_sessions s where s.id = session_id and s.user_id = auth.uid()));

-- ── Semantic relevance ranking (pgvector) ───────────────────────────────────
-- Cosine-distance index on listing embeddings (populated by scripts/embed-listings.mjs).
create index if not exists listings_embedding_idx
  on public.listings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Order a hard-filtered candidate set by similarity to a query embedding.
create or replace function public.match_listings(
  query_embedding vector(1536),
  candidate_ids text[],
  match_count int default 50
)
returns table (id text, similarity float)
language sql
stable
as $$
  select l.id, 1 - (l.embedding <=> query_embedding) as similarity
  from public.listings l
  where l.id = any(candidate_ids)
    and l.embedding is not null
  order by l.embedding <=> query_embedding
  limit match_count;
$$;
