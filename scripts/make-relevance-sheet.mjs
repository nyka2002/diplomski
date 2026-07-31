// Build a human relevance-grading sheet (phase 12). For a set of free-text
// (semantic) search queries it asks the running agent for criteria, fetches the
// agent's ranked listings, and writes:
//   • results/relevance-sheet.csv   — one row per (query, listing) with two empty
//     grade columns (raterA, raterB) for two people to fill in 0..3.
//   • results/relevance-order.json  — the same rows in order (query index +
//     listing id + rank), so the filled grades map back for Cohen's kappa and
//     nDCG of the semantic ranking.
//
// TWO raters grade INDEPENDENTLY: 0 = irrelevant, 1 = marginal, 2 = relevant,
// 3 = highly relevant. Then run scripts/eval-stats.mjs on the results.
//
// Usage: start the app (npm run dev), then  node scripts/make-relevance-sheet.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const TOP_N = Number(process.env.TOP_N ?? 6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Free-text queries chosen to exercise SEMANTIC ranking (relevanceQuery), where
// relevance is a judgement call — exactly what needs human grading.
const QUERIES = [
  { lang: "en", type: "rent", text: "a bright quiet apartment near a park" },
  { lang: "en", type: "sale", text: "a modern renovated flat in the city center" },
  { lang: "en", type: "rent", text: "a family-friendly apartment close to schools and shops" },
  { lang: "en", type: "sale", text: "a cozy apartment with a nice view" },
  { lang: "hr", type: "rent", text: "svijetao miran stan blizu parka" },
  { lang: "hr", type: "sale", text: "moderno uređen stan u centru grada" },
  { lang: "hr", type: "rent", text: "obiteljski stan blizu škola i trgovina" },
  { lang: "hr", type: "sale", text: "ugodan stan s lijepim pogledom" },
];

function criteriaToQuery(c, type) {
  const sp = new URLSearchParams();
  if (type) sp.set("type", type);
  if (c.city) sp.set("city", c.city);
  for (const n of c.neighborhoods ?? []) sp.append("neighborhood", n);
  for (const [k, key] of [["priceMin", "priceMin"], ["priceMax", "priceMax"], ["areaMin", "areaMin"],
    ["areaMax", "areaMax"], ["roomsMin", "roomsMin"], ["roomsMax", "roomsMax"]]) if (c[k] != null) sp.set(key, String(c[k]));
  for (const a of c.mustHave ?? []) sp.set(a, "true");
  for (const a of c.forbidden ?? []) sp.append("forbidden", a);
  for (const a of c.niceToHave ?? []) sp.append("nice", a);
  if (c.relevanceQuery) sp.set("relevance", c.relevanceQuery);
  for (const tx of c.textExclude ?? []) sp.append("tx", JSON.stringify(tx));
  sp.set("pageSize", String(TOP_N));
  return sp.toString();
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const rows = [];
const order = [];

for (let qi = 0; qi < QUERIES.length; qi++) {
  const q = QUERIES[qi];
  const aiRes = await fetch(`${BASE_URL}/api/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: q.text }], lang: q.lang, type: q.type }),
  });
  if (!aiRes.ok) { console.error(`AI ${aiRes.status} for "${q.text}"`); continue; }
  const ai = await aiRes.json();
  if (ai.configured === false) { console.error("OpenAI not configured on the server"); process.exit(1); }
  const listRes = await fetch(`${BASE_URL}/api/listings?${criteriaToQuery(ai.criteria, q.type)}`);
  const listings = (await listRes.json()).listings ?? [];
  console.log(`q${qi + 1} "${q.text}" → ${listings.length} listings`);
  listings.slice(0, TOP_N).forEach((l, rank) => {
    rows.push({
      q: qi + 1, query: q.text, lang: q.lang, type: q.type, rank: rank + 1,
      id: l.id, title: l.title, city: l.location, rooms: l.rooms, area: l.areaM2, price: l.price,
      url: `${BASE_URL}/listings/${l.id}`,
    });
    order.push({ q: qi + 1, query: q.text, lang: q.lang, type: q.type, rank: rank + 1, listingId: l.id });
  });
  await sleep(1200);
}

mkdirSync("results", { recursive: true });
const header = ["q", "query", "rank", "listing_id", "title", "city", "rooms", "area_m2", "price", "url", "raterA(0-3)", "raterB(0-3)"];
const csv = [header.join(",")]
  .concat(rows.map((r) => [r.q, r.query, r.rank, r.id, r.title, r.city, r.rooms, r.area, r.price, r.url, "", ""].map(csvCell).join(",")))
  .join("\n");
writeFileSync("results/relevance-sheet.csv", csv);
writeFileSync("results/relevance-order.json", JSON.stringify({ topN: TOP_N, queries: QUERIES.length, order }, null, 2));
console.log(`\nWrote results/relevance-sheet.csv (${rows.length} rows) and results/relevance-order.json`);
console.log("→ Two people fill raterA / raterB columns (0..3) independently, then send back.");
