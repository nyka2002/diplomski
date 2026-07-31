import type { Amenity, Listing } from "./types";

// Which side of a comparison "wins" a row (cheaper price, larger area, more
// rooms). `null` when the two are equal or the field is not ranked.
export type CompareSide = "a" | "b" | null;

export type CompareKey =
  | "type"
  | "price"
  | "area"
  | "rooms"
  | "location"
  | Amenity;

export interface CompareRow {
  key: CompareKey;
  kind: "text" | "amenity";
  a: string | number | boolean;
  b: string | number | boolean;
  // For ranked numeric rows, which listing is the better value; else null.
  highlight: CompareSide;
}

const AMENITIES: Amenity[] = ["balcony", "parking", "furnished", "pets"];

// Better side for a numeric field. dir "min" → smaller wins (price); "max" →
// larger wins (area, rooms). Equal → null.
function rank(a: number, b: number, dir: "min" | "max"): CompareSide {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
  const aWins = dir === "min" ? a < b : a > b;
  return aWins ? "a" : "b";
}

// Build the side-by-side comparison rows for two listings. Raw values are kept
// (numbers stay numbers, amenities stay booleans) so the view can localize and
// format them; only the ranking decision lives here.
export function buildComparisonRows(a: Listing, b: Listing): CompareRow[] {
  const rows: CompareRow[] = [
    { key: "type", kind: "text", a: a.type, b: b.type, highlight: null },
    { key: "price", kind: "text", a: a.price, b: b.price, highlight: rank(a.priceEur, b.priceEur, "min") },
    { key: "area", kind: "text", a: a.areaM2, b: b.areaM2, highlight: rank(a.areaM2, b.areaM2, "max") },
    { key: "rooms", kind: "text", a: a.rooms, b: b.rooms, highlight: rank(a.rooms, b.rooms, "max") },
    { key: "location", kind: "text", a: a.location, b: b.location, highlight: null },
    ...AMENITIES.map(
      (am): CompareRow => ({
        key: am,
        kind: "amenity",
        a: Boolean(a.attributes[am]),
        b: Boolean(b.attributes[am]),
        highlight: null,
      }),
    ),
  ];
  return rows;
}
