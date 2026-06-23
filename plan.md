# Development Plan — Intelligent Real Estate Ad Management Web App

English, phased development roadmap. This builds on the existing frontend in this folder.

---

## Context

The folder `Real Estate Ad Management App` currently contains a **pure client-side Vite + React SPA**: a single `src/app/App.tsx` (~1250 lines), ~40 shadcn/ui components, a pastel blue/purple/pink theme with light/dark modes, full EN/HR i18n, and **12 hardcoded mock listings**. Authentication is faked (`setIsLoggedIn(true)` with no validation), and the AI panel is a `setTimeout` stub that returns a random count.

The thesis document specifies a **full-stack intelligent system**: centralized collection of apartment ads (buy/rent) scraped from public sources, stored in a structured DB, browsable with advanced sorting/filtering, a user account system with a saved-listings wishlist, an **AI conversational agent** that converts natural-language requests into filter parameters (honoring must-have / nice-to-have / forbidden criteria), and an **admin panel** for managing users and listings plus triggering re-scrapes.

**Goal:** Turn the existing visually-complete frontend into a fully functional product matching the document. Per decisions taken:

- **Migrate the existing UI into Next.js** (App Router) — one unified full-stack codebase in the same folder.
- **Follow the document's stack, with pragmatic swaps allowed** (noted inline).
- **Seed data first, build scrapers later** — the app becomes functional early, real ingestion comes after.
- **Full scope, phased.**

The frontend's *visual* layer is considered done and is reused as-is; the work is backend, data wiring, and the *functional* behaviors that are currently missing (real auth + validation, real AI, admin, sorting by area/date, persistence).

---

## Target Architecture

| Layer | Choice | Notes / pragmatic swaps |
|---|---|---|
| Framework | **Next.js 15 (App Router, TypeScript)** | Frontend + backend (Route Handlers + Server Actions) in one app. |
| UI | Existing **React 18 + shadcn/ui + Tailwind v4** | Ported unchanged; theme tokens reused from `theme.css`. |
| DB + Auth | **Supabase** (Postgres + Auth + `pgvector`) | Auth via `@supabase/ssr`; RLS for per-user data + admin role. |
| AI | **OpenAI GPT-4o mini** (chat/extraction) + **text-embedding-3-small** (embeddings) | Abstracted behind a provider interface so the model is swappable. |
| Semantic search | **pgvector** in Supabase | Listing + query embeddings; cosine similarity for relevance ranking. |
| Media | **Supabase Storage** | Scraped/manual listing images are copied into our bucket and served via Next.js image optimization (resilient to source removal/hotlink blocking). |
| Scraping | **Playwright** | One source first (Njuškalo), then Indeks Oglasa + others. |
| Scheduling | **Supabase Cron / Vercel Cron** | *Swap:* avoids a standalone worker early. |
| Cache/queue | **Redis — optional, deferred** | *Swap:* start with Next.js caching + DB; add Redis (Upstash) only if scraping volume needs a queue. Noted in Phase 5. |
| i18n | Keep current `translations` object, or adopt **next-intl** | Decide in Phase 0; either way EN default + HR toggle preserved. |
| Hosting | **Vercel** (app) + **Supabase** (DB) | Env/secrets via Vercel + `.env.local`. |

### Proposed folder structure (after migration, inside the same folder)
```
app/                      # Next.js App Router
  (marketing)/page.tsx        # Home
  buy/page.tsx                # Buy (browse sale)
  rent/page.tsx               # Rent (browse rent)
  saved/page.tsx              # Saved listings (auth)
  listings/[id]/page.tsx      # Listing detail
  account/page.tsx            # Account (auth)
  (auth)/sign-in/page.tsx
  (auth)/register/page.tsx
  admin/...                   # Admin dashboard (role-gated)
  api/ai/route.ts             # AI agent endpoint
  api/listings/route.ts       # Listings query/sort/filter
  api/scrape/route.ts         # Manual scrape trigger (admin)
components/                 # Ported UI + shadcn/ui (from src/app/components)
lib/
  supabase/                   # browser + server clients, middleware
  ai/                         # provider interface, prompt, criteria extraction
  i18n/                       # translations (ported from App.tsx)
  validation/                 # form + criteria schemas (zod)
  listings/                   # query builders, sorting, shared filter state, mapping
scrapers/                   # Playwright source adapters + normalizer
db/                         # SQL migrations, RLS policies, seed script
```

