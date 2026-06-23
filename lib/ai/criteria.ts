import { AMENITY_KEYS, type Amenity, type ListingFilters, type LocationGroup } from "@/lib/listings/types";
import type { Lang } from "@/lib/i18n/translations";

// What the LLM extracts from the conversation. Optionals are nullable (OpenAI
// strict structured output requires every property to be present + required).
export interface AiCriteria {
  city: string | null;
  neighborhoods: string[];
  priceMin: number | null;
  priceMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
  roomsMin: number | null;
  roomsMax: number | null;
  mustHave: Amenity[]; // required amenities (hard)
  forbidden: Amenity[]; // amenities that must be absent (hard)
  niceToHave: Amenity[]; // preferred amenities (soft — rank first + flag misses)
  relevanceQuery: string | null; // free-text desires for semantic ranking
  reply: string; // a short confirmation in the user's language
}

// JSON Schema handed to OpenAI structured output (strict mode).
export const CRITERIA_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "city",
    "neighborhoods",
    "priceMin",
    "priceMax",
    "areaMin",
    "areaMax",
    "roomsMin",
    "roomsMax",
    "mustHave",
    "forbidden",
    "niceToHave",
    "relevanceQuery",
    "reply",
  ],
  properties: {
    city: { type: ["string", "null"], description: "City name, exactly as offered, or null." },
    neighborhoods: { type: "array", items: { type: "string" } },
    priceMin: { type: ["number", "null"] },
    priceMax: { type: ["number", "null"] },
    areaMin: { type: ["number", "null"] },
    areaMax: { type: ["number", "null"] },
    roomsMin: { type: ["number", "null"], description: "Minimum bedrooms (0 = studio)." },
    roomsMax: { type: ["number", "null"] },
    mustHave: { type: "array", items: { type: "string", enum: [...AMENITY_KEYS] } },
    forbidden: { type: "array", items: { type: "string", enum: [...AMENITY_KEYS] } },
    niceToHave: { type: "array", items: { type: "string", enum: [...AMENITY_KEYS] } },
    relevanceQuery: { type: ["string", "null"] },
    reply: { type: "string" },
  },
} as const;

export function buildSystemPrompt(locations: LocationGroup[], lang: Lang): string {
  const cities = locations.map((l) => l.city).join(", ") || "(none)";
  const neighborhoods = locations
    .filter((l) => l.neighborhoods.length)
    .map((l) => `${l.city}: ${l.neighborhoods.join(", ")}`)
    .join("; ");
  const language = lang === "hr" ? "Croatian" : "English";

  return [
    "You convert a person's natural-language apartment search into a structured filter object.",
    "Always reason over the WHOLE conversation and output the COMPLETE current criteria (so the user can add, change, or remove constraints across turns).",
    "",
    "Available cities: " + cities + ".",
    neighborhoods ? "Neighborhoods by city: " + neighborhoods + "." : "",
    "Only use a city/neighborhood from those lists; otherwise leave city null and put the location wish in relevanceQuery.",
    "",
    "Amenities are exactly: balcony, parking, furnished, pets (pets = pets allowed).",
    "- mustHave: amenities the user requires (hard filter).",
    "- forbidden: amenities the user explicitly does NOT want (hard filter).",
    "- niceToHave: amenities that are merely preferred (soft — do not exclude listings without them).",
    "An amenity must appear in at most one of those lists.",
    "",
    "Numbers: prices are euros (sale = total price, rent = monthly). Rooms are bedroom counts; 'studio' = 0, 'one-bed' = 1, etc. Use roomsMin/roomsMax for ranges ('2 to 3 rooms' → min 2, max 3; 'exactly 2' → min 2, max 2; '2+' → min 2).",
    "Put fuzzy or descriptive desires that are not concrete filters (e.g. 'near a park', 'quiet', 'renovated', 'great view', 'close to tram') into relevanceQuery for semantic ranking — never invent filters for them.",
    "If the user clears or resets, return empty arrays and null scalars.",
    "",
    `Write "reply" as one short, friendly confirmation sentence in ${language}, summarizing what you applied.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Map extracted criteria onto the shared listing filter state (what drives the
// grid + chips). mustHave amenities become the same boolean filters the manual
// checkboxes use; forbidden / niceToHave / relevance live in the AI overlay.
export function criteriaToFilters(c: AiCriteria): ListingFilters {
  const f: ListingFilters = {};
  if (c.city) f.city = c.city;
  if (c.neighborhoods.length) f.neighborhoods = c.neighborhoods;
  if (c.priceMin != null) f.priceMin = c.priceMin;
  if (c.priceMax != null) f.priceMax = c.priceMax;
  if (c.areaMin != null) f.areaMin = c.areaMin;
  if (c.areaMax != null) f.areaMax = c.areaMax;
  if (c.roomsMin != null) f.roomsMin = c.roomsMin;
  if (c.roomsMax != null) f.roomsMax = c.roomsMax;
  for (const a of c.mustHave) f[a] = true;
  if (c.forbidden.length) f.forbidden = c.forbidden;
  if (c.niceToHave.length) f.niceToHave = c.niceToHave;
  if (c.relevanceQuery) f.relevance = c.relevanceQuery;
  return f;
}
