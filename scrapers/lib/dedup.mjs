// Pure cross-source near-duplicate logic (Phase 4). No I/O, so it is unit-testable
// in isolation (tests/dedup.test.mjs) and shared by the offline scripts
// (scripts/dedup-listings.mjs, scripts/data-quality.mjs).
//
// The same physical apartment is sometimes posted on more than one classifieds
// site by the same agent, with rewritten text. We therefore decide duplication
// from STRUCTURAL agreement (type, room count, floor area, asking price, and —
// when both expose it — county) corroborated by semantic (embedding) similarity.
// This favours precision: it is far worse to hide two genuinely distinct flats
// than to miss one duplicate.

// Parse a pgvector value (REST returns it as a JSON-array string) into number[].
export function parseEmbedding(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

// Cosine similarity of two equal-length numeric vectors. OpenAI embeddings are
// unit-normalized, but we compute the full cosine so the function is correct for
// any input. Returns 0 for empty / mismatched / zero vectors.
export function cosineSim(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function normText(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Generic words that carry no location meaning — dropped before comparing the
// location vocabulary of two listings (bilingual: scraped titles are Croatian,
// but some are stored/translated with English words too).
const LOC_STOPWORDS = new Set([
  "stan", "stana", "stanovi", "apartment", "apartments", "prodaja", "prodajem",
  "najam", "iznajmljivanje", "zakup", "sale", "rent", "sobni", "soban", "sobe",
  "bedroom", "bedrooms", "room", "rooms", "garaza", "garaža", "garage", "garazom",
  "balkon", "balcony", "terasa", "terrace", "novogradnja", "luksuzni", "luxury",
  "centar", "center", "zagreb", "grad", "novi", "nova", "novo", "penthouse",
  "modern", "moderni", "with", "and", "the", "for", "kat", "prizemlje", "adaptaciju",
]);

// The location vocabulary of a listing: distinct ≥4-letter words from its county,
// city and title, minus generic terms. Used to corroborate a borderline semantic
// match with a shared place name (e.g. "Belveder", "Marof").
export function locationTokens(l) {
  const text = `${l.county || ""} ${l.city || ""} ${l.title || ""}`.toLowerCase();
  const out = new Set();
  for (const tok of text.split(/[^\p{L}\p{N}]+/u)) {
    if (tok.length >= 4 && !/^\d+$/.test(tok) && !LOC_STOPWORDS.has(tok)) out.add(tok);
  }
  return out;
}

export function sharesLocationToken(a, b) {
  const ta = locationTokens(a);
  const tb = locationTokens(b);
  for (const t of ta) if (tb.has(t)) return true;
  return false;
}

export const DEDUP_DEFAULTS = {
  areaTol: 2, // absolute m² tolerance
  priceRatio: 0.95, // min/max price ratio (≈ ±5 %)
  embThreshold: 0.86, // lower cosine tier — needs a shared location token
  embHigh: 0.93, // upper cosine tier — near-identical text, accepted on its own
};

// Decide whether two listings from DIFFERENT sources describe the same apartment.
// `a.embedding` / `b.embedding` must already be number[] (parse with
// parseEmbedding when loading). Missing embeddings → similarity 0 → not a
// duplicate.
//
// After the structural gate (same type/rooms, area within tolerance, price within
// ±5 %, and — when both expose it — the same county), the semantic decision is
// two-tiered: a near-identical description (cosine ≥ embHigh) is accepted on its
// own, while a merely-similar one (embThreshold ≤ cosine < embHigh) must also
// share a location word. This separates the same flat re-posted with rewritten
// text from two distinct same-size, same-price flats in the same city.
export function areDuplicates(a, b, opts = {}) {
  const { areaTol, priceRatio, embThreshold, embHigh } = { ...DEDUP_DEFAULTS, ...opts };
  if (!a || !b) return false;
  if (a.source === b.source) return false; // cross-source only
  if (a.type !== b.type) return false;
  if (Number(a.rooms) !== Number(b.rooms)) return false;

  const areaA = Number(a.area_m2) || 0;
  const areaB = Number(b.area_m2) || 0;
  if (areaA === 0 || areaB === 0) return false;
  if (Math.abs(areaA - areaB) > areaTol) return false;

  const pa = Number(a.price_eur) || 0;
  const pb = Number(b.price_eur) || 0;
  if (pa === 0 || pb === 0) return false;
  if (Math.min(pa, pb) / Math.max(pa, pb) < priceRatio) return false;

  // Location corroboration: if BOTH expose a county, they must agree. (Index
  // listings carry no county, so this check is skipped for them.)
  const ca = normText(a.county);
  const cb = normText(b.county);
  if (ca && cb && ca !== cb) return false;

  const sim = cosineSim(a.embedding, b.embedding);
  if (sim >= embHigh) return true;
  return sim >= embThreshold && sharesLocationToken(a, b);
}

// Group listings into cross-source near-duplicate sets. Blocks by (type, rooms)
// to avoid an all-pairs scan, compares cross-source pairs with areDuplicates, and
// unions matches (so transitively-linked listings land in one group). `listings`
// must have number[] embeddings (parse with parseEmbedding first). Returns
// { groups, comparisons } where each group has ≥2 members.
export function findDuplicateGroups(listings, opts = {}) {
  const parent = new Map(listings.map((l) => [l.id, l.id]));
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const blocks = new Map();
  for (const l of listings) {
    const key = `${l.type}|${Number(l.rooms)}`;
    if (!blocks.has(key)) blocks.set(key, []);
    blocks.get(key).push(l);
  }

  let comparisons = 0;
  for (const items of blocks.values()) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (items[i].source === items[j].source) continue;
        comparisons++;
        if (areDuplicates(items[i], items[j], opts)) union(items[i].id, items[j].id);
      }
    }
  }

  const byRoot = new Map();
  for (const l of listings) {
    const r = find(l.id);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(l);
  }
  const groups = [...byRoot.values()].filter((g) => g.length >= 2);
  return { groups, comparisons };
}

// Choose the canonical listing of a duplicate group: keep the most informative
// one — most images, then longest description, then earliest posted, then a
// stable id tie-break. Returns the canonical member.
export function pickCanonical(group) {
  return [...group].sort((a, b) => {
    const imgA = (a.images?.length ?? 0);
    const imgB = (b.images?.length ?? 0);
    if (imgA !== imgB) return imgB - imgA;
    const dA = (a.description?.length ?? 0);
    const dB = (b.description?.length ?? 0);
    if (dA !== dB) return dB - dA;
    const pA = a.posted_at ? Date.parse(a.posted_at) : Infinity;
    const pB = b.posted_at ? Date.parse(b.posted_at) : Infinity;
    if (pA !== pB) return pA - pB;
    return String(a.id).localeCompare(String(b.id));
  })[0];
}
