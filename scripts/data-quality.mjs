// Data-quality report (Phase 4) — read-only. Summarizes the catalog for the
// thesis: per-source counts, field completeness, and cross-source near-duplicate
// overlap (using the same logic as scripts/dedup-listings.mjs). Writes nothing.
//
// Usage:
//   set -a && . ./.env.local && set +a && node scripts/data-quality.mjs
import { parseEmbedding, findDuplicateGroups, pickCanonical, DEDUP_DEFAULTS } from "../scrapers/lib/dedup.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const sb = (path) =>
  fetch(`${url}/rest/v1/${path}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });

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

const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) : "0.0");
const sources = [...new Set(all.map((l) => l.source))].sort();

// ── 1) Per-source counts ────────────────────────────────────────────────────
console.log("════════ Analiza kvalitete kataloga ════════\n");
console.log(`Ukupno aktivnih oglasa: ${all.length}\n`);
console.log("1) Po izvoru (prodaja / najam):");
for (const s of sources) {
  const rows = all.filter((l) => l.source === s);
  const sale = rows.filter((l) => l.type === "sale").length;
  const rent = rows.filter((l) => l.type === "rent").length;
  console.log(`   ${s.padEnd(10)} ${String(rows.length).padStart(4)}  (${sale} prodaja, ${rent} najam)`);
}

// ── 2) Field completeness ───────────────────────────────────────────────────
const has = {
  opis: (l) => (l.description || "").trim().length > 0,
  slike: (l) => Array.isArray(l.images) && l.images.length > 0,
  površina: (l) => Number(l.area_m2) > 0,
  cijena: (l) => Number(l.price_eur) > 0,
  županija: (l) => (l.county || "").trim().length > 0,
};
console.log("\n2) Popunjenost polja (udio oglasa s vrijednošću):");
for (const [label, fn] of Object.entries(has)) {
  const n = all.filter(fn).length;
  console.log(`   ${label.padEnd(10)} ${String(n).padStart(4)} / ${all.length}  (${pct(n, all.length)} %)`);
}
console.log("   (napomena: broj soba 0 je studio/garsonijera, ne nedostajuća vrijednost)");

// ── 3) Cross-source near-duplicate overlap ──────────────────────────────────
const { groups, comparisons } = findDuplicateGroups(all);
const hidden = groups.reduce((n, g) => n + g.length - 1, 0);
console.log("\n3) Preklapanje među izvorima (gotovo isti oglasi):");
console.log(
  `   pragovi: površina ±${DEDUP_DEFAULTS.areaTol} m², cijena ≥ ${DEDUP_DEFAULTS.priceRatio}, ` +
    `kosinus ≥ ${DEDUP_DEFAULTS.embThreshold} (≥ ${DEDUP_DEFAULTS.embHigh} bez lokacijskog tokena)`,
);
console.log(`   usporedbi (blokirano po tip+sobe): ${comparisons}`);
console.log(`   grupa duplikata: ${groups.length}`);
console.log(`   oglasa označenih kao duplikat (sakriveno): ${hidden}`);
console.log(`   udio kataloga koji su duplikati: ${pct(hidden, all.length)} %`);

// Which source-pairs overlap.
const pairCounts = {};
for (const g of groups) {
  const canonical = pickCanonical(g);
  for (const d of g) {
    if (d.id === canonical.id) continue;
    const key = [d.source, canonical.source].sort().join(" ↔ ");
    pairCounts[key] = (pairCounts[key] || 0) + 1;
  }
}
console.log("   po paru izvora:");
for (const [k, v] of Object.entries(pairCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`     ${k}: ${v}`);
}

console.log("\n════════════════════════════════════════════");
