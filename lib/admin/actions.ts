"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isOpenAIConfigured, embedText } from "@/lib/ai/openai";
import { listingSchema, type ListingInput } from "@/lib/validation/listing";
import { fieldErrors } from "@/lib/validation/auth";
import type { ActionResult } from "@/lib/auth/actions";

const notConfigured: ActionResult = { ok: false, formError: "notConfigured" };
const notAdmin: ActionResult = { ok: false, formError: "notAuthorized" };

// Re-bust every surface a listing/user change can affect.
function revalidateListings() {
  revalidatePath("/admin");
  revalidatePath("/buy");
  revalidatePath("/rent");
  revalidatePath("/", "layout");
}

// The text we embed for semantic search — mirrors scripts/embed-listings.mjs so
// manually-added listings rank consistently with seeded ones.
function embeddingText(i: ListingInput): string {
  const flags = (["balcony", "parking", "furnished", "pets"] as const)
    .filter((k) => i[k])
    .join(", ");
  return [
    `${i.title} (${i.type === "sale" ? "for sale" : "for rent"})`,
    i.city,
    i.description,
    flags && `Features: ${flags}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function setUserActiveAction(userId: string, isActive: boolean): Promise<ActionResult> {
  if (!isSupabaseConfigured) return notConfigured;
  const admin = await getCurrentProfile();
  if (!admin || admin.role !== "admin") return notAdmin;
  // An admin must not lock themselves out.
  if (userId === admin.id) return { ok: false, formError: "cannotModifySelf" };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId);
  if (error) return { ok: false, formError: "unknown" };
  revalidatePath("/admin");
  return { ok: true };
}

export async function setUserRoleAction(
  userId: string,
  role: "user" | "admin",
): Promise<ActionResult> {
  if (!isSupabaseConfigured) return notConfigured;
  const admin = await getCurrentProfile();
  if (!admin || admin.role !== "admin") return notAdmin;
  // Don't let an admin demote themselves (avoids removing the last admin by
  // accident / self-lockout from the panel).
  if (userId === admin.id) return { ok: false, formError: "cannotModifySelf" };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { ok: false, formError: "unknown" };
  revalidatePath("/admin");
  return { ok: true };
}

// ── Listings ───────────────────────────────────────────────────────────────

// Insert (no id) or update (id present). Regenerates the embedding from the
// listing's text when OpenAI is configured so semantic search stays accurate.
export async function saveListingAction(raw: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return notConfigured;
  const admin = await getCurrentProfile();
  if (!admin || admin.role !== "admin") return notAdmin;

  const parsed = listingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const i = parsed.data;

  const supabase = await createClient();

  const row: Record<string, unknown> = {
    type: i.type,
    status: i.status,
    title: i.title,
    title_hr: i.titleHr,
    price_eur: i.priceEur,
    price_display: i.priceDisplay,
    city: i.city,
    area_m2: i.areaM2,
    rooms: i.rooms,
    description: i.description,
    description_hr: i.descriptionHr,
    images: i.images,
    attributes: {
      balcony: i.balcony,
      parking: i.parking,
      furnished: i.furnished,
      pets: i.pets,
    },
    seller: {
      name: i.sellerName ?? "",
      phone: i.sellerPhone ?? "",
      email: i.sellerEmail ?? "",
      agency: i.sellerAgency ?? "",
    },
    source_url: i.sourceUrl ? i.sourceUrl : null,
  };

  // Best-effort embedding (skipped silently if OpenAI isn't configured / fails).
  if (isOpenAIConfigured) {
    const vec = await embedText(embeddingText(i)).catch(() => null);
    if (vec) row.embedding = `[${vec.join(",")}]`;
  }

  if (i.id) {
    const { error } = await supabase.from("listings").update(row).eq("id", i.id);
    if (error) return { ok: false, formError: "unknown" };
  } else {
    row.id = `manual-${randomUUID()}`;
    row.source = "manual";
    const { error } = await supabase.from("listings").insert(row);
    if (error) return { ok: false, formError: "unknown" };
  }

  revalidateListings();
  return { ok: true };
}

export async function deleteListingAction(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured) return notConfigured;
  const admin = await getCurrentProfile();
  if (!admin || admin.role !== "admin") return notAdmin;

  const supabase = await createClient();
  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) return { ok: false, formError: "unknown" };
  revalidateListings();
  return { ok: true };
}
