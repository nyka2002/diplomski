"use client";

import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { translations } from "@/lib/i18n/translations";
import type { Listing } from "@/lib/listings/types";
import ListingCard from "@/components/ListingCard";

export default function SavedView({ savedListings }: { savedListings: Listing[] }) {
  const { lang, savedIds } = useApp();
  const router = useRouter();
  const tr = translations[lang];

  // Server provides the saved rows; the context's savedIds lets an unsave on
  // this page drop the card immediately, without a round-trip.
  const saved = savedListings.filter((l) => savedIds.has(l.id));
  const savedSale = saved.filter((l) => l.type === "sale");
  const savedRent = saved.filter((l) => l.type === "rent");

  if (saved.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "linear-gradient(135deg, #F7D4DE, #EDE9F8)" }}
        >
          <Bookmark size={32} className="text-pink-400" />
        </div>
        <h2 className="text-2xl font-extrabold text-foreground mb-2">{tr.saved.empty}</h2>
        <p className="text-muted-foreground mb-10 max-w-sm">{tr.saved.emptyHint}</p>
        <div className="flex gap-4">
          <button
            onClick={() => router.push("/buy")}
            className="px-10 py-3.5 rounded-2xl font-bold text-white text-sm transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7B6FC4, #9B6FC4)" }}
          >
            {tr.saved.buy}
          </button>
          <button
            onClick={() => router.push("/rent")}
            className="px-10 py-3.5 rounded-2xl font-bold text-white text-sm transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #C084A0, #E891A0)" }}
          >
            {tr.saved.rent}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {savedSale.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-extrabold text-foreground mb-6">{tr.saved.saleSection}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {savedSale.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
      {savedRent.length > 0 && (
        <section>
          <h2 className="text-2xl font-extrabold text-foreground mb-6">{tr.saved.rentSection}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {savedRent.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
