// Statistical analysis for the evaluation (phase 12). Pure functions, no I/O,
// so they are unit-tested against known values. Covers: descriptive stats,
// bootstrap confidence intervals, McNemar's test (paired binary — model A vs B),
// Wilcoxon signed-rank (paired continuous — ranking metrics), Cohen's kappa
// (inter-rater agreement) and Holm–Bonferroni correction for multiple tests.

// ── Descriptive ──────────────────────────────────────────────────────────────
export function mean(xs) {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}
export function variance(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1); // sample variance
}
export function std(xs) {
  return Math.sqrt(variance(xs));
}

// ── Normal / chi-square tails ────────────────────────────────────────────────
// erf via Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7).
function erf(x) {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return s * y;
}
export function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}
// Two-sided p from a z score.
export function twoSidedP(z) {
  return 2 * (1 - normalCdf(Math.abs(z)));
}
// Survival function of a chi-square with 1 df: P(X > x) = 2(1 - Φ(√x)).
export function chiSquare1SF(x) {
  if (x <= 0) return 1;
  return 2 * (1 - normalCdf(Math.sqrt(x)));
}

// ── Seeded RNG (deterministic bootstrap) ─────────────────────────────────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Percentile of a sorted-or-unsorted numeric array (linear interpolation).
export function percentile(xs, p) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

// Bootstrap confidence interval for a statistic (default: the mean). Resamples
// with replacement `iterations` times using a seeded RNG so results reproduce.
export function bootstrapCI(values, { statFn = mean, iterations = 2000, alpha = 0.05, seed = 12345 } = {}) {
  const n = values.length;
  const point = statFn(values);
  if (n === 0) return { point: 0, lo: 0, hi: 0 };
  const rand = mulberry32(seed);
  const stats = new Array(iterations);
  for (let b = 0; b < iterations; b++) {
    const sample = new Array(n);
    for (let i = 0; i < n; i++) sample[i] = values[(rand() * n) | 0];
    stats[b] = statFn(sample);
  }
  return { point, lo: percentile(stats, alpha / 2), hi: percentile(stats, 1 - alpha / 2) };
}

// ── McNemar's test (paired binary outcomes of two systems) ───────────────────
// b = #cases where A correct and B wrong; c = #cases A wrong and B correct.
// Small discordant counts → exact two-sided binomial; larger → chi-square with
// continuity correction.
function logChoose(n, k) {
  if (k < 0 || k > n) return -Infinity;
  let r = 0;
  for (let i = 1; i <= k; i++) r += Math.log(n - k + i) - Math.log(i);
  return r;
}
export function binomTwoSidedP(k, n, p = 0.5) {
  if (n === 0) return 1;
  const m = Math.min(k, n - k);
  let tail = 0;
  for (let i = 0; i <= m; i++) tail += Math.exp(logChoose(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p));
  return Math.min(1, 2 * tail);
}
export function mcnemar(b, c, { exactBelow = 25 } = {}) {
  const n = b + c;
  if (n === 0) return { b, c, n, method: "none", statistic: 0, p: 1 };
  if (n < exactBelow) {
    return { b, c, n, method: "exact", statistic: Math.min(b, c), p: binomTwoSidedP(Math.min(b, c), n) };
  }
  const stat = (Math.abs(b - c) - 1) ** 2 / n; // continuity-corrected
  return { b, c, n, method: "chi2cc", statistic: stat, p: chiSquare1SF(stat) };
}

// ── Wilcoxon signed-rank (paired continuous, e.g. per-query metric diffs) ────
function rankWithTies(values) {
  const idx = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j + 2) / 2; // ranks are 1-based
    for (let k = i; k <= j; k++) ranks[idx[k][1]] = avg;
    i = j + 1;
  }
  return ranks;
}
export function wilcoxonSignedRank(diffs) {
  const nz = diffs.filter((d) => d !== 0);
  const n = nz.length;
  if (n === 0) return { n: 0, wPlus: 0, wMinus: 0, W: 0, z: 0, p: 1 };
  const ranks = rankWithTies(nz.map((d) => Math.abs(d)));
  let wPlus = 0;
  let wMinus = 0;
  for (let i = 0; i < n; i++) (nz[i] > 0 ? (wPlus += ranks[i]) : (wMinus += ranks[i]));
  const W = Math.min(wPlus, wMinus);
  const meanW = (n * (n + 1)) / 4;
  const varW = (n * (n + 1) * (2 * n + 1)) / 24;
  const z = varW === 0 ? 0 : (W - meanW + 0.5) / Math.sqrt(varW); // continuity correction
  return { n, wPlus, wMinus, W, z, p: twoSidedP(z) };
}

// ── Cohen's kappa (agreement between two raters over categorical labels) ─────
export function cohensKappa(a, b) {
  if (a.length !== b.length || a.length === 0) return { kappa: 0, po: 0, pe: 0, n: 0 };
  const n = a.length;
  const labels = [...new Set([...a, ...b])];
  let agree = 0;
  const countA = new Map();
  const countB = new Map();
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) agree++;
    countA.set(a[i], (countA.get(a[i]) ?? 0) + 1);
    countB.set(b[i], (countB.get(b[i]) ?? 0) + 1);
  }
  const po = agree / n;
  let pe = 0;
  for (const l of labels) pe += ((countA.get(l) ?? 0) / n) * ((countB.get(l) ?? 0) / n);
  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
  return { kappa, po, pe, n };
}

// ── Holm–Bonferroni correction for a set of p-values ─────────────────────────
// Returns adjusted p-values in the ORIGINAL order (monotone, capped at 1).
export function holmBonferroni(pvalues) {
  const m = pvalues.length;
  const order = pvalues.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const adj = new Array(m);
  let running = 0;
  for (let rank = 0; rank < m; rank++) {
    const [p, origIdx] = order[rank];
    running = Math.max(running, Math.min(1, (m - rank) * p));
    adj[origIdx] = running;
  }
  return adj;
}
