"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface SaveResult {
  ok: boolean;
  saved?: boolean; // the new state for this listing
  error?: string;
}

// Toggles a listing in the signed-in user's wishlist. RLS guarantees a user can
// only touch their own rows. Returns the resulting saved/not-saved state.
export async function toggleSavedAction(listingId: string): Promise<SaveResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "notConfigured" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "notAuthenticated" };

  const { data: existing } = await supabase
    .from("saved_listings")
    .select("listing_id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("saved_listings")
      .delete()
      .eq("user_id", user.id)
      .eq("listing_id", listingId);
    if (error) return { ok: false, error: "unknown" };
    revalidatePath("/saved");
    return { ok: true, saved: false };
  }

  const { error } = await supabase
    .from("saved_listings")
    .insert({ user_id: user.id, listing_id: listingId });
  if (error) return { ok: false, error: "unknown" };
  revalidatePath("/saved");
  return { ok: true, saved: true };
}
