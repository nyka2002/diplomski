// Unit tests for the cross-source dedup decision (pure functions, no network).
// Run: npm run test:dedup
import assert from "node:assert/strict";
import { cosineSim, parseEmbedding, areDuplicates, pickCanonical } from "../scrapers/lib/dedup.mjs";

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  ✗ ${name} — ${err.message}`);
  }
}

// ── cosineSim / parseEmbedding ──────────────────────────────────────────────
check("cosineSim: identical → 1, orthogonal → 0, mismatched length → 0", () => {
  assert.equal(cosineSim([1, 0, 0], [1, 0, 0]), 1);
  assert.equal(cosineSim([1, 0], [0, 1]), 0);
  assert.equal(cosineSim([1, 0, 0], [1, 0]), 0);
  assert.equal(cosineSim([], []), 0);
});
check("parseEmbedding: JSON-array string → number[], passthrough array, junk → []", () => {
  assert.deepEqual(parseEmbedding("[0.1,0.2,0.3]"), [0.1, 0.2, 0.3]);
  assert.deepEqual(parseEmbedding([1, 2]), [1, 2]);
  assert.deepEqual(parseEmbedding("not json"), []);
  assert.deepEqual(parseEmbedding(null), []);
});

// ── areDuplicates ───────────────────────────────────────────────────────────
// A close-to-collinear pair (cosine ≈ 0.95, above the 0.86 default) and a
// far-apart pair (cosine = 0.5, below it).
const HI = [1, 0];
const HI2 = [0.95, 0.31]; // cosine ≈ 0.95 (upper tier, accepted on its own)
const MID = [0.9, 0.436]; // cosine ≈ 0.90 (lower tier, needs a shared location token)
const LO = [0.5, 0.866]; // cosine = 0.50 (below any threshold)

const base = {
  source: "njuskalo",
  type: "sale",
  rooms: 3,
  area_m2: 74,
  price_eur: 330000,
  county: "Grad Zagreb",
  city: "Zagreb, Trešnjevka",
  title: "Trešnjevka 3-sobni stan 74 m2",
  embedding: HI,
};

check("areDuplicates: cross-source structural + semantic match → true", () => {
  const b = { ...base, source: "oglasnik", area_m2: 75, price_eur: 335000, embedding: HI2 };
  assert.equal(areDuplicates(base, b), true);
});
check("areDuplicates: same source → false", () => {
  assert.equal(areDuplicates(base, { ...base, embedding: HI2 }), false);
});
check("areDuplicates: different room count → false", () => {
  assert.equal(areDuplicates(base, { ...base, source: "index", rooms: 2, embedding: HI2 }), false);
});
check("areDuplicates: area beyond tolerance → false", () => {
  assert.equal(areDuplicates(base, { ...base, source: "oglasnik", area_m2: 90, embedding: HI2 }), false);
});
check("areDuplicates: price beyond ±5% → false", () => {
  assert.equal(areDuplicates(base, { ...base, source: "oglasnik", price_eur: 420000, embedding: HI2 }), false);
});
check("areDuplicates: conflicting county → false", () => {
  const b = { ...base, source: "oglasnik", county: "Splitsko-dalmatinska", embedding: HI2 };
  assert.equal(areDuplicates(base, b), false);
});
check("areDuplicates: low semantic similarity despite structural match → false", () => {
  const b = { ...base, source: "oglasnik", embedding: LO };
  assert.equal(areDuplicates(base, b), false);
});
check("areDuplicates: Index (no county) vs Njuškalo — county check skipped → true", () => {
  const idx = { ...base, source: "index", county: "", embedding: HI2 };
  assert.equal(areDuplicates(base, idx), true);
});
check("areDuplicates: borderline cosine + shared location token → true", () => {
  const a = { ...base, county: "Primorsko-goranska", city: "Rijeka, Belveder", title: "Rijeka Belveder stan 81 m2", embedding: HI };
  const idx = { ...a, source: "index", county: "", city: "", title: "Belveder 80m2 3-bedroom apartment", embedding: MID };
  assert.equal(areDuplicates(a, idx), true);
});
check("areDuplicates: borderline cosine + NO shared location token → false", () => {
  const a = { ...base, county: "Grad Zagreb", city: "Zagreb, Gornji Grad - Medveščak", title: "Zvonimir Posavskog 2-sobni garaza", rooms: 2, area_m2: 47, price_eur: 900, embedding: HI };
  const idx = { ...a, source: "index", county: "", city: "", title: "Svetice moderni 2-sobni garazom", embedding: MID };
  assert.equal(areDuplicates(a, idx), false);
});
check("areDuplicates: missing area or price → false (cannot corroborate)", () => {
  assert.equal(areDuplicates(base, { ...base, source: "index", area_m2: 0, embedding: HI2 }), false);
  assert.equal(areDuplicates(base, { ...base, source: "index", price_eur: 0, embedding: HI2 }), false);
});

// ── pickCanonical ───────────────────────────────────────────────────────────
check("pickCanonical: prefers most images, then longest description", () => {
  const a = { id: "njuskalo-1", images: [1, 2], description: "short", posted_at: null };
  const b = { id: "oglasnik-2", images: [1, 2, 3, 4], description: "x", posted_at: null };
  const c = { id: "index-3", images: [1], description: "long description here", posted_at: null };
  assert.equal(pickCanonical([a, b, c]).id, "oglasnik-2");
});

console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
