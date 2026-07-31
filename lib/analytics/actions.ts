"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AiCriteria } from "@/lib/ai/criteria";
import { serializeSearchCriteria } from "./criteria-snapshot";

// Best-effort usage logging. These NEVER throw and NEVER block the caller —
// analytics must not be able to break a page render or an API response. RLS
// (0009_usage.sql) restricts every row to its owner; anonymous visitors are
// allowed and their rows carry user_id = null.

// Records a listing detail view. Called on navigation from the client detail
// view. Silent no-op when Supabase isn't configured or anything goes wrong.
export async function recordListingViewAction(listingId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (typeof listingId !== "string" || listingId.length === 0) return;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("listing_views")
      .insert({ user_id: user?.id ?? null, listing_id: listingId });
  } catch {
    // non-critical — swallow
  }
}

// Records an intentional search as a criteria snapshot (the assistant's reply
// is stripped out). Used by the AI route; reusable by future filter searches.
export async function recordSearchAction(criteria: AiCriteria): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (!criteria || typeof criteria !== "object") return;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("search_history")
      .insert({ user_id: user?.id ?? null, criteria: serializeSearchCriteria(criteria) });
  } catch {
    // non-critical — swallow
  }
}