---

## Canonical Listing data model

Every listing must contain at least (per document): **title, price, location, area (m²), rooms, description, images, posted date, type (sale/rent), source URL**. Schema (Supabase/Postgres):

- `profiles` — id (FK auth.users), first_name, last_name, username (unique, ≥3), email (unique), phone (nullable), role (`user`|`admin`), is_active.
- `listings` — id, type (`sale`|`rent`), title, title_hr, price_eur (numeric, for sorting), price_display, location/city, area_m2 (numeric), rooms (numeric), description, description_hr, posted_at, source (`njuskalo`|`indeks`|`manual`|…), source_url, status (`active`|`inactive`|`removed`), embedding `vector(1536)`, attributes (JSONB: balcony, parking, furnished, floor, energy_class, pets, …), created_at, updated_at.
- `listing_images` — id, listing_id, storage_path (Supabase Storage), url (public/signed), position. Images downloaded into a Storage bucket at ingest; source URL kept for re-fetch.
- `saved_listings` — user_id, listing_id, saved_at (ordering), PK(user_id, listing_id).
- `ai_sessions` — id, user_id (nullable), created_at; `ai_messages` — session_id, role, content, extracted_criteria (JSONB), query_embedding `vector(1536)`.
- `sellers` — embedded on listing or own table: name, phone, email, agency (nullable → empty panel when absent).

RLS: profiles/saved_listings scoped to owner; listings readable by all, writable by admin; admin checks via `role` claim.

---

## Phases

### Phase 0 — Next.js migration & scaffolding
**Goal:** Same UI and behavior as today, running on Next.js with mock data, decomposed into routes/components.
- Initialize Next.js (App Router, TS, Tailwind v4) in the folder; preserve `theme.css` tokens, `fonts.css`, light/dark via `class` strategy.
- Port shadcn/ui components (`src/app/components/ui/*`) — they're framework-agnostic, move as-is.
- Decompose `App.tsx` into route segments + components: Header/nav, HomePage, BrowsePage, SavedPage, ListingDetailPage, SignIn/Register/Account, sign-out modal. Mark interactive pieces `"use client"`.
- Extract the `translations` object and `Lang`/theme handling into `lib/i18n` and a context/provider; keep EN default + HR toggle.
- Keep mock `listings` temporarily as a local module so the app runs end-to-end.
- **Preserve the existing functional fixes** already in `App.tsx`: open-listing scroll-to-top, "Back to listings / Back to Saved Listings" origin-aware navigation, and numeric price-sort parsing.
- Set up ESLint/Prettier, `.env.local` template, base CI lint/build.

**Deliverable:** Pixel-equivalent app on Next.js, mock data, all current behavior intact.
**Verify:** `npm run dev`; click through every page in EN + HR, light + dark; `npm run build` passes.

### Phase 1 — Supabase foundation, auth & profiles
**Goal:** Real persistence + real authentication with full validation.
- Create Supabase project; enable `pgvector`. Write SQL migrations for the schema above + RLS policies + admin role.
- Wire `@supabase/ssr` clients (browser/server) + Next middleware for session refresh and route protection (`saved`, `account`, `admin`).
- **Registration** with validation (zod): first/last name, username unique ≥3 chars, valid email (unique), optional phone, password ≥8 with ≥1 letter & ≥1 number, confirm match. **Submit button disabled/greyed until valid**, then enabled/colored. On success → redirect Home.
- **Sign-in** (username or email + password): button disabled until filled; on bad credentials show "The entered data is incorrect" and re-prompt; on success → Home.
- **Account page:** locked form showing real profile; "Edit Profile" unlocks fields + password-change section (current + new + confirm new); save persists and returns to locked view.
- **Sign-out:** confirm modal ("Are you sure you want to sign out?" / Yes-No); Yes → real sign out + logged-out Home.
- Header nav reflects real auth state (Saved/Account only when logged in; Sign In/Create Account vs Sign Out).

