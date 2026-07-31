import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { fetchSavedListings, fetchListingById } from "@/lib/listings/query";
import type { Listing } from "@/lib/listings/types";
import CompareView from "@/components/views/CompareView";

// Protected route (see PROTECTED_PREFIXES): comparison is offered only to
// signed-in users.
//
// Two flows share this page:
//   • Free flow (from the nav): both sides are picked from the user's saved
//     listings, which requires at least two saved listings.
//   • Locked flow (?a=<id>&lock=1, from a listing's detail page): the left side
//     is fixed to that listing (which need not be saved) and only the right side
//     is chosen from the saved listings, so a single saved listing suffices.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string; lock?: string }>;
}) {
  // Middleware already gates this route; this also covers the unconfigured case.
  const profile = await getCurrentProfile();
  if (!profile) redirect("/sign-in");

  const { a, b, lock } = await searchParams;
  const saved = await fetchSavedListings(profile.id);
  const savedById = new Map(saved.map((l) => [l.id, l]));

  const toItem = (l: Listing) => ({
    id: l.id,
    title: l.title,
    titleHr: l.titleHr,
    type: l.type,
    price: l.price,
  });

  const wantLock = lock === "1" && Boolean(a);
  // In the locked flow the left listing is fetched directly (it may not be
  // saved) and is excluded from the right-hand options so it can't be compared
  // with itself. In the free flow both sides resolve from the saved set only.
  const aListing: Listing | null = wantLock
    ? a
      ? await fetchListingById(a)
      : null
    : a
      ? (savedById.get(a) ?? null)
      : null;
  const bListing: Listing | null = b ? (savedById.get(b) ?? null) : null;
  const locked = wantLock && Boolean(aListing);
  const index = (locked ? saved.filter((l) => l.id !== a) : saved).map(toItem);

  return (
    <CompareView
      aListing={aListing}
      bListing={bListing}
      index={index}
      locked={locked}
      savedCount={saved.length}
    />
  );
}
