# Deployment (Phase 6)

The app deploys to **Vercel** (Next.js) + **Supabase** (Postgres/Auth/Storage/pgvector).
The Playwright scraper runs **off-Vercel** (it needs a real browser) on a schedule —
GitHub Actions is wired below; any cron host works too.

## 1. Supabase

1. Create a project (Postgres + Auth included; `pgvector` is enabled by `0001`).
2. In the SQL editor, run the migrations **in order**:
   `db/migrations/0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008`.
   (`0007` = global daily LLM budget, `0008` = per-IP API rate limiter.)
   Optionally load demo data with `db/seed/0001_listings.sql`.
3. Create a **Storage bucket** `listing-images` — `0005` does this; confirm it's public.
4. Promote your account to admin after registering: `select public.grant_admin('you@email');`
5. **Auth → URL Configuration:** set the Site URL to your Vercel domain (and add
   `http://localhost:3000` for local dev) so email/redirect links resolve.

## 2. Vercel

1. Import the Git repo (Vercel auto-detects Next.js — no `vercel.json` needed).
2. Set **Environment Variables** (Production + Preview):

   | var | scope | notes |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase → Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | anon/public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | **secret** | server only — never exposed to the client |
   | `OPENAI_API_KEY` | **secret** | AI search + ingest translation/embeddings |
   | `LLM_DAILY_CAP` | optional | global OpenAI calls/day before AI degrades (default 500) |

   Also set a **monthly usage limit in the OpenAI dashboard** (Settings → Limits) —
   it's the only guaranteed spend ceiling; the in-app caps are best-effort on top.

3. Deploy. `npm run build` is the build command (ESLint is not gated on builds;
   run `npm run lint` / `npm run test:unit` in CI instead).

> Security: only the two `NEXT_PUBLIC_*` vars reach the browser. The service-role
> and OpenAI keys are used solely in Server Components / Route Handlers / scripts.
> RLS is the backstop on every table.

## 3. Scheduled scraping (off-Vercel)

Vercel's serverless runtime can't run Playwright, so ingestion runs as a scheduled
job. `.github/workflows/scrape.yml` is provided: it drains admin-triggered runs and
does a nightly full refresh + reconcile.

Add these **GitHub repo secrets** (Settings → Secrets and variables → Actions):
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`.

No GitHub? Run the same commands from any cron host (see `SCRAPING.md`):

```cron
0 3 * * *  cd /app && set -a && . ./.env.local && set +a && npm run scrape -- --reconcile
```

## 4. Post-deploy checks

- Register → sign in → save a listing → AI search → sign out.
- As admin: open `/admin`, edit a listing, trigger a data update (enqueues a run).
- Backfills (one-off, if needed): `npm run translate`, `node scripts/embed-listings.mjs`.
- Smoke against the deployed URL: `BASE_URL=https://your-app.vercel.app npm run test:e2e`.

## 5. Backups

Supabase takes automatic daily backups (Pro+; Free tier has limited retention) —
verify the retention/PITR setting fits the project. Storage objects (listing
images) can be re-fetched from source via `npm run scrape -- --force` if lost.
