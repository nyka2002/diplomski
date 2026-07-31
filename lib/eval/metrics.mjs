// Ranking-quality metrics for the evaluation harness (phase 11). Pure functions,
// no I/O, so they are shared by the recommendation and agent-ranking evaluations
// and unit-tested directly. All take a `ranked` array of item ids (best first)
// and a notion of relevance: either a Set/array of relevant ids (binary) or a
// grade function id -> number (graded, for nDCG).

// Precision@k: fraction of the top-k that are relevant.
export function precisionAtK(ranked, relevant, k) {
  const rel = relevant instanceof Set ? relevant : new Set(relevant);
  const top = ranked.slice(0, k);
  if (top.length === 0) return 0;
  const hits = top.filter((id) => rel.has(id)).length;
  return hits / top.length;
}

// Recall@k: fraction of all relevant items found in the top-k.
export function recallAtK(ranked, relevant, k) {
  const rel = relevant instanceof Set ? relevant : new Set(relevant);
  if (rel.size === 0) return 0;
  const hits = ranked.slice(0, k).filter((id) => rel.has(id)).length;
  return hits / rel.size;
}

// Reciprocal rank of the first relevant item (0 if none in the list).
export function reciprocalRank(ranked, relevant) {
  const rel = relevant instanceof Set ? relevant : new Set(relevant);
  for (let i = 0; i < ranked.length; i++) if (rel.has(ranked[i])) return 1 / (i + 1);
  return 0;
}

// Mean reciprocal rank over many queries. Each query: { ranked, relevant }.
export function meanReciprocalRank(queries) {
  if (queries.length === 0) return 0;
  return mean(queries.map((q) => reciprocalRank(q.ranked, q.relevant)));
}

// Average precision for one query (area under the precision-recall curve,
// averaged at the ranks of the relevant items).
export function averagePrecision(ranked, relevant) {
  const rel = relevant instanceof Set ? relevant : new Set(relevant);
  if (rel.size === 0) return 0;
  let hits = 0;
  let sum = 0;
  for (let i = 0; i < ranked.length; i++) {
    if (rel.has(ranked[i])) {
      hits++;
      sum += hits / (i + 1);
    }
  }
  return sum / rel.size;
}

// Mean average precision over many queries.
export function meanAveragePrecision(queries) {
  if (queries.length === 0) return 0;
  return mean(queries.map((q) => averagePrecision(q.ranked, q.relevant)));
}

// Discounted cumulative gain at k. `grade` is a function id -> relevance grade
// (>= 0); binary relevance is just grade in {0,1}.
export function dcgAtK(ranked, grade, k) {
  let dcg = 0;
  const top = ranked.slice(0, k);
  for (let i = 0; i < top.length; i++) {
    const g = grade(top[i]) || 0;
    if (g) dcg += g / Math.log2(i + 2); // ranks are 1-based: i=0 -> log2(2)=1
  }
  return dcg;
}

// Normalized DCG at k: DCG divided by the ideal DCG (grades sorted descending).
// `allGrades` is the list of grades of every candidate that could be ranked;
// defaults to the grades of the ranked items themselves.
export function ndcgAtK(ranked, grade, k, allGrades) {
  const dcg = dcgAtK(ranked, grade, k);
  const grades = (allGrades ?? ranked.map(grade)).map((g) => g || 0).sort((a, b) => b - a);
  let idcg = 0;
  for (let i = 0; i < Math.min(k, grades.length); i++) {
    if (grades[i]) idcg += grades[i] / Math.log2(i + 2);
  }
  return idcg === 0 ? 0 : dcg / idcg;
}

// Arithmetic mean of a number array (0 for empty).
export function mean(xs) {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}
