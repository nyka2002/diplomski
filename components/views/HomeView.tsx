"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { translations } from "@/lib/i18n/translations";
import type { Listing } from "@/lib/listings/types";
import ListingCard from "@/components/ListingCard";

export default function HomeView({
  saleListings,
  rentListings,
}: {
  saleListings: Listing[];
  rentListings: Listing[];
}) {
  const { lang, consumeScroll } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const tr = translations[lang];
  const didRestoreScroll = useRef(false);

  // Restore the exact home scroll position captured when a listing was opened
  // (same behavior as the browse pages). We come back via router.push(
  // scroll:false), so re-apply the target across animation frames until it
  // sticks. Runs once per mount; no captured position → leave the top alone.
  useEffect(() => {
    if (didRestoreScroll.current) return;
    didRestoreScroll.current = true;
    const y = consumeScroll(pathname);
    if (!y) return;
    let frames = 0;
    const tick = () => {
      window.scrollTo(0, y);
      frames += 1;
      if (Math.abs(window.scrollY - y) > 2 && frames < 40) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Hero */}
      <div
        className="mb-14 relative overflow-hidden rounded-3xl p-10 sm:p-16 text-center"
        style={{ background: "linear-gradient(135deg, #EDE9F8 0%, #F7D4DE 50%, #D4E4F8 100%)" }}
      >
        <div
          className="dark:hidden absolute inset-0 rounded-3xl"
          style={{ background: "linear-gradient(135deg, #EDE9F8 0%, #F7D4DE 50%, #D4E4F8 100%)" }}
        />
        <div
          className="hidden dark:block absolute inset-0 rounded-3xl"
          style={{ background: "linear-gradient(135deg, #1E1A35 0%, #2A1A28 50%, #1A1E2E 100%)" }}
        />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 dark:bg-white/10 text-purple-700 dark:text-purple-300 text-xs font-semibold mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            {lang === "en" ? "real estate in croatia" : "nekretnine u hrvatskoj"}
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground mb-4 tracking-tight leading-tight">
            {tr.hero.title}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            {tr.hero.subtitle}
          </p>
          <div className="flex gap-3 justify-center mt-8">
            <button
              onClick={() => router.push("/buy")}
              className="px-7 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #7B6FC4 0%, #9B6FC4 100%)" }}
            >
              {lang === "en" ? "browse to buy" : "pregledaj kupnju"}
            </button>
            <button
              onClick={() => router.push("/rent")}
              className="px-7 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #C084A0 0%, #E891A0 100%)" }}
            >
              {lang === "en" ? "browse to rent" : "pregledaj najam"}
            </button>
          </div>
        </div>
      </div>

      {/* For Sale */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold text-foreground">{tr.forSale}</h2>
          <button
            onClick={() => router.push("/buy")}
            className="text-sm font-semibold hover:underline"
            style={{ color: "var(--primary)" }}
          >
            {tr.viewAll}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {saleListings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </section>

      {/* For Rent */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-extrabold text-foreground">{tr.forRent}</h2>
          <button
            onClick={() => router.push("/rent")}
            className="text-sm font-semibold hover:underline"
            style={{ color: "var(--primary)" }}
          >
            {tr.viewAll}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {rentListings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </section>
    </div>
  );
}
