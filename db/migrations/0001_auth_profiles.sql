-- ============================================================================
-- Phase 1 — Auth & profiles foundation
-- Run this in the Supabase SQL editor (or `supabase db push`) once per project.
-- Listings / AI tables are added in a later Phase-2 migration.
-- ============================================================================

-- pgvector is enabled now so later phases (embeddings) don't need a re-run.
create extension if not exists vector;

-- ── profiles ────────────────────────────────────────────────────────────────
-- One row per auth user. Created automatically by the handle_new_user trigger
-- from the metadata passed at sign-up.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text not null,
  last_name   text not null,
  username    text not null unique,
  email       text not null unique,
  phone       text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Case-insensitive uniqueness for username + email so "Marija" == "marija".
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));
create unique index if not exists profiles_email_lower_idx    on public.profiles (lower(email));

-- ── saved_listings (wishlist) ───────────────────────────────────────────────
-- Table created here; wired to the UI in Phase 2. listing_id is a free text id
-- now and becomes a real FK once the listings table lands.
create table if not exists public.saved_listings (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  listing_id text not null,
  saved_at   timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- ── updated_at maintenance ──────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- ── create a profile row whenever an auth user is created ───────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, username, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profile email in sync if the auth email changes.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_change on auth.users;
create trigger on_auth_user_email_change
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ── helper RPCs (callable from the client, SECURITY DEFINER) ────────────────
-- Resolve a username to its email so users can sign in with either. Only
-- returns a row for an active account; exposes nothing beyond the email of a
-- username the caller already typed.
create or replace function public.email_for_username(p_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email from public.profiles
  where lower(username) = lower(p_username) and is_active
  limit 1;
$$;

-- True when a username is free (used to gate the register button).
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(p_username)
  );
$$;

grant execute on function public.email_for_username(text) to anon, authenticated;
grant execute on function public.username_available(text)  to anon, authenticated;

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.saved_listings enable row level security;

-- Admin check used by policies. SECURITY DEFINER to avoid recursive RLS on
-- profiles when a policy needs to read the caller's role.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles: a user sees/edits only their own row; admins see all (Phase 4).
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Prevent a normal user from escalating their own role / reactivating. Resets
-- protected columns to their old values unless the actor is an admin.
--
-- The `auth.uid() is not null` guard exempts privileged contexts where there is
-- no end user — the SQL editor and the service-role key (both have a NULL uid).
-- That's what lets you seed the FIRST admin via grant_admin() (see 0004); an
-- authenticated non-admin still can't touch these columns, and the UPDATE RLS
-- policy still stops anon API callers from editing other people's rows.
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- saved_listings: strictly owner-scoped.
drop policy if exists "saved_select_own" on public.saved_listings;
create policy "saved_select_own" on public.saved_listings
  for select using (auth.uid() = user_id);

drop policy if exists "saved_insert_own" on public.saved_listings;
create policy "saved_insert_own" on public.saved_listings
  for insert with check (auth.uid() = user_id);

drop policy if exists "saved_delete_own" on public.saved_listings;
create policy "saved_delete_own" on public.saved_listings
  for delete using (auth.uid() = user_id);
