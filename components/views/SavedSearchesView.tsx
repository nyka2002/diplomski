"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, Trash2, ArrowRight } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { translations } from "@/lib/i18n/translations";
import { DEFAULT_SORT, type Amenity } from "@/lib/listings/types";
import type { SavedSearch } from "@/lib/searches/query";
import { deleteSearchAction, markSearchesSeenAction } from "@/lib/searches/actions";

export default function SavedSearchesView({ searches }: { searches: SavedSearch[] }) {
  const { lang, setBrowseSnapshot, clearSearchNotifications } = useApp();
  const tr = translations[lang];
  const router = useRouter();
  const [list, setList] = useState(searches);

  // Opening this page counts as "checking" every saved search: advance the
  // server watermark and clear the header badge. The per-search counts already
  // rendered stay visible (they came from the initial server render). Runs once.
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    void markSearchesSeenAction();
    clearSearchNotifications();
  }, [clearSearchNotifications]);

  const typeLabel = (t?: "sale" | "rent") =>
    t === "rent" ? (lang === "en" ? "for rent" : "najam") : lang === "en" ? "for sale" : "prodaja";

  // Short chips summarizing a search's criteria.
  const summarize = (s: SavedSearch): string[] => {
    const c = s.criteria;
    const chips: string[] = [typeLabel(c.type)];
    if (c.city) chips.push(c.neighborhoods?.length ? `${c.city} (${c.neighborhoods.join(", ")})` : c.city);
    if (c.priceMin != null || c.priceMax != null)
      chips.push(`${tr.listing.price}: ${c.priceMin ?? "0"}–${c.priceMax ?? "∞"} €`);
    if (c.areaMin != null || c.areaMax != null)
      chips.push(`${tr.filters.area}: ${c.areaMin ?? "0"}–${c.areaMax ?? "∞"} m²`);
    if (c.roomsMin != null || c.roomsMax != null)
      chips.push(`${tr.filters.rooms}: ${c.roomsMin ?? "0"}–${c.roomsMax ?? "∞"}`);
    for (const a of ["balcony", "parking", "furnished", "pets"] as Amenity[])
      if (c[a]) chips.push(tr.filters[a]);
    for (const a of c.forbidden ?? []) chips.push(`${tr.filters.without} ${tr.filters[a].toLowerCase()}`);
    if (c.relevance) chips.push(`“${c.relevance}”`);
    for (const tx of c.textExclude ?? []) chips.push(lang === "en" ? tx.labelEn : tx.labelHr);
    return chips;
  };

  const open = (s: SavedSearch) => {
    const c = s.criteria;
    const type = c.type === "rent" ? "rent" : "sale";
    // Seed the browse snapshot (BrowseView reads it on mount), then navigate.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { type: _t, sort, page: _p, pageSize: _ps, ...filters } = c;
    setBrowseSnapshot(type, { filters, sort: sort ?? DEFAULT_SORT });
    router.push(type === "rent" ? "/rent" : "/buy");
  };

  const remove = async (id: string) => {
    setList((prev) => prev.filter((s) => s.id !== id)); // optimistic
    const res = await deleteSearchAction(id);
    if (!res.ok) setList(searches); // revert to the server list on failure
  };

  if (list.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "linear-gradient(135deg, #F7D4DE, #EDE9F8)" }}
        >
          <Search size={30} className="text-pink-400" />
        </div>
        <h2 className="text-2xl font-extrabold text-foreground mb-2">{tr.savedSearches.empty}</h2>
        <p className="text-muted-foreground mb-10 max-w-sm">{tr.savedSearches.emptyHint}</p>
        <button
          onClick={() => router.push("/buy")}
          className="px-10 py-3.5 rounded-2xl font-bold text-white text-sm transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #7B6FC4, #9B6FC4)" }}
        >
          {tr.savedSearches.browse}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-extrabold text-foreground mb-1">{tr.savedSearches.title}</h1>
      <p className="text-sm text-muted-foreground mb-8">{tr.savedSearches.intro}</p>

      <div className="space-y-4">
        {list.map((s) => (
          <div key={s.id} className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-foreground">{s.name}</h3>
                  {s.newCount > 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                      title={tr.savedSearches.newMatches}
                    >
                      <Bell size={12} /> {s.newCount}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => open(s)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #7B6FC4, #C084A0)" }}
                >
                  {tr.savedSearches.open} <ArrowRight size={13} />
                </button>
                <button
                  onClick={() => remove(s.id)}
                  aria-label={tr.savedSearches.delete}
                  title={tr.savedSearches.delete}
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-red-500 hover:border-red-300 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {summarize(s).map((chip, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-muted-foreground"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