**Deliverable:** Working accounts persisted in Supabase.
**Verify:** Register (with invalid inputs blocked), sign in/out, edit profile, change password — all persisting across reload; RLS prevents cross-user access.

### Phase 2 — Listings on real data (seed) + browse/detail/saved
**Goal:** Full browsing, sorting, detail, and saving against the database.
- Seed script: load the existing 12 listings (+ more for variety) into `listings`/`listing_images` with all required fields incl. `posted_at`, `area_m2`, `rooms`.
- **Home:** server-fetch listings, **sorted newest-first by `posted_at`** (newest added shown first).
- **Buy/Rent:** server-side query + sorting options (wire existing UI, add the missing ones):
  1. Price ↓ 2. Price ↑ 3. Area ↓ 4. Area ↑ 5. Date: newest 6. Date: oldest. *Suggested extras:* "Price per m²" and a "Relevance" option (used by the AI phase). Default = relevance/newest.
- **Manual filter panel** (advanced filtering system per the document's overview). *As built:* a **City** dropdown plus — when the chosen city has neighborhoods — a **multi-select Neighborhood** dropdown (checkboxes, OR'd together); **price range**, **area range**, and **rooms range** as identical min/max number inputs (so "exactly 2 rooms" or "2–3 rooms" are both expressible); and amenity toggles (balcony, parking, furnished, pets). Filters apply server-side and combine with sorting. The applied filters live in **one shared filter state** (`lib/listings`) that the AI agent (Phase 3) writes to — so manual and AI filtering are the same mechanism, shown as removable chips (one per selected neighborhood; separate Min/Max chips for each range). User can clear all or individual filters manually.
- **Pagination / infinite scroll** on Buy/Rent and Home, since real (scraped) data will be large — introduce here rather than deferring. (Implemented as "Load more"; appears once results exceed a page.)
- **Browse UX persistence:** filters, sort, and **scroll position** are preserved when opening a listing and returning — held in memory in the app context, keyed per Buy/Rent — so "back to listings" restores the exact filtered view *and* the scroll position. The listing detail always opens **scrolled to the top**, and its "back to listings" control is **sticky** (stays visible no matter how far the page is scrolled).
- **Listing detail (`/listings/[id]`):** render from DB — big bold title + heart (toggles saved), price, swipeable image gallery, description, **specs table at ~2/3 width**, seller panel ("Landlord / Seller Information"; empty space if no data), **original-ad link at the very bottom**. Explicitly surface all document-required fields: location, area, rooms, **posted date**, **type (sale/rent)**, and source link.
- **Saved listings:** persist toggles to `saved_listings`; heart filled-pink when saved, pink-outline when not (already correct in UI). Saved page ordered by `saved_at` desc; split into "Properties for Sale" / "Properties for Rent" **only when both exist**, single section otherwise; empty state with Buy/Rent buttons (already present).

**Deliverable:** End-to-end browsing/sorting/saving on persisted data.
**Verify:** Each sort order correct; manual filters narrow results and combine with sorting — including **city + multi-neighborhood** location and **rooms range** (exact e.g. 2, and span e.g. 2–3); filter chips clear individually and all-at-once; filters + scroll position survive opening a listing and clicking back; save/unsave persists per user; saved sections render conditionally; detail page shows all required fields; deep-link to `/listings/[id]` works.

*Pragmatic data note:* listing images are stored as a `text[]` column for now; the separate `listing_images` table + Supabase Storage copy is deferred to Phase 5 (scraping ingest).

