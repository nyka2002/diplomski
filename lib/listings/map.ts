import type { Attributes, Listing, Seller, Spec } from "./types";

// Shape of a row coming back from the `listings` table.
export interface ListingRow {
  id: string;
  type: "sale" | "rent";
  title: string;
  title_hr: string;
  price_eur: number | string;
  price_display: string;
  city: string;
  area_m2: number | string;
  rooms: number | string;
  description: string;
  description_hr: string;
  images: string[] | null;
  specs: Spec[] | null;
  seller: Partial<Seller> | null;
  attributes: Partial<Attributes> | null;
  posted_at: string;
  source: string;
  source_url: string | null;
}

const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));

export function rowToListing(row: ListingRow): Listing {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    titleHr: row.title_hr,
    price: row.price_display,
    priceEur: num(row.price_eur),
    location: row.city,
    areaM2: num(row.area_m2),
    rooms: num(row.rooms),
    postedAt: row.posted_at,
    images: row.images ?? [],
    description: row.description,
    descriptionHr: row.description_hr,
    specs: row.specs ?? [],
    seller: {
      name: row.seller?.name ?? "",
      phone: row.seller?.phone ?? "",
      email: row.seller?.email ?? "",
      agency: row.seller?.agency ?? "",
    },
    attributes: {
      balcony: Boolean(row.attributes?.balcony),
      parking: Boolean(row.attributes?.parking),
      furnished: Boolean(row.attributes?.furnished),
      pets: Boolean(row.attributes?.pets),
    },
    source: row.source,
    originalUrl: row.source_url ?? "",
  };
}

// The columns we select everywhere (keep in sync with ListingRow).
export const LISTING_COLUMNS =
  "id, type, title, title_hr, price_eur, price_display, city, area_m2, rooms, description, description_hr, images, specs, seller, attributes, posted_at, source, source_url";
