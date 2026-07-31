// Offline evaluation of the content-based recommender (phase 11).
//
// Method: leave-one-out over saved_listings. For every user with at least two
// saved listings, hold out one saved listing at a time, build the taste profile
// from that user's REMAINING saved listings (average of their embeddings, as the
// app does), rank all active non-duplicate listings by cosine similarity to the
// profile, and measure where the held-out listing lands. This gives an objective
// ground truth (the held-out item is the one "relevant" result) without any human
// labelling. The content-based ranker is compared against a popularity baseline
// (rank by how many users saved each listing).
//
// Metrics (averaged over all leave-one-out queries): MRR, Precision@k, Recall@k
// and nDCG@k. Prints a summary and, with --out <file>, writes the numbers as JSON
// for the statistical analysis phase.
//
// Usage (load env first):
//   set -a && . ./.env.local && set +a && node scripts/eval-recommendations.mjs [--out results.json]
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { parseEmbedding, cosineSim } from "../scrapers/lib/dedup.mjs";
import {
  reciprocalRank,
  precisionAtK,
  recallAtK,
  ndcgAtK,
  mean,
} from "../lib/eval/metrics.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const outIdx = process.argv.indexOf("--out");
const outFile = outIdx >= 0 ? process.argv[outIdx + 1] : null;

const MIN_SAVED = 2; // users need >= 2 saves to leave one out and still have a profile
const KS = [5, 10]; // cut-offs for precision/recall/nDCG

const sb = (path) =>
  fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });

async function fetchAll(path) {
  const res = await sb(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Load data ────────────────────────────────────────────────────────────────
const saved = await fetchAll("saved_listings?select=user_id,listing_id");
const listings = await fetchAll(
  "listings?select=id,type,embedding&status=eq.active&duplicate_of=is.null&embedding=not.is.null",
);

// Candidate pool: active, non-duplicate listings that have an embedding.
const embById = new Map();
for (const l of listings) {
  const e = parseEmbedding(l.embedding);
  if (e) embById.set(l.id, e);
}
const candidateIds = [...embById.keys()];

// Popularity: how many users saved each listing (global). For the baseline we
// exclude the evaluated user's own saves (below) so it can't trivially "predict"
// that user's held-out listing — a proper leave-one-out baseline.
const saveCount = new Map();
for (const s of saved) saveCount.set(s.listing_id, (saveCount.get(s.listing_id) ?? 0) + 1);

// Group saves by user, keeping only listings we have embeddings for.
const byUser = new Map();
for (const s of saved) {
  if (!embById.has(s.listing_id)) continue;
  if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
  byUser.get(s.user_id).push(s.listing_id);
}
const evalUsers = [...byUser.entries()].filter(([, ids]) => new Set(ids).size >= MIN_SAVED);

if (evalUsers.length === 0) {
  console.log(
    `Not enough data for leave-one-out: no user has >= ${MIN_SAVED} saved listings with embeddings.`,
  );
  console.log(
    `(saved rows: ${saved.length}, candidate listings: ${candidateIds.length}, users with saves: ${byUser.size})`,
  );
  process.exit(0);
}

// Average of a set of embedding vectors → the taste profile.
function centroid(ids) {
  const vecs = ids.map((id) => embById.get(id)).filter(Boolean);
  if (vecs.length === 0) return null;
  const dim = vecs[0].length;
  const acc = new Array(dim).fill(0);
  for (const v of vecs) for (let i = 0; i < dim; i++) acc[i] += v[i];
  for (let i = 0; i < dim; i++) acc[i] /= vecs.length;
  return acc;
}

// ── Leave-one-out queries ────────────────────────────────────────────────────
const contentQ = [];
const popQ = [];
for (const [, savedIdsRaw] of evalUsers) {
  const savedIds = [...new Set(savedIdsRaw)];
  const savedSet = new Set(savedIds);
  // Popularity EXCLUDING this user's own saves (leave-one-out baseline): a
  // listing's score is how many OTHER users saved it. Break ties by id for a
  // deterministic order.
  const popScore = (id) => (saveCount.get(id) ?? 0) - (savedSet.has(id) ? 1 : 0);
  for (const heldOut of savedIds) {
    const trainIds = savedIds.filter((id) => id !== heldOut);
    const profile = centroid(trainIds);
    if (!profile) continue;
    // Candidates = every embedded listing except the user's TRAINING saves (keep
    // the held-out one so it can be recovered).
    const cands = candidateIds.filter((id) => id === heldOut || !savedSet.has(id));
    const contentRanked = [...cands].sort(
      (a, b) => cosineSim(profile, embById.get(b)) - cosineSim(profile, embById.get(a)),
    );
    contentQ.push({ ranked: contentRanked, relevant: new Set([heldOut]) });
    // Popularity baseline over the same candidate set (user's own saves excluded
    // from the score, so it can't leak the held-out listing).
    const popRanked = [...cands].sort((a, b) => popScore(b) - popScore(a) || (a < b ? -1 : 1));
    popQ.push({ ranked: popRanked, relevant: new Set([heldOut]) });
  }
}

// ── Score ────────────────────────────────────────────────────────────────────
function scoreAll(queries) {
  const grade = (relevant) => (id) => (relevant.has(id) ? 1 : 0);
  const res = { queries: queries.length, mrr: 0 };
  res.mrr = mean(queries.map((q) => reciprocalRank(q.ranked, q.relevant)));
  for (const k of KS) {
    res[`precision@${k}`] = mean(queries.map((q) => precisionAtK(q.ranked, q.relevant, k)));
    res[`recall@${k}`] = mean(queries.map((q) => recallAtK(q.ranked, q.relevant, k)));
    res[`ndcg@${k}`] = mean(queries.map((q) => ndcgAtK(q.ranked, grade(q.relevant), k)));
  }
  return res;
}

const content = scoreAll(contentQ);
const popularity = scoreAll(popQ);

const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "number" ? Number(v.toFixed(4)) : v]));
const summary = {
  users: evalUsers.length,
  queries: contentQ.length,
  candidates: candidateIds.length,
  content: round(content),
  popularity: round(popularity),
  // Paired per-query reciprocal ranks (same held-out query, both methods) for a
  // Wilcoxon signed-rank comparison in the statistics phase.
  perQuery: {
    rrContent: contentQ.map((q) => Number(reciprocalRank(q.ranked, q.relevant).toFixed(6))),
    rrPopularity: popQ.map((q) => Number(reciprocalRank(q.ranked, q.relevant).toFixed(6))),
  },
};

console.log("──────── Recommendation evaluation (leave-one-out) ────────");
console.log(`users ≥ ${MIN_SAVED} saved: ${summary.users}   LOO queries: ${summary.queries}   candidates: ${summary.candidates}\n`);
const rows = ["mrr", ...KS.flatMap((k) => [`precision@${k}`, `recall@${k}`, `ndcg@${k}`])];
console.log("metric".padEnd(14), "content".padStart(10), "popularity".padStart(12));
for (const r of rows)
  console.log(r.padEnd(14), String(summary.content[r]).padStart(10), String(summary.popularity[r]).padStart(12));

if (outFile) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${outFile}`);
}
