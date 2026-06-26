// Canonical UI-facing listing shape. Produced by mapping a DB row (see map.ts).
export interface Spec {
  label: string;
  labelHr: string;
  value: string;
  valueHr?: string;
}

export interface Seller {
  name: string;
  phone: string;
  email: string;
  agency: string;
}

export const AMENITY_KEYS = ["balcony", "parking", "furnished", "pets"] as const;
export type Amenity = (typeof AMENITY_KEYS)[number];

export interface Attributes {
  balcony: boolean;
  parking: boolean;
  furnished: boolean;
  pets: boolean;
}

export interface Listing {
  id: string;
  type: "sale" | "rent";
  title: string;
  titleHr: string;
  price: string; // display string, e.g. "€185,000" / "€650/mo"
  priceEur: number; // numeric, for sorting/filtering
  location: string; // city, e.g. "Zagreb, Centar"
  areaM2: number;
  rooms: number;
  postedAt: string; // ISO timestamp
  images: string[];
  description: string;
  descriptionHr: string;
  specs: Spec[];
  seller: Seller;
  attributes: Attributes;
  source: string;
  originalUrl: string;
  // Nice-to-have amenities this listing does NOT satisfy (set during AI search
  // so the card can flag them, e.g. "no balcony"). Empty/undefined otherwise.
  unmetNice?: Amenity[];
}

export const SORT_OPTIONS = [
  "dateNew",
  "dateOld",
  "priceLow",
  "priceHigh",
  "areaHigh",
  "areaLow",
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
export const DEFAULT_SORT: SortOption = "dateNew";

// A hard textual exclusion produced by the AI agent for a constraint the
// structured columns/amenities don't capture (most often floor level). A
// listing is dropped if any of `terms` appears in its title or description
// (both languages). The chip text is stored in BOTH languages (`labelHr` /
// `labelEn`) so it re-renders in the page's current language on a language
// switch, like every other filter chip.
export interface TextFilter {
  labelHr: string;
  labelEn: string;
  terms: string[];
}

export interface ListingFilters {
  county?: string; // single county, e.g. "Grad Zagreb" (top of the location cascade)
  city?: string; // single city, e.g. "Zagreb"
  neighborhoods?: string[]; // multi-select within the city (OR'd together)
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  roomsMin?: number;
  roomsMax?: number;
  // Amenities required to be present (hard filter). Mirrored by the manual
  // checkboxes; the AI agent's "must have" also writes here.
  balcony?: boolean;
  parking?: boolean;
  furnished?: boolean;
  pets?: boolean;
  // AI overlay (no manual control): amenities that must be ABSENT (hard),
  // amenities that are preferred (soft — rank first + flag misses), and a
  // free-text relevance query used for semantic (embedding) ranking.
  forbidden?: Amenity[];
  niceToHave?: Amenity[];
  relevance?: string;
  // Hard textual exclusions (e.g. floor level) checked against the listing's
  // title/description in both languages. Each entry is a separate constraint.
  textExclude?: TextFilter[];
}

// A city and the neighborhoods that appear under it (derived from listing
// locations stored as "City, Neighborhood"), plus the county it sits in (the
// top of the location cascade; "" when unknown).
export interface LocationGroup {
  county: string;
  city: string;
  neighborhoods: string[];
}

export interface ListingQuery extends ListingFilters {
  type?: "sale" | "rent";
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface ListingPage {
  listings: Listing[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
