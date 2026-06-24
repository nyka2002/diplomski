// Unit tests for the scraper normalization layer (pure functions, no network).
// Run: npm run test:scrapers
import assert from "node:assert/strict";
import {
  parsePriceEur,
  parseArea,
  parseRooms,
  deriveType,
  listingId,
  detectAttributes,
  contentHash,
  normalizeListing,
  parsePostedAt,
  splitLocation,
  isApartmentTitle,
} from "../scrapers/lib/normalize.mjs";

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

// ── price ────────────────────────────────────────────────────────────────────
check("parsePriceEur: Croatian thousands grouping", () => {
  assert.equal(parsePriceEur("185.000 €"), 185000);
  assert.equal(parsePriceEur("1.250.000 EUR"), 1250000);
});
check("parsePriceEur: decimal comma", () => {
  assert.equal(parsePriceEur("1.250,50 €/mj"), 1250.5);
  assert.equal(parsePriceEur("650,00"), 650);
});
check("parsePriceEur: plain integer and junk", () => {
  assert.equal(parsePriceEur("650 €/mjesec"), 650);
  assert.equal(parsePriceEur("Na upit"), 0);
  assert.equal(parsePriceEur(null), 0);
});

// ── area ──────────────────────────────────────────────────────────────────────
check("parseArea: m² variants", () => {
  assert.equal(parseArea("72 m²"), 72);
  assert.equal(parseArea("95m2"), 95);
  assert.equal(parseArea("38,5 m²"), 39);
  assert.equal(parseArea(""), 0);
});

// ── rooms ─────────────────────────────────────────────────────────────────────
check("parseRooms: studio/garsonijera = 0", () => {
  assert.equal(parseRooms("Garsonijera u centru"), 0);
  assert.equal(parseRooms("Studio apartment"), 0);
});
check("parseRooms: N-sobni and words", () => {
  assert.equal(parseRooms("2-sobni stan"), 2);
  assert.equal(parseRooms("Trosoban stan"), 3);
  assert.equal(parseRooms("3"), 3);
});

// ── type ──────────────────────────────────────────────────────────────────────
check("isApartmentTitle: keeps flats, drops business/land", () => {
  // Apartments — including ones that merely mention an office use, the
  // "Vinogradska" street, or a garage.
  assert.equal(isApartmentTitle("Stan: Zagreb (Centar), 55 m2, novogradnja"), true);
  assert.equal(isApartmentTitle("STAN 82m2, ŠUBIĆEVA, namj. kao ured"), true);
  assert.equal(isApartmentTitle("PENTHOUSE NETO 118 m2 - Zagreb, Vinogradska bolnica"), true);
  assert.equal(isApartmentTitle("2-sobni + GARAŽA, luksuzni"), true);
  assert.equal(isApartmentTitle("Stan: Split, dvije spavaće sobe, 62 m2"), true);
  // Non-apartments: business / office / land / room / daily-rental hospitality.
  assert.equal(isApartmentTitle("POSLOVNI PROSTOR U NOVOGRADNJI, VODICE"), false);
  assert.equal(isApartmentTitle("URED/POSLOVNI PROSTOR, SVETA NEDELJA"), false);
  assert.equal(isApartmentTitle("ČRNOMEREC - 3.SOB POSL. PROSTOR 69m2 + GARAŽA"), false);
  assert.equal(isApartmentTitle("građevinsko i poljoprivredno zemljište"), false);
  assert.equal(isApartmentTitle("SOBA Slavonski Brod, sve režije u cijeni"), false);
  assert.equal(isApartmentTitle('"LO" apartmani i sobe, 4* DNEVNI NAJAM'), false);
  assert.equal(isApartmentTitle(""), false);
});

check("deriveType: rent vs sale", () => {
  assert.equal(deriveType("650 €/mj"), "rent");
  assert.equal(deriveType("najam stana"), "rent");
  assert.equal(deriveType("185.000 €"), "sale");
});

// ── id + attributes ───────────────────────────────────────────────────────────
check("listingId: stable, source-prefixed", () => {
  assert.equal(listingId("njuskalo", "12345678"), "njuskalo-12345678");
});
check("detectAttributes: keyword flags", () => {
  const a = detectAttributes("Stan ima balkon i garažu, namješten");
  assert.equal(a.balcony, true);
  assert.equal(a.parking, true);
  assert.equal(a.furnished, true);
  assert.equal(a.pets, false);
});

// ── content hash ──────────────────────────────────────────────────────────────
check("contentHash: stable across calls, changes with content", () => {
  const base = { type: "sale", title: "A", price_eur: 1, price_display: "€1", city: "Z", area_m2: 10, rooms: 1, description: "d", images: ["x"], attributes: {}, seller: {} };
  assert.equal(contentHash(base), contentHash({ ...base }));
  assert.notEqual(contentHash(base), contentHash({ ...base, price_eur: 2 }));
});

// ── posted date ───────────────────────────────────────────────────────────────
check("parsePostedAt: Njuškalo 'DD.MM.YYYY. u HH:MM'", () => {
  assert.equal(parsePostedAt("21.06.2026. u 18:16"), "2026-06-21T18:16:00.000Z");
  assert.equal(parsePostedAt("5.1.2026."), "2026-01-05T00:00:00.000Z");
  assert.equal(parsePostedAt("01.11.25. 02:58"), "2025-11-01T02:58:00.000Z"); // index 2-digit year
  assert.equal(parsePostedAt("Na upit"), null);
  assert.equal(parsePostedAt(""), null);
});

// ── location split (county-first) ───────────────────────────────────────────────
check("splitLocation: county / city / neighborhood", () => {
  assert.deepEqual(splitLocation("Grad Zagreb, Sesvete, Sesvetski Kobiljak"), {
    county: "Grad Zagreb",
    city: "Sesvete, Sesvetski Kobiljak",
  });
  assert.deepEqual(splitLocation("Primorsko-goranska, Opatija"), {
    county: "Primorsko-goranska",
    city: "Opatija",
  });
  assert.deepEqual(splitLocation("Zagreb"), { county: "", city: "Zagreb" });
});

// ── full normalize ────────────────────────────────────────────────────────────
check("normalizeListing: maps raw → canonical row", () => {
  const row = normalizeListing(
    {
      externalId: "999",
      priceText: "650 €/mj",
      title: "2-sobni stan s balkonom",
      city: "Zagreb, Trešnjevka",
      areaText: "55 m²",
      description: "Lijep stan, balkon i parking.",
      images: ["https://img/1.jpg", "https://img/2.jpg"],
      seller: { name: "Ana" },
      sourceUrl: "https://www.njuskalo.hr/nekretnine/oglas-999",
    },
    "njuskalo",
  );
  assert.equal(row.id, "njuskalo-999");
  assert.equal(row.type, "rent");
  assert.equal(row.price_eur, 650);
  assert.equal(row.area_m2, 55);
  assert.equal(row.rooms, 2);
  assert.equal(row.attributes.balcony, true);
  assert.equal(row.attributes.parking, true);
  assert.equal(row.seller.name, "Ana");
  assert.equal(row.title_hr, row.title); // falls back to title when no HR variant
  assert.ok(row.content_hash.length === 64);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
