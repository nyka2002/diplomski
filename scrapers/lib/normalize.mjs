// Pure normalization helpers: raw scraped fields → the canonical `listings`
// shape (mirrors db/migrations/0002_listings.sql and lib/listings/map.ts).
// No I/O here so this module is unit-testable in isolation (tests/scrapers.test.mjs).

import { createHash } from "node:crypto";

const AMENITY_KEYS = ["balcony", "parking", "furnished", "pets"];

// ── Number parsing (Croatian formatting) ────────────────────────────────────
// Croatian uses "." as the thousands separator and "," as the decimal mark,
// e.g. "185.000 €", "1.250,50 €/mj". Prices on the target sites are whole
// numbers, but we handle decimals defensively.
export function parsePriceEur(text) {
  if (text == null) return 0;
  const m = String(text).match(/[\d.\s,]+/);
  if (!m) return 0;
  let s = m[0].replace(/\s/g, "");
  if (s.includes(".") && s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", "."); // 1.250,50 → 1250.50
  } else if (s.includes(",")) {
    s = s.replace(",", "."); // 1250,50 → 1250.50
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ""); // 185.000 → 185000 (thousands grouping)
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function parseArea(text) {
  if (text == null) return 0;
  const m = String(text).match(/(\d+(?:[.,]\d+)?)\s*(?:m²|m2|m\b|kvadrat)/i) || String(text).match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return 0;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

// Bedrooms, normalized to a number (studio/garsonijera = 0). Accepts the
// Croatian "soban" words, the "N-sobni" form, and a bare number.
export function parseRooms(text) {
  if (text == null) return 0;
  const t = String(text).toLowerCase();
  if (/garsonijera|garsonjera|studio/.test(t)) return 0;
  const words = { jednosoban: 1, dvosoban: 2, trosoban: 3, četverosoban: 4, cetverosoban: 4, peterosoban: 5 };
  for (const [w, n] of Object.entries(words)) if (t.includes(w)) return n;
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*-?\s*soban|(\d+(?:[.,]\d+)?)\s*-?\s*sob/);
  if (m) return Math.floor(Number((m[1] || m[2]).replace(",", ".")));
  const bare = t.match(/(\d+(?:[.,]\d+)?)/);
  return bare ? Math.floor(Number(bare[1].replace(",", "."))) : 0;
}

// Parse a Croatian classifieds posting date into an ISO timestamp. Handles:
//   Njuškalo  "21.06.2026. u 18:16"  (4-digit year, "u HH:MM")
//   Index     "01.11.25. 02:58"      (2-digit year → 20YY, space + HH:MM)
//   bare       "21.06.2026."
// Croatia local time is treated as UTC — the ~1–2h offset is immaterial for
// newest-first sorting, and avoids DST bookkeeping.
export function parsePostedAt(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})\.?(?:[\su]+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, d, mo, yRaw, hh, mm] = m;
  const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
  const p = (n) => String(n).padStart(2, "0");
  const date = new Date(`${y}-${p(mo)}-${p(d)}T${p(hh || 0)}:${p(mm || 0)}:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// "sale" vs "rent" from a price string / category hint.
export function deriveType(hint) {
  const t = String(hint || "").toLowerCase();
  if (/\/\s*mj|\/mo|mjesec|najam|rent|iznajml|zakup/.test(t)) return "rent";
  return "sale";
}

// Whether an ad is an apartment listing. The classifieds apartment categories
// occasionally contain seller-miscategorized non-apartments, so reject titles
// that clearly describe one of those property/offer types:
//   • business / office / land: "poslovni prostor" (+ "posl. prostor"),
//     "ured(ski) prostor", "zemljište", "hala", "skladište", "gospodarsk…"
//   • a single room let on its own (title starting "Soba"/"Sobe")
//   • short-stay hospitality ("dnevni najam" — daily rental of rooms/apartments)
// We deliberately avoid substrings that legitimately appear in apartment ads
// (a flat furnished "kao ured", the "Vinogradska" street, a flat with a
// "garaža", a flat with "3 spavaće sobe"). Cross-category junk (cars, books, …)
// is filtered earlier by the source URL not being under the real-estate section.
export function isApartmentTitle(title) {
  const t = String(title || "").toLowerCase();
  if (!t) return false;
  return !/poslovni prostor|poslovnog prostora|\bposlovni\b|posl\.\s*prostor|uredski|zemlji[šs]t|\bhala\b|skladi[šs]t|gospodarsk|dnevni najam|^\s*sob[ae]\b/.test(
    t,
  );
}

// Stable canonical id, e.g. "njuskalo-12345".
export function listingId(source, externalId) {
  return `${source}-${String(externalId).replace(/[^a-z0-9_-]/gi, "")}`;
}

// Croatian classifieds report location county-first:
//   "Grad Zagreb, Sesvete, Sesvetski Kobiljak"  → county + "City, Neighborhood"
//   "Primorsko-goranska, Opatija - Okolica, Ičići"
// Split the leading county off and keep the rest as the app's "City,
// Neighborhood" string (the city column the browse filters group on).
export function splitLocation(raw) {
  const parts = String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 3) return { county: parts[0], city: parts.slice(1).join(", ") };
  if (parts.length === 2) return { county: parts[0], city: parts[1] };
  return { county: "", city: parts[0] || "" };
}

// Detect amenities from free text (description / feature list). Conservative:
// only flags when a clear keyword is present.
export function detectAttributes(text) {
  const t = String(text || "").toLowerCase();
  return {
    balcony: /balkon|lođ|loggia|terasa|balcony|terrace/.test(t),
    parking: /parking|garaž|garaz|parkir|garage/.test(t),
    furnished: /namješt|namjest|opremljen|furnished/.test(t),
    pets: /ljubimci|kućni ljubimci|pets allowed|dozvoljeni.*ljubimci/.test(t),
  };
}

// The text we embed for semantic search — mirrors lib/admin/actions.ts and
// scripts/embed-listings.mjs so scraped listings rank consistently.
export function buildEmbeddingText(l) {
  const flags = AMENITY_KEYS.filter((k) => l.attributes?.[k]).join(", ");
  return [
    `${l.title} (${l.type === "sale" ? "for sale" : "for rent"})`,
    l.city,
    l.description,
    flags && `Features: ${flags}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Hash of the fields that, if changed at the source, mean we should update the
// stored row (and re-embed). Image URLs are included so a changed gallery is
// re-copied. Order-stable.
export function contentHash(l) {
  const payload = JSON.stringify({
    type: l.type,
    title: l.title,
    price_eur: l.price_eur,
    price_display: l.price_display,
    county: l.county,
    city: l.city,
    area_m2: l.area_m2,
    rooms: l.rooms,
    description: l.description,
    images: l.images,
    attributes: l.attributes,
    seller: l.seller,
  });
  return createHash("sha256").update(payload).digest("hex");
}

// Map a raw scraped object into a canonical listing row. The adapter is
// responsible for extracting raw fields; this enforces the shape and types.
// `raw` fields: externalId, type|categoryHint, title, titleHr?, priceText,
// city, areaText, roomsText, description, descriptionHr?, images[], specs[],
// seller{}, sourceUrl, postedAt?.
export function normalizeListing(raw, source) {
  const type = raw.type || deriveType(raw.categoryHint || raw.priceText);
  const featureText = [raw.description, ...(raw.specs || []).map((s) => `${s.label} ${s.value}`)].join(" ");
  const attributes = { ...detectAttributes(featureText), ...(raw.attributes || {}) };
  const price_eur = raw.priceEur ?? parsePriceEur(raw.priceText);
  const area_m2 = raw.areaM2 ?? parseArea(raw.areaText);
  const rooms = raw.rooms ?? parseRooms(raw.roomsText || raw.title);

  const listing = {
    id: listingId(source, raw.externalId),
    external_id: String(raw.externalId),
    type,
    title: (raw.title || "").trim(),
    title_hr: (raw.titleHr || raw.title || "").trim(),
    price_eur,
    price_display: (raw.priceText || (price_eur ? `€${price_eur.toLocaleString("en-US")}` : "")).trim(),
    county: (raw.county || "").trim(),
    city: (raw.city || "").trim(),
    area_m2,
    rooms,
    description: (raw.description || "").trim(),
    description_hr: (raw.descriptionHr || raw.description || "").trim(),
    images: (raw.images || []).filter(Boolean),
    // Bilingual spec rows. Scraped values are Croatian, so EN mirrors HR until a
    // translation step (pipeline) overwrites label/value with English.
    specs: (raw.specs || []).map((s) => ({
      label: s.label,
      labelHr: s.labelHr ?? s.label,
      value: s.value,
      valueHr: s.valueHr ?? s.value,
    })),
    seller: {
      name: raw.seller?.name || "",
      phone: raw.seller?.phone || "",
      email: raw.seller?.email || "",
      agency: raw.seller?.agency || "",
    },
    attributes,
    source,
    source_url: raw.sourceUrl || "",
    posted_at: raw.postedAt || null,
  };
  listing.content_hash = contentHash(listing);
  return listing;
}
