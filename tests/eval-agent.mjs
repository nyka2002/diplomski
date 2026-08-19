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

  // City extraction — Zagreb is one city; its districts (Sesvete, Trnje, …) are
  // neighborhoods of "Zagreb". So naming a district yields city "Zagreb" + that
  // neighborhood. Uses districts that exist for the given type (sale: "Sesvete",
  // rent: "Trnje"). Adjust if your data differs.
  { id: "en-city-sale", lang: "en", type: "sale",
    turns: ["an apartment in Sesvete"],
    gold: { city: "Zagreb", neighborhoods: ["Sesvete"] } },

  { id: "hr-city-rent", lang: "hr", type: "rent",
    turns: ["stan u Trnju"],
    gold: { city: "Zagreb", neighborhoods: ["Trnje"] } },

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

  // ── Expanded set (phase 11) ────────────────────────────────────────────────
  // Room counts (a plain "N-room" is an exact count).
  { id: "en-onebed", lang: "en", type: "rent",
    turns: ["a one-bedroom apartment"], gold: { roomsMin: 1, roomsMax: 1 } },
  { id: "hr-jednosoban", lang: "hr", type: "rent",
    turns: ["jednosoban stan"], gold: { roomsMin: 1, roomsMax: 1 } },
  { id: "en-threebed", lang: "en", type: "sale",
    turns: ["a three-bedroom apartment"], gold: { roomsMin: 3, roomsMax: 3 } },
  { id: "hr-trosoban", lang: "hr", type: "sale",
    turns: ["trosoban stan"], gold: { roomsMin: 3, roomsMax: 3 } },
  { id: "en-atleast3", lang: "en", type: "sale",
    turns: ["an apartment with at least three bedrooms"], gold: { roomsMin: 3 } },
  { id: "hr-najmanje3", lang: "hr", type: "rent",
    turns: ["stan s barem tri sobe"], gold: { roomsMin: 3 } },

  // Price / area ranges.
  { id: "en-price-min", lang: "en", type: "sale",
    turns: ["apartments over 100000 euros"], gold: { priceMin: 100000 } },
  { id: "hr-price-between", lang: "hr", type: "sale",
    turns: ["stan između 100000 i 150000 eura"], gold: { priceMin: 100000, priceMax: 150000 } },
  { id: "en-area-max", lang: "en", type: "rent",
    turns: ["an apartment up to 80 m2"], gold: { areaMax: 80 } },
  { id: "hr-area-between", lang: "hr", type: "sale",
    turns: ["stan između 40 i 60 kvadrata"], gold: { areaMin: 40, areaMax: 60 } },

  // Required amenity combinations.
  { id: "en-balcony-parking", lang: "en", type: "sale",
    turns: ["an apartment with a balcony and parking"], gold: { mustHave: ["balcony", "parking"] } },
  { id: "hr-namjesten-parking", lang: "hr", type: "rent",
    turns: ["namješten stan s parkingom"], gold: { mustHave: ["furnished", "parking"] } },

  // Soft (nice-to-have) when explicitly softened — mirrors the phase-5 rule.
  { id: "en-nice-furnished", lang: "en", type: "rent",
    turns: ["an apartment, ideally furnished"], gold: { niceToHave: ["furnished"] } },
  { id: "hr-nice-balcony", lang: "hr", type: "rent",
    turns: ["stan, po mogućnosti s balkonom"], gold: { niceToHave: ["balcony"] } },

  // Textual exclusion — top / last floor.
  { id: "en-no-topfloor", lang: "en", type: "sale",
    turns: ["an apartment, not on the top floor"],
    gold: { textExclude: [["top floor", "last floor", "zadnji kat", "potkrovlj"]] } },

  // Multi-turn: change a previously stated value.
  { id: "en-multiturn-price-change", lang: "en", type: "sale",
    turns: ["an apartment up to 100000 euros", "actually make it up to 150000"],
    gold: { priceMax: 150000 } },
  { id: "hr-multiturn-add-parking", lang: "hr", type: "rent",
    turns: ["dvosoban stan", "dodaj i parking"],
    gold: { roomsMin: 2, roomsMax: 2, mustHave: ["parking"] } },

  // ── Second expansion (phase 12): larger set for the model comparison ─────────
  // Room counts.
  { id: "en-fourbed", lang: "en", type: "sale",
    turns: ["a four-bedroom apartment"], gold: { roomsMin: 4, roomsMax: 4 } },
  { id: "hr-cetverosoban", lang: "hr", type: "sale",
    turns: ["četverosoban stan"], gold: { roomsMin: 4, roomsMax: 4 } },
  { id: "en-two-to-three", lang: "en", type: "rent",
    turns: ["an apartment with two to three rooms"], gold: { roomsMin: 2, roomsMax: 3 } },
  { id: "hr-najvise-dvije", lang: "hr", type: "rent",
    turns: ["stan s najviše dvije sobe"], gold: { roomsMax: 2 } },

  // Price / area ranges.
  { id: "en-price-max2", lang: "en", type: "sale",
    turns: ["an apartment under 250000 euros"], gold: { priceMax: 250000 } },
  { id: "hr-price-min", lang: "hr", type: "sale",
    turns: ["stanovi iznad 120000 eura"], gold: { priceMin: 120000 } },
  { id: "en-area-min", lang: "en", type: "rent",
    turns: ["an apartment of at least 70 m2"], gold: { areaMin: 70 } },
  { id: "hr-area-max", lang: "hr", type: "rent",
    turns: ["stan do 90 kvadrata"], gold: { areaMax: 90 } },
  { id: "en-price-area", lang: "en", type: "sale",
    turns: ["an apartment up to 300000 euros and at least 60 m2"],
    gold: { priceMax: 300000, areaMin: 60 } },

  // Required amenities.
  { id: "en-balcony", lang: "en", type: "sale",
    turns: ["an apartment with a balcony"], gold: { mustHave: ["balcony"] } },
  { id: "hr-parking", lang: "hr", type: "rent",
    turns: ["stan s parkingom"], gold: { mustHave: ["parking"] } },
  { id: "en-furnished-balcony", lang: "en", type: "rent",
    turns: ["a furnished apartment with a balcony"], gold: { mustHave: ["furnished", "balcony"] } },
  { id: "hr-three-amenities", lang: "hr", type: "rent",
    turns: ["namješten stan s balkonom i parkingom"],
    gold: { mustHave: ["furnished", "balcony", "parking"] } },

  // Forbidden amenity.
  { id: "hr-no-parking", lang: "hr", type: "rent",
    turns: ["stan bez parkinga"], gold: { forbidden: ["parking"] } },

  // Nice-to-have (explicitly softened).
  { id: "en-nice-parking", lang: "en", type: "rent",
    turns: ["an apartment, parking would be a plus"], gold: { niceToHave: ["parking"] } },
  { id: "hr-nice-furnished", lang: "hr", type: "rent",
    turns: ["stan, po mogućnosti namješten"], gold: { niceToHave: ["furnished"] } },

  // Textual exclusion (standalone).
  { id: "hr-no-ground", lang: "hr", type: "sale",
    turns: ["stan, ne u prizemlju"], gold: { textExclude: [["prizemlj", "ground floor"]] } },
  { id: "en-no-basement", lang: "en", type: "sale",
    turns: ["an apartment, no basement"], gold: { textExclude: [["basement", "suteren", "podrum"]] } },

  // Descriptive (semantic) queries — a non-empty relevance query is expected.
  { id: "en-relevance-view", lang: "en", type: "sale",
    turns: ["a bright apartment with a nice view"], gold: { relevance: true } },
  { id: "hr-relevance-quiet", lang: "hr", type: "rent",
    turns: ["miran stan okružen zelenilom"], gold: { relevance: true } },

  // Multi-turn: change a value / remove an amenity.
  { id: "en-multiturn-rooms-change", lang: "en", type: "rent",
    turns: ["a two-bedroom apartment", "actually make it three bedrooms"],
    gold: { roomsMin: 3, roomsMax: 3 } },
  { id: "hr-multiturn-remove-parking", lang: "hr", type: "rent",
    turns: ["stan s parkingom i balkonom", "makni parking"],
    gold: { mustHave: ["balcony"] } },

  // City / district extraction (Zagreb districts present in the catalog).
  { id: "hr-city-maksimir", lang: "hr", type: "rent",
    turns: ["stan u Maksimiru"], gold: { city: "Zagreb", neighborhoods: ["Maksimir"] } },
  { id: "hr-city-crnomerec", lang: "hr", type: "sale",
    turns: ["stan u Črnomercu"], gold: { city: "Zagreb", neighborhoods: ["Črnomerec"] } },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const norm = (v) => (v === undefined ? null : v);
