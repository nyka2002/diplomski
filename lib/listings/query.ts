import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { embedText } from "@/lib/ai/openai";
import { withinLlmBudget } from "@/lib/ai/budget";
import { LISTING_COLUMNS, rowToListing, type ListingRow } from "./map";
import {
  AMENITY_KEYS,
  DEFAULT_SORT,
  type Amenity,
  type Listing,
  type ListingPage,
  type ListingQuery,
  type LocationGroup,
  type SortOption,
} from "./types";

const DEFAULT_PAGE_SIZE = 9;

const SORT_COLUMN: Record<SortOption, { col: string; asc: boolean }> = {
  dateNew: { col: "posted_at", asc: false },
  dateOld: { col: "posted_at", asc: true },
  priceLow: { col: "price_eur", asc: true },
  priceHigh: { col: "price_eur", asc: false },
  areaHigh: { col: "area_m2", asc: false },
  areaLow: { col: "area_m2", asc: true },
};

const empty = (page: number, pageSize: number): ListingPage => ({
  listings: [],
  total: 0,
  page,
  pageSize,
  hasMore: false,
});

// Max candidates pulled for in-memory ranking (relevance / nice-to-have tiering).
// Set to PostgREST's default max-rows so ranked mode effectively considers the
// whole hard-filtered set at this scale (was 50, which silently dropped matches
// once a type had >50 active listings). Beyond a few thousand rows the next step
// is to push the similarity ordering fully into the pgvector `match_listings`
// RPC rather than ranking in memory.
const RANK_CANDIDATES = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ListingQueryBuilder = any;

// Apply the hard filters (status, type, location, ranges, required + forbidden
// amenities) shared by every browse/AI query.
function applyHardFilters(qb: ListingQueryBuilder, query: ListingQuery): ListingQueryBuilder {
  let q = qb.eq("status", "active");
  if (query.type) q = q.eq("type", query.type);
  if (query.county) q = q.eq("county", query.county);
  if (query.city && query.neighborhoods?.length) {
    // City + neighborhoods → exact match on the stored "City, Neighborhood".
    q = q.in(
      "city",
      query.neighborhoods.map((n) => `${query.city}, ${n}`),
    );
  } else if (query.city) {
    // City only → all listings in that city (any/no neighborhood).
    q = q.ilike("city", `${query.city}%`);
  }
  if (query.priceMin != null) q = q.gte("price_eur", query.priceMin);
  if (query.priceMax != null) q = q.lte("price_eur", query.priceMax);
  if (query.areaMin != null) q = q.gte("area_m2", query.areaMin);
  if (query.areaMax != null) q = q.lte("area_m2", query.areaMax);
  if (query.roomsMin != null) q = q.gte("rooms", query.roomsMin);
  if (query.roomsMax != null) q = q.lte("rooms", query.roomsMax);
  // Required amenities (manual checkboxes + AI "must have").
  for (const a of AMENITY_KEYS) if (query[a]) q = q.eq(`attributes->>${a}`, "true");
  // AI "forbidden" → amenity must be absent.
  for (const a of query.forbidden ?? []) q = q.eq(`attributes->>${a}`, "false");
  return q;
}

