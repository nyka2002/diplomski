import HomeView from "@/components/views/HomeView";
import { fetchNewestByType } from "@/lib/listings/query";

export default async function Page() {
  const [saleListings, rentListings] = await Promise.all([
    fetchNewestByType("sale", 6),
    fetchNewestByType("rent", 6),
  ]);
  return <HomeView saleListings={saleListings} rentListings={rentListings} />;
}
