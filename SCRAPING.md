# Scraping & ingestion (Phase 5)

Listings are scraped from public Croatian classifieds with **Playwright**, then
normalized, de-duplicated, image-copied to Supabase Storage, embedded, and
upserted. The scraper runs **outside Next.js** (a Node CLI with the service-role
key). The admin "trigger data update" button only **enqueues** a run; a scheduled
worker does the crawling.

## Setup (once)

1. Run `db/migrations/0005_scraping.sql` in the Supabase SQL editor.
2. Install the browser: `npx playwright install chromium`
3. In `.env.local`, set `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings →
   API → `service_role`). `OPENAI_API_KEY` is optional (enables embeddings).

## Running

Load `.env.local` into the shell **first**, every time:

```bash
set -a && . ./.env.local && set +a

npm run scrape -- --source=njuskalo --type=sale --limit=1 --dry-run  # validate, no writes
npm run scrape                                                       # real ingest, all sources
npm run scrape:queue                                                 # drain admin-triggered runs
```

Flags: `--source=njuskalo|index|all` · `--type=sale|rent|all` · `--limit=N` ·
`--dry-run` · `--no-images` · `--no-embed` · `--no-translate` · `--from-queue` ·
`--force` (re-process every ad, ignoring the content hash — use to backfill new
fields like translations/posted dates) ·
`--reconcile` (mark vanished ads inactive — **full crawls only**, off by default).

**Listings are stored bilingually.** Scraped Croatian text is translated to
English at ingest (OpenAI, best-effort): the English goes in `title` /
`description` / spec `label`+`value`, the Croatian original in `title_hr` /
`description_hr` / `labelHr`+`valueHr`. Proper nouns (place, person, agency
names) are kept as-is. Posting dates come from the ad's "Oglas objavljen" field.
To backfill the fields onto already-stored listings, re-run with `--force`:

```bash
npm run scrape -- --force        # re-translate + refresh dates on all listings
```

## Scheduling

The admin button writes a `queued` row; run the worker on a schedule wherever a
browser can run (VM, GitHub Action, cron):

```cron
0  3 * * *  cd /path/to/app && set -a && . ./.env.local && set +a && npm run scrape:queue
30 3 * * *  cd /path/to/app && set -a && . ./.env.local && set +a && npm run scrape -- --reconcile
```

## Notes

- **Adding a source:** write an adapter in `scrapers/sources/` (same shape as
  `njuskalo.mjs`: `{ key, baseUrl, collect(browser, opts) → raw[] }`) and register
  it in `index.mjs`. `normalizeListing()`, translation, dedupe, images, and
  embeddings are shared — an adapter only extracts raw fields. Selectors live in
  each adapter and are the maintenance point (sites change markup / use anti-bot),
  so re-validate with `--dry-run --limit=1`.
- **Sources shipped:** `njuskalo` and `index` (index.hr oglasi). Index is a
  JS-rendered SPA with hashed CSS classes, so its adapter anchors on stable
  signals (og: meta, the image-CDN URL pattern, attribute label text, the
  "Objavljen" date). **Index caveat:** the site exposes no county and no clean
  city — only a neighborhood ("…za naselje X"), so index listings carry a
  neighborhood-level location (or none); the place is still in the (searchable,
  embedded) title. For sale, the listed price can include an original+discounted
  pair; the adapter takes the larger property-scale figure.
- **Dedupe:** id is `${source}-${externalId}`; a `content_hash` lets re-crawls skip
  unchanged ads.
- **Compliance:** descriptive User-Agent, throttled, respects `robots.txt`, copies
  images instead of hotlinking. Keep volume modest and respect each source's ToS.
- **Tests:** `npm run test:scrapers` covers the parsing/normalization logic.
