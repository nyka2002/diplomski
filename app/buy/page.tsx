import BrowseView from "@/components/views/BrowseView";
import { fetchLocations } from "@/lib/listings/query";
import { fetchRecommendations } from "@/lib/listings/recommend";
import { getCurrentProfile } from "@/lib/auth/profile";

export default async function Page() {
  const profile = await getCurrentProfile();
  const [locations, recommended] = await Promise.all([
    fetchLocations("sale"),
    // Personalized sale recommendations as the first row (signed-in only; empty
    // and hidden for anonymous or cold-start visitors).
    profile ? fetchRecommendations(3, false, "sale") : Promise.resolve([]),
  ]);
  return <BrowseView type="sale" locations={locations} recommended={recommended} />;
}