const setEq = (a = [], b = []) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

async function postAi(messages, lang, type, model, tries = 3) {
  const res = await fetch(`${BASE_URL}/api/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // `model` is honored by the server only if it is on its AI_MODEL_ALLOWLIST;
    // otherwise the configured default model is used (see app/api/ai/route.ts).
    body: JSON.stringify({ messages, lang, type, ...(model ? { model } : {}) }),
  });
  if (res.status === 429 && tries > 0) {
    console.log("    (rate limited — waiting 60 s)");
    await sleep(60000);
    return postAi(messages, lang, type, model, tries - 1);
  }
  if (!res.ok) throw new Error(`/api/ai ${res.status}`);
  const data = await res.json();
  if (data.configured === false) throw new Error("OpenAI not configured on the server");
  return data; // { criteria, reply, model, ... }
}

// Run a (possibly multi-turn) conversation, returning the final extracted criteria.
async function runConversation(turns, lang, type, model) {
  const messages = [];
  let criteria = null;
  for (const userText of turns) {
    messages.push({ role: "user", content: userText });
    const data = await postAi(messages, lang, type, model);
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

// ── One evaluation suite (a single model) ────────────────────────────────────
async function runSuite(model) {
  console.log(`\nEvaluating agent at ${BASE_URL}  (model: ${model || "server default"})\n`);
  const fieldTally = {}; // field → { correct, total }
  let casesAllCorrect = 0;
  let totalListings = 0, totalViolating = 0;
  const rankResults = [];
  const multiturn = [];
  const perCase = []; // per-case outcomes for paired statistics (phase 12)

  for (const tc of CASES) {
    console.log(`▶ ${tc.id} (${tc.lang}, ${tc.type})`);
    let criteria;
    try {
      criteria = await runConversation(tc.turns, tc.lang, tc.type, model);
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
    perCase.push({ id: tc.id, lang: tc.lang, type: tc.type, allCorrect: ext.allCorrect, fields: ext.fields, extras: ext.extras });
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
  console.log(`model: ${model || "server default"}`);
  console.log("\n1) Criteria-extraction accuracy (per field):");
  let cTot = 0, cOk = 0;
  const perField = {};
  for (const [name, { correct, total }] of Object.entries(fieldTally).sort()) {
    cTot += total; cOk += correct;
    perField[name] = { correct, total };
    console.log(`   ${name.padEnd(14)} ${correct}/${total}  (${((correct / total) * 100).toFixed(0)} %)`);
  }
  console.log(`   ${"OVERALL".padEnd(14)} ${cOk}/${cTot}  (${((cOk / cTot) * 100).toFixed(1)} %)`);
  console.log(`   fully-correct cases: ${casesAllCorrect}/${CASES.length}`);

  console.log("\n2) Hard-filter compliance:");
  console.log(`   ${totalViolating} violating listing(s) out of ${totalListings} returned` +
    `  (${totalListings ? (100 - (totalViolating / totalListings) * 100).toFixed(1) : "—"} % clean)`);

  const pairs = rankResults.reduce((s, r) => s + r.pairs, 0);
  const ord = rankResults.reduce((s, r) => s + r.ordered, 0);
  const mono = rankResults.filter((r) => r.monotonic).length;
  console.log("\n3) Soft-ranking correctness (nice-to-have ordering):");
  if (rankResults.length) {
    console.log(`   ${ord}/${pairs} adjacent pairs correctly ordered  (${((ord / pairs) * 100).toFixed(1)} %)`);
    console.log(`   fully monotonic result lists: ${mono}/${rankResults.length}`);
  } else {
    console.log("   (no ranked cases produced ≥2 listings)");
  }

  const mtOk = multiturn.filter((m) => m.ok).length;
  console.log("\n4) Multi-turn behavior (final criteria correct):");
  if (multiturn.length) {
    console.log(`   ${mtOk}/${multiturn.length} conversations ended with fully-correct criteria`);
    for (const m of multiturn) console.log(`     ${m.ok ? "✓" : "✗"} ${m.id}`);
  } else {
    console.log("   (no multi-turn cases)");
  }
  console.log("\n══════════════════════════════════════════════════");

  return {
    model: model || "server-default",
    caseCount: CASES.length,
    perCase, // [{ id, lang, type, allCorrect, fields, extras }] — for paired tests
    extraction: {
      perField,
      overall: { correct: cOk, total: cTot, pct: cTot ? cOk / cTot : 0 },
      fullyCorrect: casesAllCorrect,
    },
    compliance: {
      listings: totalListings,
      violating: totalViolating,
      cleanPct: totalListings ? 1 - totalViolating / totalListings : null,
    },
    ranking: { pairs, ordered: ord, orderedPct: pairs ? ord / pairs : null, monotonic: mono, rankedCases: rankResults.length },
    multiturn: { total: multiturn.length, fullyCorrect: mtOk, cases: multiturn },
  };
}

// ── Main: optionally loop several models, optionally write JSON ───────────────
async function main() {
  // MODELS="gpt-4o-mini,other-model" compares models (each must be on the
  // server's AI_MODEL_ALLOWLIST). Unset → a single run with the server default.
  const models = (process.env.MODELS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const outIdx = process.argv.indexOf("--out");
  const outFile = outIdx >= 0 ? process.argv[outIdx + 1] : process.env.EVAL_OUT || null;

  const runs = [];
  if (models.length === 0) {
    runs.push(await runSuite(undefined));
  } else {
    for (const m of models) runs.push(await runSuite(m));
  }

  if (outFile) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(outFile, JSON.stringify({ baseUrl: BASE_URL, runs }, null, 2));
    console.log(`\nWrote ${outFile}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
