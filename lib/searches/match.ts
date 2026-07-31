import { AMENITY_KEYS, type ListingQuery, type Listing } from "@/lib/listings/types";

// A saved search stores the same shape the browse UI works with: a ListingQuery
// (type + hard filters + the AI overlay). `sort`/`page`/`pageSize` are kept for
// re-opening the search but don't affect matching.
export type SavedSearchCriteria = ListingQuery;

// Does a listing satisfy a saved search's HARD criteria? Mirrors the server-side
// hard filters in lib/listings/query.ts (applyHardFilters), so "matches" here
// means the listing would appear in that search's results. Soft signals
// (niceToHave, relevance) only reorder results, never exclude, so they are
// ignored. Pure + synchronous (no server/Supabase imports) → unit-testable.
//
// Note: `county` is not checked — a Listing carries only its "City, Neighborhood"
// location string, not the county — so a county-only search matches on type
// alone. In practice saved searches pick a city, which IS checked.
export function listingMatchesCriteria(l: Listing, c: SavedSearchCriteria): boolean {
  if (c.type && l.type !== c.type) return false;

  // Location: the stored location is "City, Neighborhood". A city filter matches
  // by prefix (like the browse ilike); with neighborhoods it must match one of
  // "City, Neighborhood" exactly.
  const loc = (l.location ?? "").toLowerCase();
  if (c.city) {
    if (c.neighborhoods && c.neighborhoods.length) {
      const wanted = c.neighborhoods.map((n) => `${c.city}, ${n}`.toLowerCase());
      if (!wanted.includes(loc)) return false;
    } else if (!loc.startsWith(c.city.toLowerCase())) {
      return false;
    }
  }

  if (c.priceMin != null && l.priceEur < c.priceMin) return false;
  if (c.priceMax != null && l.priceEur > c.priceMax) return false;
  if (c.areaMin != null && l.areaM2 < c.areaMin) return false;
  if (c.areaMax != null && l.areaM2 > c.areaMax) return false;
  if (c.roomsMin != null && l.rooms < c.roomsMin) return false;
  if (c.roomsMax != null && l.rooms > c.roomsMax) return false;

  // Required amenities present; forbidden amenities absent.
  for (const a of AMENITY_KEYS) if (c[a] && !l.attributes[a]) return false;
  for (const a of c.forbidden ?? []) if (l.attributes[a]) return false;

  // Textual exclusions: drop if any term appears in the title/description (both
  // languages), matching the browse behaviour.
  if (c.textExclude && c.textExclude.length) {
    const hay = `${l.title} ${l.titleHr} ${l.description} ${l.descriptionHr}`.toLowerCase();
    for (const tx of c.textExclude) {
      for (const term of tx.terms ?? []) {
        if (term && hay.includes(term.toLowerCase())) return false;
      }
    }
  }

  return true;
}
