"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Lang } from "@/lib/i18n/translations";
import type { Profile } from "@/lib/auth/profile";
import type { ListingFilters, SortOption } from "@/lib/listings/types";
import { signOutAction } from "@/lib/auth/actions";
import { toggleSavedAction } from "@/lib/listings/saved-actions";
import SignOutModal from "@/components/SignOutModal";

// Browse filter/sort state kept in memory so it survives navigating into a
// listing and back (the browse view unmounts, but the provider does not).
export interface BrowseSnapshot {
  filters: ListingFilters;
  sort: SortOption;
}

interface AppState {
  lang: Lang;
  toggleLang: () => void;
  dark: boolean;
  toggleDark: () => void;
  profile: Profile | null;
  isLoggedIn: boolean;
  requestSignOut: () => void;
  savedIds: Set<string>;
  toggleSaved: (id: string) => void;
  openListing: (id: string) => void;
  listingOrigin: string;
  getBrowseSnapshot: (key: string) => BrowseSnapshot | undefined;
  setBrowseSnapshot: (key: string, snapshot: BrowseSnapshot) => void;
  // One-shot scroll position (keyed by the path we left) for restoring the
  // browse page exactly where the user was when they opened a listing.
  consumeScroll: (key: string) => number | undefined;
}

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used within <AppProvider>");
  return value;
}

// `profile` and `initialSavedIds` are resolved on the server (layout) and passed
// in fresh on every RSC render, so auth + wishlist state always reflect the real
// session — no client guessing.
export function AppProvider({
  children,
  profile,
  initialSavedIds = [],
}: {
  children: ReactNode;
  profile: Profile | null;
  initialSavedIds?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoggedIn = profile !== null;

  const [lang, setLang] = useState<Lang>("en");
  const [dark, setDark] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(initialSavedIds));
  const [listingOrigin, setListingOrigin] = useState("");
  const [showSignOut, setShowSignOut] = useState(false);
  const browseSnapshots = useRef<Record<string, BrowseSnapshot>>({});
  const scrollPositions = useRef<Record<string, number>>({});

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Re-sync the wishlist from the server whenever it changes (login/logout, or
  // a save persisted on another tab). The DB is the source of truth.
  const savedKey = initialSavedIds.join(",");
  useEffect(() => {
    setSavedIds(new Set(savedKey ? savedKey.split(",") : []));
  }, [savedKey]);

  const toggleLang = () => setLang((l) => (l === "en" ? "hr" : "en"));
  const toggleDark = () => setDark((d) => !d);

  const requestSignOut = () => setShowSignOut(true);

  const confirmSignOut = async () => {
    setShowSignOut(false);
    await signOutAction();
    router.push("/");
    router.refresh();
  };

  const toggleSaved = async (id: string) => {
    if (!isLoggedIn) {
      router.push("/sign-in");
      return;
    }
    // Optimistic toggle, then persist to saved_listings. Revert on failure.
    const wasSaved = savedIds.has(id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(id);
      else next.add(id);
      return next;
    });
    const res = await toggleSavedAction(id);
    if (!res.ok) {
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(id);
        else next.delete(id);
        return next;
      });
    }
  };

  const openListing = (id: string) => {
    // Remember where we came from; the browse view's filters are preserved
    // separately via the browse-snapshot store, so returning restores them.
    const here = pathname || "";
    if (typeof window !== "undefined") scrollPositions.current[here] = window.scrollY;
    setListingOrigin(here);
    router.push(`/listings/${id}`);
  };

  const getBrowseSnapshot = (key: string) => browseSnapshots.current[key];
  const setBrowseSnapshot = (key: string, snapshot: BrowseSnapshot) => {
    browseSnapshots.current[key] = snapshot;
  };
  const consumeScroll = (key: string) => {
    const y = scrollPositions.current[key];
    delete scrollPositions.current[key];
    return y;
  };

  return (
    <AppContext.Provider
      value={{
        lang,
        toggleLang,
        dark,
        toggleDark,
        profile,
        isLoggedIn,
        requestSignOut,
        savedIds,
        toggleSaved,
        openListing,
        listingOrigin,
        getBrowseSnapshot,
        setBrowseSnapshot,
        consumeScroll,
      }}
    >
      {children}
      <SignOutModal
        open={showSignOut}
        lang={lang}
        onConfirm={confirmSignOut}
        onCancel={() => setShowSignOut(false)}
      />
    </AppContext.Provider>
  );
}