### Phase 3 — AI conversational filtering agent
**Goal:** Natural-language search that produces correct, strictly-honored filters with conversation memory.
- `lib/ai` provider interface wrapping **OpenAI GPT-4o mini**; structured extraction (function-calling / JSON schema) turning a query into a **criteria object**: `mustHave[]`, `niceToHave[]`, `forbidden[]`, plus scalar filters (rooms range, price range, area, city, balcony, private parking, furnished, pets, …). Example: *"one-bed or studio with private parking and balcony in Zagreb"* → rooms 0–1, parking=private, balcony=true, city=Zagreb.
- **Filtering semantics (critical):**
  - **must-have** and **forbidden** are *hard* filters — never show a listing violating them.
  - **nice-to-have** are *soft* — matching listings rank first; non-matching still shown afterward, each **flagged** as not meeting the specific preference (e.g. "no balcony").
- **Embeddings + pgvector** for relevance ranking within the hard-filtered set (store `query_embedding`; precompute listing embeddings in Phase 2/5).
- **Conversation context** held per `ai_session`: follow-up messages refine/add/remove criteria; agent replies with a confirmation summary and stays ready for more.
- **Filter management:** the AI writes into the **same shared filter state** as the Phase 2 manual panel; applied filters show as removable chips; user can clear all or specific filters **via chat or manually**, and the two stay in sync in both directions.
- **Cost & abuse guardrails:** rate-limit the AI endpoint per user/session, cap message/context length, and cache identical queries — keeps GPT-4o mini spend bounded.
- `api/ai/route.ts` orchestrates: extract → merge with session state → build query → return listings + applied-criteria summary + assistant message.

**Deliverable:** AI panel drives real, rule-correct filtering with memory.
**Verify:** Scripted scenarios — must-have never violated; forbidden excluded; nice-to-have ordering + flags correct; multi-turn refinement; clear-all and clear-one (chat + manual). Unit tests on the extraction layer.

**Implementation notes (as built):**
- **One shared engine.** The criteria map onto the same `ListingFilters` the manual panel uses: scalar filters + **must-have** (amenity = true) are normal filters; **forbidden** (amenity must be absent), **nice-to-have** (soft), and **relevance** (free text) are an AI overlay on that same state. Both manual and AI changes flow through one search path (`lib/listings/query.ts` → `/api/listings`), giving genuine two-way sync. AI criteria render as removable chips ("No: X", "Preferred: X", and the relevance phrase), clearable by chat or click.
- **Extraction** uses GPT-4o mini with **strict JSON-schema** structured output; a `reply` field returns a one-line confirmation in the active language (EN/HR).
- **Memory:** the full conversation is sent each turn and the model returns the *complete* current criteria (so add / change / remove all work). Turns are also persisted to `ai_sessions` / `ai_messages` for signed-in users (best-effort, owner-scoped RLS).
- **Relevance ranking** uses a pgvector `match_listings` RPC over the hard-filtered candidate set, and **gracefully no-ops** until listing embeddings are backfilled via `scripts/embed-listings.mjs` (needs the service-role key). Hard/soft filtering + flags work with or without embeddings.
- **Guardrails:** per-IP rate limit, message count/length caps, and an identical-query cache bound OpenAI spend. The endpoint reports `configured:false` (and the panel shows a friendly notice) when `OPENAI_API_KEY` is unset.
- **Setup:** run `db/migrations/0003_ai.sql`, set `OPENAI_API_KEY`; optionally set `SUPABASE_SERVICE_ROLE_KEY` and run the embed script for semantic ranking.

### Phase 4 — Admin panel
**Goal:** Admin management of users and listings.
- Role-gated `admin` routes (middleware + RLS). Admin can: **view users**, **deactivate accounts** (`is_active=false` blocks login), **manually add/edit/delete listings** (form mapping to canonical schema, regenerates embedding on save), and **trigger re-scrape/update** (button → `api/scrape`).
- Reuse shadcn `table`, `dialog`, `form` components for the dashboard.

**Deliverable:** Functional admin dashboard.
**Verify:** Non-admins blocked; deactivated user cannot log in; manual CRUD reflected in browse; scrape trigger enqueues a run.

