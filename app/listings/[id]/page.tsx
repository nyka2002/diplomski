import { notFound } from "next/navigation";
import { fetchListingById } from "@/lib/listings/query";
import ListingDetailView from "@/components/views/ListingDetailView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await fetchListingById(id);
  if (!listing) notFound();
  return <ListingDetailView listing={listing} />;
}
