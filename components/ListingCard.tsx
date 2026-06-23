"use client";

import { useApp } from "@/lib/app-context";
import { translations } from "@/lib/i18n/translations";
import type { Listing } from "@/lib/data/listings";
import HeartButton from "@/components/HeartButton";

export default function ListingCard({ listing }: { listing: Listing }) {
  const { lang, savedIds, toggleSaved, openListing } = useApp();
  const tr = translations[lang];
  const saved = savedIds.has(listing.id);
  const title = lang === "en" ? listing.title : listing.titleHr;

  return (
    <div
      className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group"
      onClick={() => openListing(listing.id)}
    >
      <div className="relative aspect-[4/3] bg-purple-50 dark:bg-purple-900/20 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={listing.images[0]}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute bottom-2.5 right-2.5">
          <HeartButton
            saved={saved}
            onToggle={(e) => {
              e.stopPropagation();
              toggleSaved(listing.id);
            }}
          />
        </div>
        <div className="absolute top-2.5 left-2.5">
          <span
            className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
              listing.type === "sale"
                ? "bg-purple-100/90 text-purple-700 dark:bg-purple-900/70 dark:text-purple-300"
                : "bg-pink-100/90 text-pink-700 dark:bg-pink-900/70 dark:text-pink-300"
            }`}
          >
            {listing.type === "sale"
              ? lang === "en"
                ? "for sale"
                : "prodaja"
              : lang === "en"
                ? "for rent"
                : "najam"}
          </span>
        </div>
      </div>
      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{listing.location}</p>
        <h3 className="font-bold text-foreground text-sm leading-snug mb-2 line-clamp-2">
          {title}
        </h3>
        <p className="font-extrabold text-base" style={{ color: "var(--primary)" }}>
          {listing.price}
        </p>
        {/* AI nice-to-have misses — this listing was kept but flagged. */}
        {listing.unmetNice && listing.unmetNice.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {listing.unmetNice.map((a) => (
              <span
                key={a}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100/80 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              >
                {tr.filters.without} {tr.filters[a].toLowerCase()}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
