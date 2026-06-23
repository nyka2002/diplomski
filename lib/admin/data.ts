import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentProfile, type Profile } from "@/lib/auth/profile";
import { LISTING_COLUMNS, rowToListing, type ListingRow } from "@/lib/listings/map";
import type { Listing } from "@/lib/listings/types";

// Returns the current profile only if it is an active admin, else null. Admin
// pages and actions call this as their authorization gate (RLS is the second
// line of defence at the data layer).
export async function requireAdmin(): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  return profile && profile.role === "admin" ? profile : null;
}

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  role: "user" | "admin";
  isActive: boolean;
  createdAt: string;
}

// All users, newest first. Admin SELECT on profiles is allowed by RLS.
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, username, email, phone, role, is_active, created_at")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    firstName: r.first_name ?? "",
    lastName: r.last_name ?? "",
    username: r.username ?? "",
    email: r.email ?? "",
    phone: r.phone ?? "",
    role: r.role,
    isActive: r.is_active,
    createdAt: r.created_at,
  }));
}

// A listing plus its lifecycle status (admins see every status, not just
// active). The browse-facing Listing type omits status by design.
export type AdminListing = Listing & { status: "active" | "inactive" | "removed" };

// All listings regardless of status, newest first. RLS grants admins read on
// every status.
export async function fetchAdminListings(): Promise<AdminListing[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(`${LISTING_COLUMNS}, status`)
    .order("posted_at", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as (ListingRow & { status: AdminListing["status"] })[]).map((row) => ({
    ...rowToListing(row),
    status: row.status,
  }));
}