**Implementation notes (done):**
- **Access control (defence in depth):** middleware already requires a session for `/admin`; `app/admin/page.tsx` additionally calls `requireAdmin()` (`lib/admin/data.ts`) and `redirect("/")` for non-admins; every admin server action re-checks `role === 'admin'`; and RLS is the final guard. `0004_admin.sql` adds a `profiles_admin_update` policy (admins may update any profile row) plus a `grant_admin(email)` helper to seed the first admin. Listings already had `listings_admin_write` (full CRUD) from `0002`, so manual listing changes need no new policy.
- **Users tab:** lists all profiles (admin SELECT via RLS) with role + active badges; **activate/deactivate** toggles `is_active` (deactivated users are signed out on sight by `getCurrentProfile` and blocked at sign-in), and **make/revoke admin** toggles `role`. An admin **cannot modify their own account** from the panel (`cannotModifySelf`) to avoid self-lockout.
- **Listings tab:** table of every listing (all statuses) with **add / edit / delete**. `components/admin/ListingForm.tsx` maps the canonical schema (type, status, EN/HR title + description, numeric + display price, location, area, rooms, image URL list, amenity flags, seller block, source URL), validated by `lib/validation/listing.ts` (shared client + server). On save, `saveListingAction` **regenerates the embedding** from the listing text (same composition as the backfill script) when OpenAI is configured, and inserts (`manual-<uuid>`, `source='manual'`) or updates; `revalidatePath` refreshes browse/home immediately.
- **Trigger update button** → `POST /api/scrape` (admin-gated). The route is wired and access-controlled now but returns `{status:"notImplemented"}`; the real ingestion pipeline is Phase 5. The UI shows a "scraping arrives in a later phase" notice.
- Header shows an **admin** nav link only when `profile.role === 'admin'`. All admin UI text follows the lowercase rule and is fully EN/HR.

### Phase 5 — Scraping & ingestion pipeline (Playwright)
**Goal:** Real data from public sources, kept fresh.
- `scrapers/` adapter pattern: start with **Njuškalo**, normalize raw → canonical schema, **download images into Supabase Storage**, generate embeddings, **dedupe** (by source_url/hash), upsert.
- Add **Indeks Oglasa** + additional public sources behind the same interface.
- **Periodic updates:** scheduled job (Supabase/Vercel Cron) to fetch new ads, refresh existing, and mark **inactive/removed** ads (`status`). Manual admin trigger from Phase 4.
- *Swap note:* introduce **Redis/Upstash queue** here only if scrape volume/concurrency requires it; otherwise a serial cron job suffices initially.
- Compliance: respect robots/ToS, rate-limit, identify politely; document sources in thesis.

**Deliverable:** Live, self-refreshing dataset.
**Verify:** Scrape run populates normalized listings with images + embeddings; re-run dedupes; removed source ads flipped to inactive and hidden from browse.

