-- ============================================================================
-- Phase 4 — Admin panel
-- Run this in the Supabase SQL editor once per project (after 0001–0003).
--
-- What it adds:
--   • An RLS policy letting admins UPDATE any profile row (so they can
--     deactivate/reactivate accounts and grant/revoke the admin role). Normal
--     users keep the existing owner-only update policy from 0001; the
--     guard_profile_privileged_columns() trigger already prevents non-admins
--     from touching role / is_active.
--   • Listings already have an admin full-CRUD policy (listings_admin_write in
--     0002), so manual add/edit/delete + embedding regeneration need no new
--     policy here.
-- ============================================================================

-- profiles: admins may update any row (deactivate accounts, change roles).
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- Convenience: promote a user to admin by email. Run once to seed your own
-- admin account, e.g.:
--   select public.grant_admin('you@example.com');
--
-- NOTE: this only works because guard_profile_privileged_columns() (0001)
-- exempts NULL-uid contexts like the SQL editor. If you ran an older 0001 where
-- the guard reset role unconditionally, re-run that function definition first,
-- otherwise this update is silently reverted by the trigger.
create or replace function public.grant_admin(p_email text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set role = 'admin' where lower(email) = lower(p_email);
$$;
