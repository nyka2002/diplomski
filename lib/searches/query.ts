import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LISTING_COLUMNS, rowToListing, type ListingRow } from "@/lib/listings/map";
import { listingMatchesCriteria, type SavedSearchCriteria } from "./match";

export interface SavedSearch {
  id: string;
  name: string;
  criteria: SavedSearchCriteria;
  createdAt: string;
  // Count of active listings matching this search that first appeared after the
  // watermark (last_seen_at, or the search's created_at when never checked).
  newCount: number;
}

interface SavedSearchRow {
  id: string;
  name: string;
  criteria: SavedSearchCriteria | null;
  created_at: string;
  last_seen_at: string | null;
}

// How many candidate new listings to pull per search when counting matches.
// Only rows newer than the watermark are considered, so this is a safety cap on
// a normally small set, not the whole catalogue.
const NEW_CANDIDATES = 500;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function newMatchCount(supabase: any, row: SavedSearchRow): Promise<number> {
  const criteria = row.criteria;
  if (!criteria || typeof criteria !== "object") return 0;
  const since = row.last_seen_at ?? row.created_at;

  let q = supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("status", "active")
    .is("duplicate_of", null)
    .gt("created_at", since)
    .limit(NEW_CANDIDATES);
  if (criteria.type) q = q.eq("type", criteria.type);

  const { data, error } = await q;
  if (error || !data) return 0;
  return (data as unknown as ListingRow[])
    .map(rowToListing)
    .filter((l) => listingMatchesCriteria(l, criteria)).length;
}

// A user's saved searches, newest first, each annotated with how many newly
// arrived listings match it (the in-app "notification" signal).
export async function fetchSavedSearches(userId: string): Promise<SavedSearch[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, name, criteria, created_at, last_seen_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  const rows = data as SavedSearchRow[];
  const counts = await Promise.all(rows.map((r) => newMatchCount(supabase, r)));
  return rows.map((r, i) => ({
    id: r.id,
    name: r.name,
    criteria: (r.criteria ?? {}) as SavedSearchCriteria,
    createdAt: r.created_at,
    newCount: counts[i],
  }));
}

// Total new matches across all of a user's saved searches — the number shown on
// the header badge. Returns 0 quickly when the user has no saved searches.
export async function countNewSearchMatches(userId: string): Promise<number> {
  const searches = await fetchSavedSearches(userId);
  return searches.reduce((sum, s) => sum + s.newCount, 0);
}
