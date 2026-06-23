// The mock array was removed in Phase 2 — listings now live in Postgres
// (see db/seed/0001_listings.sql and lib/listings/). This file re-exports the
// canonical type for backwards-compatible imports.
export type {
  Listing,
  Spec,
  Seller,
  Attributes,
  SortOption,
  ListingFilters,
} from "@/lib/listings/types";
