"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AMENITY_KEYS, type Amenity } from "@/lib/listings/types";
import type { SavedSearchCriteria } from "./match";

const isAmenity = (v: unknown): v is Amenity =>
  typeof v === "string" && (AMENITY_KEYS as readonly string[]).includes(v);

export interface SearchActionResult {
  ok: boolean;
  error?: string;
}

// Keep only the fields we recognize (a ListingQuery shape) so we never persist
// arbitrary client input into the criteria jsonb. Pagination is dropped.
function sanitizeCriteria(input: unknown): SavedSearchCriteria {
  const c = (input ?? {}) as Record<string, unknown>;
  const out: SavedSearchCriteria = {};
  if (c.type === "sale" || c.type === "rent") out.type = c.type;
  if (typeof c.sort === "string") out.sort = c.sort as SavedSearchCriteria["sort"];
  if (typeof c.county === "string") out.county = c.county;
  if (typeof c.city === "string") out.city = c.city;
  if (Array.isArray(c.neighborhoods))
    out.neighborhoods = c.neighborhoods.filter((n): n is string => typeof n === "string");
  for (const k of ["priceMin", "priceMax", "areaMin", "areaMax", "roomsMin", "roomsMax"] as const) {
    if (typeof c[k] === "number" && Number.isFinite(c[k])) out[k] = c[k] as number;
  }
  for (const k of ["balcony", "parking", "furnished", "pets"] as const) {
    if (c[k] === true) out[k] = true;
  }
  if (Array.isArray(c.forbidden)) out.forbidden = c.forbidden.filter(isAmenity);
  if (Array.isArray(c.niceToHave)) out.niceToHave = c.niceToHave.filter(isAmenity);
  if (typeof c.relevance === "string") out.relevance = c.relevance;
  if (Array.isArray(c.textExclude)) {
    out.textExclude = c.textExclude
      .map((t) => {
        const o = (t ?? {}) as Record<string, unknown>;
        const terms = Array.isArray(o.terms) ? o.terms.filter((x): x is string => typeof x === "string") : [];
        const labelHr = typeof o.labelHr === "string" ? o.labelHr : "";
        const labelEn = typeof o.labelEn === "string" ? o.labelEn : "";
        return (labelHr || labelEn) && terms.length ? { labelHr, labelEn, terms } : null;
      })
      .filter((x): x is { labelHr: string; labelEn: string; terms: string[] } => Boolean(x));
  }
  return out;
}

// Save the current search (browse filters + type) under a name. RLS ties the row
// to the caller. Never throws — returns {ok:false,...} on any problem.
export async function saveSearchAction(
  name: string,
  criteria: unknown,
): Promise<SearchActionResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "notConfigured" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  const cleanName = String(name ?? "").trim().slice(0, 80) || "Saved search";
  const { error } = await supabase
    .from("saved_searches")
    .insert({ user_id: user.id, name: cleanName, criteria: sanitizeCriteria(criteria) });
  if (error) return { ok: false, error: "unknown" };
  revalidatePath("/saved-searches");
  return { ok: true };
}

export async function deleteSearchAction(id: string): Promise<SearchActionResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "notConfigured" };
  if (typeof id !== "string" || !id) return { ok: false, error: "badRequest" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  const { error } = await supabase.from("saved_searches").delete().eq("user_id", user.id).eq("id", id);
  if (error) return { ok: false, error: "unknown" };
  revalidatePath("/saved-searches");
  return { ok: true };
}

// Mark all of the caller's saved searches as seen (advance the watermark), which
// clears the "new" badge. Called when the saved-searches page is opened.
export async function markSearchesSeenAction(): Promise<SearchActionResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "notConfigured" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  const { error } = await supabase
    .from("saved_searches")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "unknown" };
  return { ok: true };
}
