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

// Whether the `duplicate_of` column (migration 0013) exists. Probed once and
// cached so browse keeps working before the migration is applied: if the column
// is missing we simply don't filter on it. When present, cross-source duplicates
// (duplicate_of not null) are hidden from every browse/AI query.
let dupColumn: boolean | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function duplicatesHidden(supabase: any): Promise<boolean> {
  if (dupColumn !== null) return dupColumn;
  const { error } = await supabase.from("listings").select("duplicate_of").limit(1);
  dupColumn = !error;
  return dupColumn;
}

// Strip characters with special meaning in ILIKE / PostgREST filter values so a
// model-provided term can be interpolated safely. Keeps letters (any language),
// digits, spaces and hyphens; bounds the length.
function sanitizeIlikeTerm(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

// Apply the hard filters (status, type, location, ranges, required + forbidden
// amenities) shared by every browse/AI query.
function applyHardFilters(
  qb: ListingQueryBuilder,
  query: ListingQuery,
  hideDuplicates: boolean,
): ListingQueryBuilder {
  let q = qb.eq("status", "active");
  // Hide cross-source near-duplicates (canonical rows kept). Skipped when the
  // column isn't present yet so browse never breaks before migration 0013.
  if (hideDuplicates) q = q.is("duplicate_of", null);
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
  // AI textual exclusions: drop listings whose text mentions an unwanted term
  // (e.g. a floor level) even when it appears only in the free-text description,
  // not in the structured columns. Checked across title + description (HR + EN);
  // a listing is excluded if ANY term of an entry matches ANY of those fields.
  for (const tx of (query.textExclude ?? []).slice(0, 10)) {
    for (const raw of (tx.terms ?? []).slice(0, 8)) {
      const term = sanitizeIlikeTerm(raw);
      if (!term) continue;
      const like = `%${term}%`;
      q = q
        .not("description", "ilike", like)
        .not("description_hr", "ilike", like)
        .not("title", "ilike", like)
        .not("title_hr", "ilike", like);
    }
  }
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
  const hideDup = await duplicatesHidden(supabase);

  if (!ranked) {
    let q = applyHardFilters(
      supabase.from("listings").select(LISTING_COLUMNS, { count: "exact" }),
      query,
      hideDup,
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
  let q = applyHardFilters(supabase.from("listings").select(LISTING_COLUMNS), query, hideDup);
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
  const hideDup = await duplicatesHidden(supabase);
  // Prefer county-aware grouping; fall back to city-only if the `county` column
  // isn't present yet (migration 0006 not applied), so the location filter keeps
  // working either way.
  const base = () => {
    let q = supabase.from("listings").select("city, county").eq("status", "active");
    if (hideDup) q = q.is("duplicate_of", null);
    if (type) q = q.eq("type", type);
    return q;
  };
  const fallback = () => {
    let q = supabase.from("listings").select("city").eq("status", "active");
    if (hideDup) q = q.is("duplicate_of", null);
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
    const head = idx >= 0 ? full.slice(0, idx) : full;
    const tail = idx >= 0 ? full.slice(idx + 2) : null;
    // Zagreb is one city: the "Grad Zagreb" county (or a district token that
    // itself names Zagreb) means the city is "Zagreb" and the district is the
    // neighborhood. Robust to historical rows not yet migrated/re-crawled;
    // mirrors splitLocation() + migration 0012.
    const inZagreb = /^(grad\s+)?zagreb$/i.test(county) || /zagreb/i.test(head);
    let city: string;
    let neighborhood: string | null;
    if (inZagreb) {
      city = "Zagreb";
      // The district is `head`, unless `head` is itself just "Zagreb" (then the
      // already-migrated neighborhood lives in the tail).
      neighborhood = /^(grad\s+)?zagreb$/i.test(head) ? tail : head;
    } else {
      city = head;
      neighborhood = tail;
    }
    // "Novi Zagreb" is one kvart: collapse its "istok"/"zapad" halves.
    if (neighborhood && /^novi\s+zagreb/i.test(neighborhood)) neighborhood = "Novi Zagreb";
    if (!city) continue;
    const key = `${county} ${city}`;
    if (!map.has(key)) map.set(key, { county, city, set: new Set() });
    if (neighborhood) map.get(key)!.set.add(neighborhood);
  }
  // Sort county, city and neighborhood alphabetically with Croatian collation
  // (so č, ć, š, ž, đ order correctly, not after "z"). The UI derives the
  // county/city/neighborhood dropdown order straight from this order.
  const hr = new Intl.Collator("hr");
  return [...map.values()]
    .map(({ county, city, set }) => ({
      county,
      city,
      neighborhoods: [...set].sort((a, b) => hr.compare(a, b)),
    }))
    .sort((a, b) => hr.compare(a.county, b.county) || hr.compare(a.city, b.city));
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
