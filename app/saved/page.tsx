import { redirect } from "next/navigation";
import SavedView from "@/components/views/SavedView";
import { getCurrentProfile } from "@/lib/auth/profile";
import { fetchSavedListings } from "@/lib/listings/query";

export default async function Page() {
  // Middleware already gates this route; this also covers the unconfigured case.
  const profile = await getCurrentProfile();
  if (!profile) redirect("/sign-in");
  const savedListings = await fetchSavedListings(profile.id);
  return <SavedView savedListings={savedListings} />;
}