**Implementation notes (done):**
- **Out-of-process worker.** Playwright can't run in a serverless request, so scraping is a Node CLI (`scrapers/run.mjs`, ESM, no extra deps beyond the already-present `playwright`). The admin "trigger data update" button **enqueues** a `scrape_runs` row (`POST /api/scrape`, admin-gated by `requireAdmin()` + RLS); a host running `npm run scrape:queue` on a schedule drains the queue. `npm run scrape [-- flags]` also runs a crawl directly. Full operator guide in `SCRAPING.md`.
- **Adapter pattern.** Each source is `{ key, baseUrl, collect(browser, {type, limit, log}) → raw[] }`, registered in `scrapers/sources/index.mjs`. **Njuškalo** and **Indeks Oglasi** ship; adding a source is one adapter file. Selectors are best-effort and the documented maintenance point (sites change markup / use anti-bot), with defensive multi-selector extraction so a markup change degrades a field rather than crashing.
- **Normalize → canonical.** `scrapers/lib/normalize.mjs` is pure (unit-tested, `npm run test:scrapers`, 11 cases): Croatian price/area/rooms parsing, sale/rent detection, amenity keyword detection, the stable `${source}-${externalId}` id, and a `content_hash`. The embedding text mirrors `lib/admin/actions.ts` / `scripts/embed-listings.mjs` so scraped, manual, and seeded listings rank consistently.
- **Ingest pipeline** (`scrapers/lib/pipeline.mjs`): **dedupe** by `content_hash` (unchanged ads only bump `last_seen_at`, and revive from `inactive` if they reappear — no needless re-copy/re-embed); **upsert**; **images** downloaded into the public `listing-images` Storage bucket (provenance rows in `listing_images`; the browse UI keeps reading the denormalized `listings.images` text[], now holding our Storage URLs); best-effort **embeddings** at ingest; and **status reconciliation** (`--reconcile`, full crawls only) flipping unseen ads to `inactive` so they drop out of browse.
- **Schema** (`db/migrations/0005_scraping.sql`): adds `external_id` / `content_hash` / `last_seen_at` (+ unique `(source, external_id)`), the `listing_images` table (RLS: readable with its listing, service-role writes only), the `scrape_runs` log (RLS: admin select + admin enqueue; the worker updates via service role), and the public `listing-images` bucket + read policy.
- **Politeness/compliance** (`scrapers/lib/polite.mjs`): descriptive User-Agent, ~2.5–4 s jittered throttle between detail pages, and a `robots.txt` gate that skips disallowed paths. Images are copied (not hotlinked) so listings survive source removal.
- **Bilingual content + posting dates.** Scraped Croatian text is translated to English at ingest (`scrapers/lib/translate.mjs`, gpt-4o-mini, best-effort): English in `title`/`description`/spec `label`+`value`, Croatian original in the `*_hr` fields; proper nouns (place/person/agency names) are preserved, and the English text is what gets embedded (aligns with mostly-English search). Real posting dates are parsed from Njuškalo's "Oglas objavljen" field into `posted_at` (so "newest" reflects the ad's date, not ingest time). A `--force` flag re-processes existing rows to backfill these.
- **Two sources shipped.** **Njuškalo** and **index.hr oglasi** (`index`) are both calibrated against their live DOM. (The earlier `indeks` stub pointed at the wrong domain — indeks.hr is a news site — and was removed.) Index is a JS-rendered SPA with hashed CSS classes, so its adapter anchors on stable signals (og: meta, the image-CDN URL pattern, attribute label text, the "Objavljen" date); it exposes only a neighborhood-level location (no county), and its sale price is taken as the larger property-scale figure when an original+discounted pair is shown. Adding further sources is one adapter file each.
- *Redis/Upstash queue* stays deferred — the serial worker + `scrape_runs` queue suffices at this volume (swap note above).

### Phase 6 — Hardening, i18n completeness, tests, deployment
**Goal:** Production-quality, fully bilingual, tested, deployed.
- Complete EN/HR translations for all new surfaces (auth errors, admin, AI replies, validation messages); verify nothing is hardcoded in one language.
- Responsive + light/dark QA on every new page; accessibility pass (labels, focus, contrast).
- Tests: unit (validation, AI criteria extraction, sort/query builders), integration (auth + RLS), **Playwright e2e** for core flows (register → save → AI search → admin).
- Performance: Next caching, image optimization, pagination/infinite scroll on browse; add Redis caching if needed.
- Deploy to Vercel + Supabase; configure secrets, cron, and backups.

**Deliverable:** Deployed, tested, fully functional app matching the document.
**Verify:** Full e2e suite green; manual smoke of every requirement in EN + HR, light + dark, as user + admin.

