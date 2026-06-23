import {
  AMENITY_KEYS,
  DEFAULT_SORT,
  SORT_OPTIONS,
  type Amenity,
  type ListingQuery,
  type SortOption,
} from "./types";

const isAmenity = (v: string): v is Amenity => (AMENITY_KEYS as readonly string[]).includes(v);

// Client/server-safe (no server imports): converts between a ListingQuery and
// URL search params, so the browse UI, the API route, and shareable links all
// agree on the same query shape.

const BOOL_KEYS = ["balcony", "parking", "furnished", "pets"] as const;

export function parseListingQuery(sp: URLSearchParams): ListingQuery {
  const q: ListingQuery = {};

  const type = sp.get("type");
  if (type === "sale" || type === "rent") q.type = type;

  const sort = sp.get("sort");
  if (sort && (SORT_OPTIONS as readonly string[]).includes(sort)) q.sort = sort as SortOption;

  const county = sp.get("county");
  if (county) q.county = county;
  const city = sp.get("city");
  if (city) q.city = city;
  const neighborhoods = sp.getAll("neighborhood").filter(Boolean);
  if (neighborhoods.length) q.neighborhoods = neighborhoods;

  const numKeys: [keyof ListingQuery, string][] = [
    ["priceMin", "priceMin"],
    ["priceMax", "priceMax"],
    ["areaMin", "areaMin"],
    ["areaMax", "areaMax"],
    ["roomsMin", "roomsMin"],
    ["roomsMax", "roomsMax"],
    ["page", "page"],
    ["pageSize", "pageSize"],
  ];
  for (const [key, param] of numKeys) {
    const raw = sp.get(param);
    if (raw != null && raw !== "" && !Number.isNaN(Number(raw))) {
      (q[key] as number) = Number(raw);
    }
  }

  for (const key of BOOL_KEYS) {
    if (sp.get(key) === "true") q[key] = true;
  }

  // AI overlay
  const forbidden = sp.getAll("forbidden").filter(isAmenity);
  if (forbidden.length) q.forbidden = forbidden;
  const niceToHave = sp.getAll("nice").filter(isAmenity);
  if (niceToHave.length) q.niceToHave = niceToHave;
  const relevance = sp.get("relevance");
  if (relevance) q.relevance = relevance;

  return q;
}

// Convert a Next.js page `searchParams` object into a ListingQuery (handles
// repeated keys, which arrive as arrays).
export function searchParamsToQuery(
  sp: Record<string, string | string[] | undefined>,
): ListingQuery {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((v) => usp.append(key, v));
    else usp.append(key, value);
  }
  return parseListingQuery(usp);
}

export function buildListingSearch(query: ListingQuery): string {
  const sp = new URLSearchParams();
  if (query.type) sp.set("type", query.type);
  if (query.sort && query.sort !== DEFAULT_SORT) sp.set("sort", query.sort);
  if (query.county) sp.set("county", query.county);
  if (query.city) sp.set("city", query.city);
  for (const n of query.neighborhoods ?? []) sp.append("neighborhood", n);
  if (query.priceMin != null) sp.set("priceMin", String(query.priceMin));
  if (query.priceMax != null) sp.set("priceMax", String(query.priceMax));
  if (query.areaMin != null) sp.set("areaMin", String(query.areaMin));
  if (query.areaMax != null) sp.set("areaMax", String(query.areaMax));
  if (query.roomsMin != null) sp.set("roomsMin", String(query.roomsMin));
  if (query.roomsMax != null) sp.set("roomsMax", String(query.roomsMax));
  for (const key of BOOL_KEYS) if (query[key]) sp.set(key, "true");
  for (const a of query.forbidden ?? []) sp.append("forbidden", a);
  for (const a of query.niceToHave ?? []) sp.append("nice", a);
  if (query.relevance) sp.set("relevance", query.relevance);
  if (query.page && query.page > 1) sp.set("page", String(query.page));
  if (query.pageSize) sp.set("pageSize", String(query.pageSize));
  return sp.toString();
}

// Count of active filters (excludes type/sort/pagination) — used for the chip
// summary and the "Clear all" affordance.
export function countActiveFilters(query: ListingQuery): number {
  let n = 0;
  if (query.county) n++;
  if (query.city) n++;
  n += query.neighborhoods?.length ?? 0;
  if (query.priceMin != null) n++;
  if (query.priceMax != null) n++;
  if (query.areaMin != null) n++;
  if (query.areaMax != null) n++;
  if (query.roomsMin != null) n++;
  if (query.roomsMax != null) n++;
  for (const key of BOOL_KEYS) if (query[key]) n++;
  n += query.forbidden?.length ?? 0;
  n += query.niceToHave?.length ?? 0;
  if (query.relevance) n++;
  return n;
}
