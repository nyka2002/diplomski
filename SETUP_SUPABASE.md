# Supabase setup (Phase 1)

Phase 1 replaces the mock login with real authentication and persisted user
profiles, backed by Supabase. Follow these steps once.

> The app runs without this — but sign-in / register will say *"Authentication
> is not configured yet."* until the keys below are in place.

## 1. Create a project

1. Go to <https://supabase.com> → **New project**. Pick a name and a strong DB
   password (you won't need it for the app).
2. Wait for it to finish provisioning.

## 2. Add the environment variables

In **Project Settings → API**, copy the two public values into `.env.local`
(create it by copying `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
```

`SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are only needed in later phases
— leave them blank for now.

Restart `npm run dev` after editing `.env.local`.

## 3. Run the database migration

Open **SQL Editor** in the Supabase dashboard, paste the entire contents of
[`db/migrations/0001_auth_profiles.sql`](db/migrations/0001_auth_profiles.sql),
and click **Run**. This creates:

- `profiles` (one row per user, with `role` and `is_active` for the Phase 4 admin panel)
- `saved_listings` (wishlist table; wired to the UI in Phase 2)
- a trigger that auto-creates a profile from sign-up metadata
- RPCs for username→email sign-in and username-availability checks
- Row Level Security so users can only read/write their own data

## 4. Turn off email confirmation (recommended for development)

So that registering signs the user straight in (matching the spec's
"on success → Home"):

**Authentication → Sign In / Providers → Email** → disable **Confirm email** →
Save.

If you leave confirmation **on**, registration will instead redirect to the
sign-in page with a "check your email" message.

## 5. Try it

```bash
npm run dev
```

- **Register** at `/register` — the button stays greyed until every field is
  valid (username ≥3 chars, valid email, password ≥8 with a letter and a
  number, matching confirmation). On success you land on the home page, logged
  in, and a row appears in **Table Editor → profiles**.
- **Sign in** at `/sign-in` with either your username or email. Wrong
  credentials show *"The entered data is incorrect."*
- **Account** (`/account`) shows your real profile; **Edit Profile** unlocks the
  fields and a change-password section. Changes persist across a refresh.
- **Sign out** via the header icon or the Account button → confirm modal → you
  return to the logged-out home page.
- Visiting `/saved` or `/account` while logged out redirects you to sign-in.

## Creating an admin (optional, for Phase 4)

In **SQL Editor**:

```sql
update public.profiles set role = 'admin' where username = '<your-username>';
```

## Notes

- Auth tokens are refreshed in `middleware.ts`; protected routes (`/saved`,
  `/account`, `/admin`) are gated there.
- A deactivated account (`is_active = false`) is signed out automatically and
  cannot sign back in.