**Implementation notes (done):**
- **Tests.** Three layers: **unit** (`npm run test:unit`, vitest — 20 cases over `lib/validation`, the `lib/listings/params` query↔URL builder, and `criteriaToFilters`), **scraper unit** (`npm run test:scrapers`, 13 cases over the normalize/parse/hash helpers), and **e2e** (`npm run test:e2e`, Playwright smoke — 35 checks, rule-based against live data). All green.
- **Performance.** AI/relevance ranking no longer caps at 50 candidates — `RANK_CANDIDATES` is raised to PostgREST's 1000-row max so ranked mode considers the whole hard-filtered set at this scale (beyond a few thousand rows, push the similarity ordering into the pgvector RPC). `next.config` `remotePatterns` now allows the Supabase Storage host (alongside Unsplash) for `next/image`. Pagination/"Load more" and per-route caching were already in place from Phase 2.
- **i18n.** Everything user-facing flows through the `deepLower`'d `translations` table (EN/HR) or explicit bilingual chrome; AI replies in the active language. New a11y labels (theme/language/menu toggles, gallery controls) are bilingual.
- **Accessibility.** Icon-only controls got `aria-label`s (header theme/language/menu, gallery prev/next + dots with `aria-current`); the mobile menu button exposes `aria-expanded`; images carry `alt` text; form inputs are labelled.
- **Deployment (prepared).** `DEPLOYMENT.md` documents the Vercel (app) + Supabase (DB/Auth/Storage/pgvector) setup, env-var scoping (only `NEXT_PUBLIC_*` reach the client; service-role/OpenAI keys stay server-side), migration order, admin promotion, and post-deploy checks. Scheduled scraping runs **off-Vercel** (Playwright needs a browser) via `.github/workflows/scrape.yml` (drains the admin queue nightly + full refresh/reconcile) or any cron host. The actual cloud deploy is a guided manual step (needs the owner's accounts/secrets).
- **Known deferrals:** migrating `<img>` → `next/image` in cards/detail (config is ready; deferred to avoid layout-regression risk), and a server-driven `<html lang>` (language is a client toggle today).

---

## Cross-cutting concerns
- **i18n:** every new string added to the translation layer in both EN/HR; AI agent responds in the active language.
- **Lowercase UI rule:** all interface text — titles, nav, buttons, labels, headings, placeholders, badges, the page `<title>` — renders in **all lowercase**, with all-caps acronyms preserved (e.g. "AI", "SETUP_SUPABASE"). Examples: home, buy, "AI property search", "for rent". This is enforced centrally: the `translations` table is passed through a `deepLower()` transform at load, so every existing and future string is covered automatically. **Listing-derived data is exempt** — titles, descriptions, specs, locations, prices, and seller info keep their original casing (they never pass through the transform). The handful of hardcoded chrome strings (logo, "for sale"/"for rent" badges, hero CTA labels) are written lowercase directly.
- **AI search panel placement:** on desktop (≥ `lg`) the panel sits in the browse row to the right of the grid, sized to **exactly two listing rows** (top aligned with row 1, bottom with row 2; the card height is measured at runtime). On mobile (< `lg`) it is hidden and instead revealed by an **"AI search"** button beside "filters"; tapping it opens the same chat as an inline panel **one listing tall**. Both share one conversation/criteria state.
- **Theming:** reuse `theme.css` tokens; all new components use the existing pastel palette + dark variants.
- **Validation:** centralize zod schemas in `lib/validation` shared by client (button-enable) and server (trust boundary).
- **Security:** RLS everywhere; admin role server-checked; never expose service keys to client; sanitize scraped content.
- **AI provider abstraction:** keep model behind `lib/ai` so GPT-4o mini can be swapped without touching routes.
- **Thesis documentation:** since this is a diplomski, keep a running record of system architecture, data-collection/organization, the update mechanism, and an evaluation of AI filtering accuracy — the document explicitly expects these described in the written work.

## Key existing files to migrate/reuse
- `src/app/App.tsx` — source of all pages, the `translations` object, `Listing` type, sort logic (`priceValue`), saved/auth/theme state → decompose per Phase 0.
- `src/app/components/ui/*` — port unchanged.
- `src/styles/theme.css`, `fonts.css` — reuse tokens.
- `package.json`, `vite.config.ts` — replaced by Next.js config; copy relevant deps.

## Assumptions
- App is rebuilt in-place inside `Real Estate Ad Management App` (Next.js replaces Vite); the current code is preserved in git history before migration.
- OpenAI is the AI provider per the document (pluggable if changed later).
- Embedding dimension 1536 (text-embedding-3-small); adjust if model changes.

## Overall verification
After all phases: a logged-in user can browse buy/rent on real data, sort by price/area/date, run a multi-turn AI search that strictly honors must/forbidden and soft-ranks nice-to-have, save listings to a wishlist split by type, manage their profile; an admin can manage users/listings and trigger scrapes; a scheduler keeps data fresh; everything works bilingually in light/dark and is deployed.
