import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { fetchSavedSearches } from "@/lib/searches/query";
import SavedSearchesView from "@/components/views/SavedSearchesView";

export default async function Page() {
  // Middleware already gates this route; this also covers the unconfigured case.
  const profile = await getCurrentProfile();
  if (!profile) redirect("/sign-in");
  const searches = await fetchSavedSearches(profile.id);
  return <SavedSearchesView searches={searches} />;
}
