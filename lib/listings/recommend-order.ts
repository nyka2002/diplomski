import type { Listing } from "./types";

// The recommendation RPCs return listing ids already ranked by similarity, but a
// follow-up `in (ids)` fetch of the full rows comes back in arbitrary order.
// Re-impose the ranked order and drop anything the fetch didn't return (e.g. a
// row that became inactive between the two queries). Pure + synchronous so it
// can be unit-tested without a database.
export function orderByIdRank(listings: Listing[], rankedIds: string[]): Listing[] {
  const byId = new Map(listings.map((l) => [l.id, l]));
  const ordered: Listing[] = [];
  for (const id of rankedIds) {
    const l = byId.get(id);
    if (l) ordered.push(l);
  }
  return ordered;
}
