import HomeView from "@/components/views/HomeView";
import { fetchNewestByType } from "@/lib/listings/query";
import { fetchRecommendations } from "@/lib/listings/recommend";
import { getCurrentProfile } from "@/lib/auth/profile";

export default async function Page() {
  const profile = await getCurrentProfile();
  const [saleListings, rentListings, recommended] = await Promise.all([
    fetchNewestByType("sale", 6),
    fetchNewestByType("rent", 6),
    // Personal recommendations only for signed-in users; anonymous or cold-start
    // (no saves/views) returns [] and the section is hidden (no fallback here,
    // to avoid duplicating the newest-listings sections below).
    profile ? fetchRecommendations(6, false) : Promise.resolve([]),
  ]);
  return (
    <HomeView saleListings={saleListings} rentListings={rentListings} recommended={recommended} />
  );
}
