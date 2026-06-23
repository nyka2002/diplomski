import BrowseView from "@/components/views/BrowseView";
import { fetchLocations } from "@/lib/listings/query";

export default async function Page() {
  const locations = await fetchLocations("sale");
  return <BrowseView type="sale" locations={locations} />;
}
