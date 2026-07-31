import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LISTING_COLUMNS, rowToListing, type ListingRow } from "./map";
import { orderByIdRank } from "./recommend-order";
import { fetchNewestByType } from "./query";
import type { Listing } from "./types";

// Load full listing rows for a set of ids (active only) and return them in the
// order the ids were given — the recommendation RPCs already rank by similarity.
async function fetchListingsRanked(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rankedIds: string[],
): Promise<Listing[]> {
  if (rankedIds.length === 0) return [];
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .in("id", rankedIds)
    .eq("status", "active");
  if (error || !data) return [];
  const listings = (data as unknown as ListingRow[]).map(rowToListing);
  return orderByIdRank(listings, rankedIds);
}

// "Similar listings" for a listing's detail page: nearest listings of the same
// type by embedding cosine distance (RPC similar_listings, migration 0015).
// Public — works for anonymous visitors. Empty when the listing has no
// embedding or the migration/embeddings aren't in place yet.
export async function fetchSimilarListings(listingId: string, limit = 6): Promise<Listing[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("similar_listings", {
    p_listing_id: listingId,
    match_count: limit,
  });
  if (error || !Array.isArray(data)) return [];
  return fetchListingsRanked(supabase, (data as { id: string }[]).map((r) => r.id));
}

// "Recommended for you": content-based personal recommendations for the signed-in
// caller (RPC recommend_for_user, migration 0015). Returns [] on a cold start
// (no saved/viewed listings) or for anonymous callers — the caller decides
// whether to fall back. Pass `fallbackNewest` to backfill a cold start with the
// newest listings so the section is never empty for a logged-in user.
export async function fetchRecommendations(
  limit = 12,
  fallbackNewest = false,
  // Restrict recommendations to one listing type ("sale" on /buy, "rent" on
  // /rent); undefined recommends both types (the home page).
  type?: "sale" | "rent",
): Promise<Listing[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  // Only pass p_type when scoping to a type, so an untyped (home) call still
  // matches the 0015 single-argument signature if migration 0016 isn't applied
  // yet — the home recommendations keep working without breaking.
  const params = type ? { match_count: limit, p_type: type } : { match_count: limit };
  const { data, error } = await supabase.rpc("recommend_for_user", params);
  if (!error && Array.isArray(data) && data.length > 0) {
    const recs = await fetchListingsRanked(supabase, (data as { id: string }[]).map((r) => r.id));
    if (recs.length > 0) return recs;
  }
  if (!fallbackNewest) return [];
  // Cold start: newest listings (a single type when scoped, else sale + rent).
  if (type) return fetchNewestByType(type, limit);
  const [sale, rent] = await Promise.all([
    fetchNewestByType("sale", Math.ceil(limit / 2)),
    fetchNewestByType("rent", Math.floor(limit / 2)),
  ]);
  return [...sale, ...rent].slice(0, limit);
}