// Core query: server-side hard filtering + sorting + pagination. When the AI
// overlay is present (relevance text or nice-to-have preferences) it switches to
// in-memory ranking: semantic similarity first, then nice-to-have matches on top
// (non-matches kept but flagged via `unmetNice`).
export async function fetchListings(query: ListingQuery): Promise<ListingPage> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  if (!isSupabaseConfigured) return empty(page, pageSize);

  const supabase = await createClient();
  const sort = SORT_COLUMN[query.sort ?? DEFAULT_SORT];
  const nice = query.niceToHave ?? [];
  const ranked = Boolean(query.relevance) || nice.length > 0;

  if (!ranked) {
    let q = applyHardFilters(
      supabase.from("listings").select(LISTING_COLUMNS, { count: "exact" }),
      query,
    );
    q = q.order(sort.col, { ascending: sort.asc }).order("id", { ascending: true });
    const from = (page - 1) * pageSize;
    q = q.range(from, from + pageSize - 1);

    const { data, count, error } = await q;
    if (error) {
      console.error("fetchListings error:", error.message);
      return empty(page, pageSize);
    }
    const listings = (data as unknown as ListingRow[]).map(rowToListing);
    const total = count ?? listings.length;
    return { listings, total, page, pageSize, hasMore: from + listings.length < total };
  }

  // ── Ranked mode ────────────────────────────────────────────────────────────
  let q = applyHardFilters(supabase.from("listings").select(LISTING_COLUMNS), query);
  q = q.order(sort.col, { ascending: sort.asc }).order("id", { ascending: true }).limit(RANK_CANDIDATES);
  const { data, error } = await q;
  if (error) {
    console.error("fetchListings (ranked) error:", error.message);
    return empty(page, pageSize);
  }
  let candidates = (data as unknown as ListingRow[]).map(rowToListing);

  // 1) Semantic relevance ordering (only if a query embedding can be produced
  //    and listings have embeddings; otherwise keep the sort order). The embedding
  //    is an OpenAI call on a public endpoint, so it's gated by the shared daily
  //    budget; over budget → skip ranking (results still returned, just by sort).
  if (query.relevance && (await withinLlmBudget())) {
    const embedding = await embedText(query.relevance).catch(() => null);
    if (embedding) {
      const ids = candidates.map((c) => c.id);
      const { data: sims } = await supabase.rpc("match_listings", {
        query_embedding: embedding,
        candidate_ids: ids,
        match_count: RANK_CANDIDATES,
      });
      if (Array.isArray(sims) && sims.length) {
        const rank = new Map<string, number>(sims.map((s: { id: string }, i: number) => [s.id, i]));
        candidates = [...candidates].sort(
          (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
        );
      }
    }
  }

  // 2) Nice-to-have: flag misses, then stable-sort so full matches come first.
  if (nice.length) {
    candidates = candidates.map((c) => ({
      ...c,
      unmetNice: nice.filter((a: Amenity) => !c.attributes[a]),
    }));
    candidates = [...candidates].sort((a, b) => (a.unmetNice?.length ?? 0) - (b.unmetNice?.length ?? 0));
  }

  const total = candidates.length;
  const from = (page - 1) * pageSize;
  const listings = candidates.slice(from, from + pageSize);
  return { listings, total, page, pageSize, hasMore: from + listings.length < total };
}

export async function fetchListingById(id: string): Promise<Listing | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return rowToListing(data as unknown as ListingRow);
}

// Home page: newest-first by type.
export async function fetchNewestByType(type: "sale" | "rent", limit = 6): Promise<Listing[]> {
  const { listings } = await fetchListings({ type, sort: "dateNew", pageSize: limit, page: 1 });
  return listings;
}

// Distinct locations for the filter dropdowns, grouped county → city →
// neighborhoods. Locations are stored as a `county` column plus a `city` string
// of "City, Neighborhood" (neighborhood optional). Pass `type` to scope the
// options to sale- or rent-only listings (so the Buy tab never offers a
// rent-only location and vice versa).
export async function fetchLocations(type?: "sale" | "rent"): Promise<LocationGroup[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  // Prefer county-aware grouping; fall back to city-only if the `county` column
  // isn't present yet (migration 0006 not applied), so the location filter keeps
  // working either way.
  const base = () => {
    let q = supabase.from("listings").select("city, county").eq("status", "active");
    if (type) q = q.eq("type", type);
    return q;
  };
  const fallback = () => {
    let q = supabase.from("listings").select("city").eq("status", "active");
    if (type) q = q.eq("type", type);
    return q;
  };
  const withCounty = await base();
  const res = withCounty.error ? await fallback() : withCounty;
  const data = res.data as { city: string; county?: string | null }[] | null;
  if (res.error || !data) return [];

  // Group by "county city" so the same city name in two counties stays
  // distinct, then collect neighborhoods under each.
  const map = new Map<string, { county: string; city: string; set: Set<string> }>();
  for (const row of data) {
    const full = (row.city as string) ?? "";
    const county = ((row.county as string | null) ?? "").trim();
    const idx = full.indexOf(", ");
    const city = idx >= 0 ? full.slice(0, idx) : full;
    const neighborhood = idx >= 0 ? full.slice(idx + 2) : null;
    if (!city) continue;
    const key = `${county} ${city}`;
    if (!map.has(key)) map.set(key, { county, city, set: new Set() });
    if (neighborhood) map.get(key)!.set.add(neighborhood);
  }
  return [...map.values()]
    .map(({ county, city, set }) => ({ county, city, neighborhoods: [...set].sort() }))
    .sort((a, b) => a.county.localeCompare(b.county) || a.city.localeCompare(b.city));
}

// A user's saved listings, newest-saved first.
export async function fetchSavedListings(userId: string): Promise<Listing[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_listings")
    .select(`saved_at, listing:listings(${LISTING_COLUMNS})`)
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });
  if (error || !data) return [];
  return data
    .map((r) => {
      // PostgREST embeds the related row; supabase-js may type it as an array.
      const l = (r as unknown as { listing: ListingRow | ListingRow[] | null }).listing;
      return Array.isArray(l) ? (l[0] ?? null) : l;
    })
    .filter((l): l is ListingRow => Boolean(l))
    .map(rowToListing);
}

export async function fetchSavedIds(userId: string): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_listings")
    .select("listing_id")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data.map((r) => r.listing_id as string);
}
