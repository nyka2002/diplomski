// Statistical analysis of evaluation results (phase 12). Reads the JSON produced
// by the evaluation harnesses and reports confidence intervals and significance
// tests, so the numbers in the thesis come straight from a script.
//
// Inputs (any mix, given as file arguments):
//   • agent results   — from  node tests/eval-agent.mjs --out agent.json
//       → per-model extraction accuracy + bootstrap CI, per-field error
//         breakdown, and (with ≥2 models) pairwise McNemar tests with
//         Holm–Bonferroni correction.
//   • recommendation  — from  node scripts/eval-recommendations.mjs --out rec.json
//       → Wilcoxon signed-rank test of content-based vs popularity (paired
//         per-query reciprocal rank) + bootstrap CI of the mean difference.
//   • rater labels    — a JSON file { "raterA": [...], "raterB": [...] }
//       → Cohen's kappa inter-rater agreement.
//
// Usage:
//   node scripts/eval-stats.mjs agent.json rec.json [labels.json] [--out stats.json]
import { readFileSync, writeFileSync } from "node:fs";
import {
  mean,
  bootstrapCI,
  mcnemar,
  wilcoxonSignedRank,
  cohensKappa,
  holmBonferroni,
} from "../lib/eval/stats.mjs";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outFile = outIdx >= 0 ? args[outIdx + 1] : null;
const files = args.filter((a, i) => a !== "--out" && i !== outIdx && !a.startsWith("--"));
if (files.length === 0) {
  console.error("Usage: node scripts/eval-stats.mjs <result.json>... [--out stats.json]");
  process.exit(1);
}

const pct = (x) => (x == null ? "—" : (x * 100).toFixed(1) + " %");
const f4 = (x) => (x == null ? "—" : Number(x).toFixed(4));
const report = { agent: null, recommendation: null, kappa: null };

// ── Load + classify ──────────────────────────────────────────────────────────
const agentRuns = [];
let rec = null;
let raters = null;
for (const file of files) {
  const j = JSON.parse(readFileSync(file, "utf8"));
  if (Array.isArray(j.runs) && j.runs[0]?.perCase) agentRuns.push(...j.runs);
  else if (j.perQuery?.rrContent) rec = j;
  else if (Array.isArray(j.raterA) && Array.isArray(j.raterB)) raters = j;
  else console.error(`(skipping ${file}: unrecognized shape)`);
}

// ── Agent: accuracy CIs, error breakdown, model comparison ───────────────────
if (agentRuns.length) {
  console.log("════════ Agent extraction ════════\n");
  const perModel = [];
  for (const run of agentRuns) {
    const outcomes = run.perCase.map((c) => (c.allCorrect ? 1 : 0));
    const ci = bootstrapCI(outcomes, { seed: 20260726 });
    perModel.push({ model: run.model, n: outcomes.length, accuracy: mean(outcomes), ci });
    console.log(
      `${run.model.padEnd(20)} fully-correct ${pct(mean(outcomes))}  ` +
        `95% CI [${pct(ci.lo)}, ${pct(ci.hi)}]  (n=${outcomes.length})`,
    );
  }

  // Error breakdown by criterion type (aggregated over the FIRST model's cases).
  const base = agentRuns[0];
  const fieldErr = {};
  let halluc = 0;
  for (const c of base.perCase) {
    for (const [name, ok] of Object.entries(c.fields)) {
      fieldErr[name] ??= { wrong: 0, total: 0 };
      fieldErr[name].total++;
      if (!ok) fieldErr[name].wrong++;
    }
    if (c.extras?.length) halluc++;
  }
  console.log(`\nError breakdown by criterion (${base.model}):`);
  const rows = Object.entries(fieldErr).sort((a, b) => b[1].wrong - a[1].wrong);
  for (const [name, { wrong, total }] of rows)
    console.log(`   ${name.padEnd(14)} ${wrong}/${total} wrong  (${pct(wrong / total)})`);
  console.log(`   hallucinated-filter cases: ${halluc}/${base.perCase.length}`);

  // Pairwise McNemar (paired on case id) with Holm correction.
  const comparisons = [];
  if (agentRuns.length >= 2) {
    for (let i = 0; i < agentRuns.length; i++)
      for (let j = i + 1; j < agentRuns.length; j++) {
        const A = new Map(agentRuns[i].perCase.map((c) => [c.id, c.allCorrect]));
        const B = new Map(agentRuns[j].perCase.map((c) => [c.id, c.allCorrect]));
        let b = 0, c = 0;
        for (const [id, aOk] of A) {
          if (!B.has(id)) continue;
          const bOk = B.get(id);
          if (aOk && !bOk) b++;
          else if (!aOk && bOk) c++;
        }
        comparisons.push({ a: agentRuns[i].model, bModel: agentRuns[j].model, ...mcnemar(b, c) });
      }
    const adj = holmBonferroni(comparisons.map((c) => c.p));
    comparisons.forEach((c, i) => (c.pHolm = adj[i]));
    console.log("\nModel comparison (McNemar, Holm-corrected):");
    for (const c of comparisons)
      console.log(
        `   ${c.a} vs ${c.bModel}: b=${c.b} c=${c.c} ${c.method} p=${f4(c.p)} p_holm=${f4(c.pHolm)}` +
          (c.pHolm < 0.05 ? "  *" : ""),
      );
  }
  report.agent = { perModel, fieldErr, hallucinationCases: halluc, comparisons };
}

// ── Recommendation: content vs popularity (paired Wilcoxon) ──────────────────
if (rec) {
  console.log("\n════════ Recommendation (content vs popularity) ════════\n");
  const a = rec.perQuery.rrContent;
  const b = rec.perQuery.rrPopularity;
  const diffs = a.map((x, i) => x - b[i]);
  const w = wilcoxonSignedRank(diffs);
  const ci = bootstrapCI(diffs, { seed: 20260726 });
  console.log(`queries: ${a.length}`);
  console.log(`mean reciprocal rank — content: ${f4(mean(a))}   popularity: ${f4(mean(b))}`);
  console.log(`mean difference (content − popularity): ${f4(mean(diffs))}  95% CI [${f4(ci.lo)}, ${f4(ci.hi)}]`);
  console.log(`Wilcoxon signed-rank: n=${w.n} W=${w.W} z=${f4(w.z)} p=${f4(w.p)}` + (w.p < 0.05 ? "  *" : ""));
  if (a.length < 20)
    console.log("   NOTE: very small sample — treat significance with caution (needs more usage data).");
  report.recommendation = { queries: a.length, mrrContent: mean(a), mrrPopularity: mean(b), meanDiff: mean(diffs), ci, wilcoxon: w };
}

// ── Inter-rater agreement (Cohen's kappa) ────────────────────────────────────
if (raters) {
  console.log("\n════════ Inter-rater agreement ════════\n");
  const k = cohensKappa(raters.raterA, raters.raterB);
  console.log(`Cohen's kappa: ${f4(k.kappa)}  (observed ${pct(k.po)}, expected ${pct(k.pe)}, n=${k.n})`);
  report.kappa = k;
}

if (outFile) {
  writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outFile}`);
}
