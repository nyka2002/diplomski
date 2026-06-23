// Scrape & ingest orchestrator (Phase 5).
//
// Usage (load env first):
//   set -a && . ./.env.local && set +a && node scrapers/run.mjs [flags]
//
// Flags:
//   --source=njuskalo|indeks|all   which source(s)            (default: all)
//   --type=sale|rent|all           which category             (default: all)
//   --limit=N                      detail pages per source/type (default: 25)
//   --dry-run                      crawl + normalize, no DB writes
//   --no-images                    skip copying images to Storage
//   --no-embed                     skip OpenAI embeddings
//   --no-translate                 skip Croatian→English translation
//   --force                        re-process every ad (ignore content hash) —
//                                  use to backfill new fields (dates/translations)
//   --reconcile                    mark unseen ads inactive (FULL crawls only)
//   --from-queue                   process queued admin-triggered runs instead
//
// The scraper runs out-of-process (Playwright) with the service-role key. The
// admin "trigger update" button enqueues a `scrape_runs` row; a host running
// `--from-queue` on a schedule (cron / GitHub Action) drains the queue. See
// SCRAPING.md.
import { chromium } from "playwright";
import { requireEnv } from "./lib/env.mjs";
import { SOURCES, SOURCE_KEYS } from "./sources/index.mjs";
import { normalizeListing } from "./lib/normalize.mjs";
import { ingest, reconcileStatus } from "./lib/pipeline.mjs";
import { select, insertReturning, patch } from "./lib/supabase.mjs";

function parseArgs(argv) {
  const a = { source: "all", type: "all", limit: 25, dryRun: false, withImages: true, withEmbeddings: true, withTranslate: true, force: false, reconcile: false, fromQueue: false };
  for (const arg of argv) {
    if (arg === "--dry-run") a.dryRun = true;
    else if (arg === "--no-images") a.withImages = false;
    else if (arg === "--no-embed") a.withEmbeddings = false;
    else if (arg === "--no-translate") a.withTranslate = false;
    else if (arg === "--force") a.force = true;
    else if (arg === "--reconcile") a.reconcile = true;
    else if (arg === "--from-queue") a.fromQueue = true;
    else if (arg.startsWith("--source=")) a.source = arg.split("=")[1];
    else if (arg.startsWith("--type=")) a.type = arg.split("=")[1];
    else if (arg.startsWith("--limit=")) a.limit = Math.max(1, Number(arg.split("=")[1]) || 25);
  }
  return a;
}

const log = (...m) => console.log(...m);

// Crawl + ingest one (source, type) pair. Returns aggregate counts.
async function runSourceType(browser, source, type, opts) {
  const adapter = SOURCES[source];
  const runStart = new Date().toISOString();
  const raw = await adapter.collect(browser, { type, limit: opts.limit, log });
  const listings = raw
    .filter((r) => r.externalId && r.title)
    .map((r) => normalizeListing(r, source));
  log(`  normalized ${listings.length}/${raw.length} (${source}/${type})`);

  // In a dry run, dump what was extracted so selectors can be eyeballed.
  if (opts.dryRun) {
    for (const l of listings) {
      log(
        `\n  ── ${l.id} ──\n` +
          `  title:  ${l.title || "(empty)"}\n` +
          `  price:  ${l.price_display || "(empty)"} → ${l.price_eur} EUR\n` +
          `  county: ${l.county || "(none)"}\n` +
          `  city:   ${l.city || "(empty)"}\n` +
          `  area:   ${l.area_m2} m²   rooms: ${l.rooms}   type: ${l.type}\n` +
          `  posted: ${l.posted_at || "(none — defaults to ingest time)"}\n` +
          `  images: ${l.images.length}\n` +
          `  attrs:  ${Object.entries(l.attributes).filter(([, v]) => v).map(([k]) => k).join(", ") || "(none)"}\n` +
          `  desc:   ${(l.description || "(empty)").slice(0, 120)}${l.description.length > 120 ? "…" : ""}\n` +
          `  url:    ${l.source_url}`,
      );
    }
    log("");
  }

  const res = await ingest(listings, {
    runStart,
    dryRun: opts.dryRun,
    withImages: opts.withImages,
    withEmbeddings: opts.withEmbeddings,
    withTranslate: opts.withTranslate,
    force: opts.force,
  });
  let deactivated = 0;
  if (opts.reconcile && !opts.dryRun) {
    deactivated = await reconcileStatus(source, runStart);
    log(`  reconciled: ${deactivated} unseen ad(s) → inactive`);
  }
  log(`  ${source}/${type}: +${res.inserted} new, ~${res.updated} updated, =${res.unchanged} unchanged`);
  return { ...res, deactivated };
}

