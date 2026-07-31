import type { AiCriteria } from "@/lib/ai/criteria";

// The structured part of an AI search, without the assistant's free-text
// `reply`. Stored as the `search_history.criteria` snapshot (0009) and later
// used for recommendations and behavioural analysis. Kept pure (no server /
// Supabase imports) so it can be unit-tested directly.
export type SearchCriteriaSnapshot = Omit<AiCriteria, "reply">;

export function serializeSearchCriteria(c: AiCriteria): SearchCriteriaSnapshot {
  return {
    city: c.city ?? null,
    neighborhoods: Array.isArray(c.neighborhoods) ? c.neighborhoods : [],
    priceMin: c.priceMin ?? null,
    priceMax: c.priceMax ?? null,
    areaMin: c.areaMin ?? null,
    areaMax: c.areaMax ?? null,
    roomsMin: c.roomsMin ?? null,
    roomsMax: c.roomsMax ?? null,
    mustHave: Array.isArray(c.mustHave) ? c.mustHave : [],
    forbidden: Array.isArray(c.forbidden) ? c.forbidden : [],
    niceToHave: Array.isArray(c.niceToHave) ? c.niceToHave : [],
    relevanceQuery: c.relevanceQuery ?? null,
    textExclude: Array.isArray(c.textExclude) ? c.textExclude : [],
  };
}
