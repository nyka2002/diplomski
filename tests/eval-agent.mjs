// Evaluation harness for the conversational search agent (thesis chapter 7).
//
// Measures four things against the REAL running system (no fabricated numbers):
//   1. Criteria-extraction accuracy — per field, vs a hand-labeled gold set.
//   2. Hard-filter compliance        — share of returned listings that violate
//                                       a required/forbidden/range/text rule
//                                       the agent itself extracted (target: 0).
//   3. Soft-ranking correctness      — are listings that satisfy the nice-to-have
//                                       amenities ranked ahead of those that don't.
//   4. Multi-turn behavior           — adding/removing constraints across turns.
//
// HOW IT WORKS
//   It calls the same HTTP endpoints the app uses: POST /api/ai (extraction) and
//   GET /api/listings (filtering + ranking). So it needs the app running with a
//   configured OpenAI key + Supabase, nothing else.
//
// RUN
//   1) Start the app (dev):  npm run dev
//      …or point at a deployed URL with BASE_URL.
//   2) In another terminal:  node tests/eval-agent.mjs
//      Options via env:
//        BASE_URL   default http://localhost:3000
//        DELAY_MS   default 1500  (pause between cases; keeps under the 20-req /
//                                  5-min rate limit — raise if you hit 429s)
//
// OUTPUT
//   A per-case log plus a SUMMARY block with the four metrics. Copy the SUMMARY
//   back so the numbers can go into the thesis. Nothing here is written to disk.
//
// NOTE ON THE GOLD SET
//   City cases assume your catalog contains "Zagreb". If it doesn't, change the
//   `city` queries/gold below to a city your data actually has — extraction only
//   fills `city` when the value is among the catalog's offered locations.

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const DELAY_MS = Number(process.env.DELAY_MS ?? 1500);
const AMENITIES = ["balcony", "parking", "furnished", "pets"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Gold test set ────────────────────────────────────────────────────────────
// Each case: turns (one or more user messages), and the gold criteria the agent
// should extract after the LAST turn. `textExclude` lists concepts, each a set of
// acceptable lowercase term substrings (the extraction is correct if ANY appears
// in one extracted entry's terms). `relevance: true` means a non-empty relevance
// query is expected (its exact wording is not scored).
const CASES = [
  { id: "en-rooms-amenities", lang: "en", type: "rent",
    turns: ["a two-bedroom apartment with a balcony, must allow pets"],
    gold: { roomsMin: 2, roomsMax: 2, mustHave: ["balcony", "pets"] } },

  { id: "hr-rooms-amenities", lang: "hr", type: "rent",
    turns: ["dvosoban stan s balkonom, mora dopuštati ljubimce"],
    gold: { roomsMin: 2, roomsMax: 2, mustHave: ["balcony", "pets"] } },

  // City extraction — uses cities that actually exist in the catalog for the
  // given type (sale: "Sesvete", rent: "Trnje"). Adjust if your data differs.
  { id: "en-city-sale", lang: "en", type: "sale",
    turns: ["an apartment in Sesvete"],
    gold: { city: "Sesvete" } },

  { id: "hr-city-rent", lang: "hr", type: "rent",
    turns: ["stan u Trnju"],
    gold: { city: "Trnje" } },

  { id: "en-ranges", lang: "en", type: "sale",
    turns: ["an apartment up to 200000 euros, at least 50 m2"],
    gold: { priceMax: 200000, areaMin: 50 } },

  { id: "hr-ranges", lang: "hr", type: "sale",
    turns: ["stan do 200000 eura, barem 50 kvadrata"],
    gold: { priceMax: 200000, areaMin: 50 } },

  { id: "en-furnished-noground", lang: "en", type: "rent",
    turns: ["a furnished apartment, not on the ground floor"],
    gold: { mustHave: ["furnished"], textExclude: [["ground floor", "prizemlj"]] } },

  { id: "hr-furnished-noground", lang: "hr", type: "rent",
    turns: ["namješten stan, ali ne u prizemlju"],
    gold: { mustHave: ["furnished"], textExclude: [["prizemlj", "ground floor"]] } },

  { id: "en-parking-nobasement", lang: "en", type: "sale",
    turns: ["an apartment with parking, no basement"],
    gold: { mustHave: ["parking"], textExclude: [["basement", "suteren", "podrum"]] } },

  { id: "hr-relevance-nice", lang: "hr", type: "rent",
    turns: ["stan blizu centra, po mogućnosti s parkingom"],
    gold: { relevance: true, niceToHave: ["parking"] } },

  { id: "en-relevance-nice", lang: "en", type: "rent",
    turns: ["a quiet apartment near a park, a balcony would be nice"],
    gold: { relevance: true, niceToHave: ["balcony"] } },

  { id: "en-rooms-range-forbidden", lang: "en", type: "rent",
    turns: ["3 to 4 rooms, parking required, pets not allowed"],
    gold: { roomsMin: 3, roomsMax: 4, mustHave: ["parking"], forbidden: ["pets"] } },

  // Multi-turn: add a constraint, then remove an earlier one.
  { id: "en-multiturn-remove", lang: "en", type: "rent",
    turns: [
      "a two-bedroom apartment with a balcony",
      "actually, it should also be pet-friendly",
      "never mind the balcony",
    ],
    gold: { roomsMin: 2, roomsMax: 2, mustHave: ["pets"] } },

  // Multi-turn: accumulate price → furnished → floor exclusion.
  { id: "hr-multiturn-add", lang: "hr", type: "sale",
    turns: [
      "stan do 150000 eura",
      "neka bude namješten",
      "i ne u prizemlju",
    ],
    gold: { priceMax: 150000, mustHave: ["furnished"], textExclude: [["prizemlj", "ground floor"]] } },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const norm = (v) => (v === undefined ? null : v);
const setEq = (a = [], b = []) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

async function postAi(messages, lang, type, tries = 3) {
  const res = await fetch(`${BASE_URL}/api/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, lang, type }),
  });
  if (res.status === 429 && tries > 0) {
    console.log("    (rate limited — waiting 60 s)");
    await sleep(60000);
    return postAi(messages, lang, type, tries - 1);
  }
  if (!res.ok) throw new Error(`/api/ai ${res.status}`);
  const data = await res.json();
  if (data.configured === false) throw new Error("OpenAI not configured on the server");
  return data; // { criteria, reply, ... }
}

// Run a (possibly multi-turn) conversation, returning the final extracted criteria.
async function runConversation(turns, lang, type) {
  const messages = [];
  let criteria = null;
  for (const userText of turns) {
    messages.push({ role: "user", content: userText });
    const data = await postAi(messages, lang, type);
    criteria = data.criteria;
    messages.push({ role: "assistant", content: data.reply ?? "" });
    await sleep(DELAY_MS);
  }
  return criteria;
}

// Map extracted AiCriteria → /api/listings query string (mirrors criteriaToFilters
// + buildListingSearch in the app).
function criteriaToQuery(c, type) {
  const sp = new URLSearchParams();
  if (type) sp.set("type", type);
  if (c.city) sp.set("city", c.city);
  for (const n of c.neighborhoods ?? []) sp.append("neighborhood", n);
  for (const [k, key] of [["priceMin", "priceMin"], ["priceMax", "priceMax"], ["areaMin", "areaMin"],
    ["areaMax", "areaMax"], ["roomsMin", "roomsMin"], ["roomsMax", "roomsMax"]]) {
    if (c[k] != null) sp.set(key, String(c[k]));
  }
  for (const a of c.mustHave ?? []) sp.set(a, "true");
  for (const a of c.forbidden ?? []) sp.append("forbidden", a);
  for (const a of c.niceToHave ?? []) sp.append("nice", a);
  if (c.relevanceQuery) sp.set("relevance", c.relevanceQuery);
  for (const tx of c.textExclude ?? []) sp.append("tx", JSON.stringify(tx));
  sp.set("pageSize", "50");
  return sp.toString();
}

async function fetchListings(c, type) {
  const res = await fetch(`${BASE_URL}/api/listings?${criteriaToQuery(c, type)}`);
  if (!res.ok) throw new Error(`/api/listings ${res.status}`);
  const data = await res.json();
  return data.listings ?? [];
}

// Score extraction of one case: returns { fields: {name: bool}, allCorrect }.
function scoreExtraction(c, gold) {
  const f = {};
  if ("city" in gold) f.city = norm(c.city) === norm(gold.city);
  if ("neighborhoods" in gold) f.neighborhoods = setEq(c.neighborhoods, gold.neighborhoods);
  for (const k of ["priceMin", "priceMax", "areaMin", "areaMax", "roomsMin", "roomsMax"]) {
    if (k in gold) f[k] = norm(c[k]) === norm(gold[k]);
  }
  for (const k of ["mustHave", "forbidden", "niceToHave"]) {
    if (k in gold) f[k] = setEq(c[k], gold[k]);
  }
  if ("relevance" in gold) f.relevance = Boolean(c.relevanceQuery) === Boolean(gold.relevance);
  if ("textExclude" in gold) {
    const terms = (c.textExclude ?? []).flatMap((t) => (t.terms ?? []).map((s) => s.toLowerCase()));
    f.textExclude = gold.textExclude.every((concept) =>
      concept.some((want) => terms.some((t) => t.includes(want))));
  }
  // Fields the gold does NOT specify should be empty/absent (penalize hallucinated filters).
  const extras = [];
  if (!("mustHave" in gold) && (c.mustHave ?? []).length) extras.push("mustHave");
  if (!("forbidden" in gold) && (c.forbidden ?? []).length) extras.push("forbidden");
  if (!("textExclude" in gold) && (c.textExclude ?? []).length) extras.push("textExclude");
  const allCorrect = Object.values(f).every(Boolean) && extras.length === 0;
  return { fields: f, extras, allCorrect };
}

// Check hard-filter compliance of returned listings against the extracted criteria.
function checkCompliance(c, listings) {
  const violations = [];
  for (const l of listings) {
    const text = `${l.title ?? ""} ${l.titleHr ?? ""} ${l.description ?? ""} ${l.descriptionHr ?? ""}`.toLowerCase();
    const bad = [];
    if (c.priceMin != null && l.priceEur < c.priceMin) bad.push("priceMin");
    if (c.priceMax != null && l.priceEur > c.priceMax) bad.push("priceMax");
    if (c.areaMin != null && l.areaM2 < c.areaMin) bad.push("areaMin");
    if (c.areaMax != null && l.areaM2 > c.areaMax) bad.push("areaMax");
    if (c.roomsMin != null && l.rooms < c.roomsMin) bad.push("roomsMin");
    if (c.roomsMax != null && l.rooms > c.roomsMax) bad.push("roomsMax");
    for (const a of c.mustHave ?? []) if (!l.attributes?.[a]) bad.push(`mustHave:${a}`);
    for (const a of c.forbidden ?? []) if (l.attributes?.[a]) bad.push(`forbidden:${a}`);
    for (const tx of c.textExclude ?? [])
      for (const term of tx.terms ?? [])
        if (term && text.includes(String(term).toLowerCase())) bad.push(`text:${term}`);
    if (bad.length) violations.push({ id: l.id, bad });
  }
  return { total: listings.length, violations };
}

// Soft-ranking: among returned listings, the count of unmet nice-to-have amenities
// should be non-decreasing down the list (better matches first).
function checkRanking(c, listings) {
  const nice = c.niceToHave ?? [];
  if (!nice.length || listings.length < 2) return null;
  const unmet = listings.map((l) => nice.filter((a) => !l.attributes?.[a]).length);
  let ok = 0;
  for (let i = 1; i < unmet.length; i++) if (unmet[i - 1] <= unmet[i]) ok++;
  return { pairs: unmet.length - 1, ordered: ok, monotonic: ok === unmet.length - 1 };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Evaluating agent at ${BASE_URL}\n`);
  const fieldTally = {}; // field → { correct, total }
  let casesAllCorrect = 0;
  let totalListings = 0, totalViolating = 0;
  const rankResults = [];
  const multiturn = [];

  for (const tc of CASES) {
    console.log(`▶ ${tc.id} (${tc.lang}, ${tc.type})`);
    let criteria;
    try {
      criteria = await runConversation(tc.turns, tc.lang, tc.type);
    } catch (e) {
      console.log(`   ERROR: ${e.message}\n`);
      continue;
    }

    const ext = scoreExtraction(criteria, tc.gold);
    for (const [name, ok] of Object.entries(ext.fields)) {
      fieldTally[name] ??= { correct: 0, total: 0 };
      fieldTally[name].total++;
      if (ok) fieldTally[name].correct++;
    }
    if (ext.allCorrect) casesAllCorrect++;
    const wrong = Object.entries(ext.fields).filter(([, ok]) => !ok).map(([n]) => n);
    console.log(`   extraction: ${ext.allCorrect ? "ALL OK" : "wrong: " + wrong.join(", ")}` +
      (ext.extras.length ? ` | hallucinated: ${ext.extras.join(", ")}` : ""));
    if (tc.turns.length > 1) multiturn.push({ id: tc.id, ok: ext.allCorrect });

    try {
      const listings = await fetchListings(criteria, tc.type);
      const comp = checkCompliance(criteria, listings);
      totalListings += comp.total;
      totalViolating += comp.violations.length;
      console.log(`   compliance: ${comp.total} listings, ${comp.violations.length} violating` +
        (comp.violations.length ? ` (${comp.violations.slice(0, 3).map((v) => v.bad.join("/")).join("; ")})` : ""));
      const rank = checkRanking(criteria, listings);
      if (rank) {
        rankResults.push(rank);
        console.log(`   ranking: ${rank.ordered}/${rank.pairs} adjacent pairs ordered` +
          (rank.monotonic ? " (monotonic)" : ""));
      }
    } catch (e) {
      console.log(`   listings ERROR: ${e.message}`);
    }
    console.log("");
    await sleep(DELAY_MS);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("════════════════════ SUMMARY ════════════════════");
  console.log("\n1) Criteria-extraction accuracy (per field):");
  let cTot = 0, cOk = 0;
  for (const [name, { correct, total }] of Object.entries(fieldTally).sort()) {
    cTot += total; cOk += correct;
    console.log(`   ${name.padEnd(14)} ${correct}/${total}  (${((correct / total) * 100).toFixed(0)} %)`);
  }
  console.log(`   ${"OVERALL".padEnd(14)} ${cOk}/${cTot}  (${((cOk / cTot) * 100).toFixed(1)} %)`);
  console.log(`   fully-correct cases: ${casesAllCorrect}/${CASES.length}`);

  console.log("\n2) Hard-filter compliance:");
  console.log(`   ${totalViolating} violating listing(s) out of ${totalListings} returned` +
    `  (${totalListings ? (100 - (totalViolating / totalListings) * 100).toFixed(1) : "—"} % clean)`);

  console.log("\n3) Soft-ranking correctness (nice-to-have ordering):");
  if (rankResults.length) {
    const pairs = rankResults.reduce((s, r) => s + r.pairs, 0);
    const ord = rankResults.reduce((s, r) => s + r.ordered, 0);
    const mono = rankResults.filter((r) => r.monotonic).length;
    console.log(`   ${ord}/${pairs} adjacent pairs correctly ordered  (${((ord / pairs) * 100).toFixed(1)} %)`);
    console.log(`   fully monotonic result lists: ${mono}/${rankResults.length}`);
  } else {
    console.log("   (no ranked cases produced ≥2 listings)");
  }

  console.log("\n4) Multi-turn behavior (final criteria correct):");
  if (multiturn.length) {
    const ok = multiturn.filter((m) => m.ok).length;
    console.log(`   ${ok}/${multiturn.length} conversations ended with fully-correct criteria`);
    for (const m of multiturn) console.log(`     ${m.ok ? "✓" : "✗"} ${m.id}`);
  } else {
    console.log("   (no multi-turn cases)");
  }
  console.log("\n══════════════════════════════════════════════════");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
