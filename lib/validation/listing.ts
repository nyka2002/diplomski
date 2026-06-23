import { z } from "zod";

// Admin listing add/edit schema. Like the auth schemas, error messages are
// stable KEYS resolved against translations[lang].validation. The form holds
// numeric fields as strings, so they're preprocessed to numbers here.

const reqStr = z.string().trim().min(1, "required");

const requiredNumber = (key: string) =>
  z.preprocess((v) => {
    if (typeof v === "string") {
      const t = v.trim();
      if (t === "") return undefined;
      const n = Number(t);
      return Number.isNaN(n) ? undefined : n;
    }
    return v;
  }, z.number({ required_error: key, invalid_type_error: key }));

const optionalUrl = z
  .string()
  .trim()
  .url("urlInvalid")
  .optional()
  .or(z.literal(""));

export const listingSchema = z.object({
  id: z.string().trim().optional(), // present when editing
  type: z.enum(["sale", "rent"]),
  status: z.enum(["active", "inactive", "removed"]),
  title: reqStr,
  titleHr: reqStr,
  priceEur: requiredNumber("numberInvalid").refine((n) => n > 0, "numberPositive"),
  priceDisplay: reqStr,
  city: reqStr, // "City" or "City, Neighborhood"
  areaM2: requiredNumber("numberInvalid").refine((n) => n >= 0, "numberInvalid"),
  rooms: requiredNumber("numberInvalid").refine((n) => n >= 0, "numberInvalid"),
  description: reqStr,
  descriptionHr: reqStr,
  // Free-text list of image URLs (one per line or comma-separated) → string[].
  images: z.array(z.string().trim().url("urlInvalid")).default([]),
  balcony: z.boolean().default(false),
  parking: z.boolean().default(false),
  furnished: z.boolean().default(false),
  pets: z.boolean().default(false),
  sellerName: z.string().trim().optional().or(z.literal("")),
  sellerPhone: z.string().trim().optional().or(z.literal("")),
  sellerEmail: z.string().trim().email("emailInvalid").optional().or(z.literal("")),
  sellerAgency: z.string().trim().optional().or(z.literal("")),
  sourceUrl: optionalUrl,
});

export type ListingInput = z.infer<typeof listingSchema>;