async function runJob({ sources, types, opts }) {
  const browser = await chromium.launch({ headless: true });
  const totals = { found: 0, inserted: 0, updated: 0, deactivated: 0 };
  try {
    for (const source of sources) {
      for (const type of types) {
        const r = await runSourceType(browser, source, type, opts);
        totals.found += r.found;
        totals.inserted += r.inserted;
        totals.updated += r.updated;
        totals.deactivated += r.deactivated;
      }
    }
  } finally {
    await browser.close();
  }
  return totals;
}

async function main() {
  requireEnv();
  const opts = parseArgs(process.argv.slice(2));
  const types = opts.type === "all" ? ["sale", "rent"] : [opts.type];

  // ── Queue mode: drain admin-triggered scrape_runs ─────────────────────────
  if (opts.fromQueue) {
    const queued = await select(`scrape_runs?select=*&status=eq.queued&order=queued_at.asc&limit=5`);
    if (!queued.length) {
      log("No queued runs.");
      return;
    }
    for (const job of queued) {
      const sources = job.source === "all" ? SOURCE_KEYS : [job.source];
      log(`\n▶ run ${job.id} (${job.source})`);
      await patch("scrape_runs", `id=eq.${job.id}`, { status: "running", started_at: new Date().toISOString() });
      try {
        const totals = await runJob({ sources, types, opts });
        await patch("scrape_runs", `id=eq.${job.id}`, {
          status: "success",
          finished_at: new Date().toISOString(),
          ...totals,
        });
      } catch (e) {
        await patch("scrape_runs", `id=eq.${job.id}`, {
          status: "error",
          finished_at: new Date().toISOString(),
          error: String(e.message || e).slice(0, 500),
        });
        log(`  ✗ run ${job.id} failed: ${e.message}`);
      }
    }
    return;
  }

  // ── Direct mode: run now, log the run (trigger=cron) ──────────────────────
  const sources = opts.source === "all" ? SOURCE_KEYS : [opts.source];
  if (sources.some((s) => !SOURCES[s])) {
    console.error(`Unknown source. Known: ${SOURCE_KEYS.join(", ")}`);
    process.exit(1);
  }
  log(`Scraping ${sources.join(", ")} | types: ${types.join(", ")} | limit ${opts.limit}${opts.dryRun ? " | DRY RUN" : ""}`);

  let run = null;
  if (!opts.dryRun) {
    run = await insertReturning("scrape_runs", {
      source: sources.length === SOURCE_KEYS.length ? "all" : sources[0],
      trigger: "cron",
      status: "running",
      started_at: new Date().toISOString(),
    }).catch(() => null);
  }

  try {
    const totals = await runJob({ sources, types, opts });
    log(`\nDone: ${totals.found} found, ${totals.inserted} new, ${totals.updated} updated, ${totals.deactivated} deactivated.`);
    if (run) await patch("scrape_runs", `id=eq.${run.id}`, { status: "success", finished_at: new Date().toISOString(), ...totals });
  } catch (e) {
    if (run) await patch("scrape_runs", `id=eq.${run.id}`, { status: "error", finished_at: new Date().toISOString(), error: String(e.message || e).slice(0, 500) });
    console.error(e);
    process.exit(1);
  }
}

main();
