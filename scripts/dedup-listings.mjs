// Cross-source near-duplicate marking (Phase 4). Reads active listings, finds
// groups that describe the same apartment across different sources, keeps one
// canonical row and marks the rest via listings.duplicate_of (migration 0013).
// Non-destructive and re-runnable: it first clears all duplicate_of, then re-marks.
//
// Usage (load env first):
//   set -a && . ./.env.local && set +a && node scripts/dedup-listings.mjs [--dry-run] [--reset]
//     --dry-run   detect + print groups, write nothing
//     --reset     only clear all duplicate_of (undo), write nothing else
//
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service role to
// bypass RLS on write). Uses the REST API — no deps.
import { parseEmbedding, findDuplicateGroups, pickCanonical, DEDUP_DEFAULTS } from "../scrapers/lib/dedup.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes("--dry-run");
const resetOnly = process.argv.includes("--reset");

if (!url || !serviceKey) {
  console.error("Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const sb = (path, init = {}) =>
  fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

async function clearAll() {
  const res = await sb(`listings?duplicate_of=not.is.null`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ duplicate_of: null }),
  });
  if (!res.ok) throw new Error(`reset PATCH ${res.status}: ${await res.text()}`);
}

if (resetOnly) {
  await clearAll();
  console.log("Cleared all duplicate_of markers.");
  process.exit(0);
}

// ── Load active listings ──────────────────────────────────────────────────────
const cols = "id,source,type,rooms,area_m2,price_eur,county,city,title,description,images,posted_at,embedding";
const all = [];
for (let from = 0; ; from += 1000) {
  const res = await sb(`listings?select=${cols}&status=eq.active&order=id&limit=1000&offset=${from}`);
  if (!res.ok) {
    console.error("read error:", res.status, await res.text());
    process.exit(1);
  }
  const batch = await res.json();
  all.push(...batch);
  if (batch.length < 1000) break;
}
for (const l of all) l.embedding = parseEmbedding(l.embedding);
console.log(`Loaded ${all.length} active listing(s).`);

// ── Detect cross-source near-duplicate groups ───────────────────────────────────
const { groups, comparisons } = findDuplicateGroups(all);

console.log(
  `Compared ${comparisons} cross-source pair(s) (blocked by type+rooms); ` +
    `thresholds area±${DEDUP_DEFAULTS.areaTol}m², price≥${DEDUP_DEFAULTS.priceRatio}, cos≥${DEDUP_DEFAULTS.embThreshold}.`,
);
console.log(`Found ${groups.length} duplicate group(s), ${groups.reduce((n, g) => n + g.length - 1, 0)} listing(s) to hide.\n`);

// ── Report + (optionally) write ─────────────────────────────────────────────────
const marks = []; // { id, canonical }
for (const g of groups) {
  const canonical = pickCanonical(g);
  const dupes = g.filter((l) => l.id !== canonical.id);
  const srcs = [...new Set(g.map((l) => l.source))].join(", ");
  console.log(`● group [${srcs}] — ${g[0].type} ${g[0].rooms}-room ~${canonical.area_m2}m² €${canonical.price_eur}`);
  console.log(`   canonical: ${canonical.id} (${canonical.source}, ${canonical.images?.length ?? 0} imgs)`);
  for (const d of dupes) {
    console.log(`   duplicate: ${d.id} (${d.source}) → ${canonical.id}`);
    marks.push({ id: d.id, canonical: canonical.id });
  }
}

if (dryRun) {
  console.log(`\n[dry-run] would mark ${marks.length} listing(s); no writes.`);
  process.exit(0);
}

console.log(`\nClearing previous markers…`);
await clearAll();
let done = 0;
for (const m of marks) {
  const res = await sb(`listings?id=eq.${encodeURIComponent(m.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ duplicate_of: m.canonical }),
  });
  if (res.ok) done++;
  else console.error(`  ✗ ${m.id}: ${res.status} ${await res.text()}`);
}
console.log(`Marked ${done}/${marks.length} duplicate(s).`);
process.exit(done === marks.length ? 0 : 1);
