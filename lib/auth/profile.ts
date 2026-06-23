import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  role: "user" | "admin";
  isActive: boolean;
}

// Reads the current user's profile on the server. Returns null when there is no
// session (or Supabase isn't configured), so callers can simply treat null as
// "logged out". A deactivated account (is_active=false) is signed out on sight.
export async function getCurrentProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, username, email, phone, role, is_active")
    .eq("id", user.id)
    .single();

  if (!data) return null;

  if (!data.is_active) {
    await supabase.auth.signOut();
    return null;
  }

  return {
    id: data.id,
    firstName: data.first_name ?? "",
    lastName: data.last_name ?? "",
    username: data.username ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    role: data.role,
    isActive: data.is_active,
  };
}
