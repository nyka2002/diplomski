import { notFound } from "next/navigation";
import { fetchListingById } from "@/lib/listings/query";
import { fetchSimilarListings } from "@/lib/listings/recommend";
import ListingDetailView from "@/components/views/ListingDetailView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [listing, similar] = await Promise.all([
    fetchListingById(id),
    fetchSimilarListings(id, 6),
  ]);
  if (!listing) notFound();
  return <ListingDetailView listing={listing} similar={similar} />;
}
