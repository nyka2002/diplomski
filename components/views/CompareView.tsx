"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X, Bookmark, Lock } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { translations } from "@/lib/i18n/translations";
import type { Listing } from "@/lib/listings/types";
import { buildComparisonRows, type CompareKey, type CompareRow } from "@/lib/listings/compare";
import SelectDropdown from "@/components/SelectDropdown";
import HeartButton from "@/components/HeartButton";

type IndexItem = { id: string; title: string; titleHr: string; type: "sale" | "rent"; price: string };

export default function CompareView({
  aListing,
  bListing,
  index,
  locked,
  savedCount,
}: {
  aListing: Listing | null;
  bListing: Listing | null;
  index: IndexItem[];
  // Locked flow (entered from a listing's detail page): the left listing is
  // fixed and only the right side is picked from the saved listings.
  locked: boolean;
  // Number of saved listings the user has (drives the gate: ≥2 for the free
  // flow, ≥1 for the locked flow).
  savedCount: number;
}) {
  const { lang, savedIds, toggleSaved } = useApp();
  const tr = translations[lang];
  const router = useRouter();

  const title = (l: { title: string; titleHr: string }) => (lang === "en" ? l.title : l.titleHr);
  const typeLabel = (t: "sale" | "rent") =>
    t === "sale" ? (lang === "en" ? "for sale" : "prodaja") : lang === "en" ? "for rent" : "najam";

  // Options for one picker, excluding whatever the other side already holds, so
  // the same listing can never be chosen on both sides.
  const optionsExcluding = (otherId?: string | null) =>
    index.filter((l) => l.id !== otherId).map((l) => ({ value: l.id, label: `${title(l)} — ${l.price}` }));

  // Preserve the locked flag when navigating, so the left listing stays fixed.
  const setPair = (a: string | null, b: string | null) => {
    const p = new URLSearchParams();
    if (a) p.set("a", a);
    if (b) p.set("b", b);
    if (locked) p.set("lock", "1");
    const qs = p.toString();
    router.push(qs ? `/compare?${qs}` : "/compare");
  };

  const rowLabel = (key: CompareKey): string => {
    switch (key) {
      case "type":
        return tr.compare.type;
      case "price":
        return tr.listing.price;
      case "area":
        return tr.filters.area;
      case "rooms":
        return tr.filters.rooms;
      case "location":
        return tr.compare.location;
      default:
        return tr.filters[key]; // amenity
    }
  };

  const renderValue = (row: CompareRow, side: "a" | "b") => {
    const v = row[side];
    if (row.kind === "amenity") {
      return v ? (
        <Check size={16} className="text-emerald-600 dark:text-emerald-400" aria-label="yes" />
      ) : (
        <X size={16} className="text-muted-foreground/50" aria-label="no" />
      );
    }
    switch (row.key) {
      case "type":
        return typeLabel(v as "sale" | "rent");
      case "area":
        return `${v} m²`;
      case "rooms":
        return (v as number) > 0 ? String(v) : tr.listing.studio;
      default:
        return String(v);
    }
  };

  const Picker = ({
    value,
    placeholder,
    options,
    onChange,
  }: {
    value: string;
    placeholder: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
  }) => (
    <SelectDropdown
      value={value}
      placeholder={placeholder}
      ariaLabel={placeholder}
      clearable
      searchable
      searchPlaceholder={tr.filters.search}
      options={options}
      onChange={onChange}
    />
  );

  // A call-to-save prompt shown when there aren't enough saved listings to
  // compare (free flow: <2; locked flow: nothing left to pick on the right).
  const Gate = ({ hint }: { hint: string }) => (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20 text-center">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ background: "linear-gradient(135deg, #F7D4DE, #EDE9F8)" }}
      >
        <Bookmark size={32} className="text-pink-400" />
      </div>
      <h2 className="text-2xl font-extrabold text-foreground mb-2">{tr.compare.gateTitle}</h2>
      <p className="text-muted-foreground mb-10 max-w-sm">{hint}</p>
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

  // ── Gates ──────────────────────────────────────────────────────────────────
  // Free flow needs at least two saved listings to pick from.
  if (!locked && savedCount < 2) return <Gate hint={tr.compare.gateHint} />;
  // Locked flow needs at least one other saved listing to compare against (the
  // locked listing is excluded from the options, so index is what's available).
  if (locked && index.length === 0) return <Gate hint={tr.compare.gateHintOne} />;

  // Require two *different* listings (a === b would compare a listing with
  // itself); the pickers already exclude the other side, this guards crafted URLs.
  const bothChosen = aListing && bListing && aListing.id !== bListing.id;
  const rows = bothChosen ? buildComparisonRows(aListing, bListing) : [];

  const Header = ({ l }: { l: Listing }) => (
    <Link href={`/listings/${l.id}`} className="block group">
      {/* Fixed height (not aspect-ratio): a table cell doesn't honor aspect-[4/3]
          on its child, which left the photo floating in an over-tall box. A set
          height + object-cover reproduces the browse card's cropped thumbnail,
          equal on both sides (columns are table-fixed 1/2 each). */}
      <div className="h-44 w-full rounded-xl overflow-hidden bg-purple-50 dark:bg-purple-900/20 mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={l.images[0]} alt={title(l)} className="block w-full h-full object-cover" loading="lazy" />
      </div>
      <p className="font-bold text-sm leading-snug line-clamp-2 group-hover:underline">{title(l)}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{tr.compare.viewListing}</p>
    </Link>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold text-foreground mb-1">{tr.compare.title}</h1>
      <p className="text-sm text-muted-foreground mb-6">{locked ? tr.compare.introLocked : tr.compare.intro}</p>

      {/* Pickers (left is a read-only locked chip in the locked flow). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">{tr.compare.pickA}</label>
          {locked && aListing ? (
            <div className="flex items-center gap-2 h-[42px] px-3 rounded-xl border border-border bg-muted/40">
              <Lock size={14} className="shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium text-foreground">{title(aListing)}</span>
              <span className="ml-auto shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                {tr.compare.locked}
              </span>
              {/* Save the locked listing to favorites without leaving compare. */}
              <span className="shrink-0">
                <HeartButton
                  saved={savedIds.has(aListing.id)}
                  onToggle={(e) => {
                    e.preventDefault();
                    toggleSaved(aListing.id);
                  }}
                />
              </span>
            </div>
          ) : (
            <Picker
              value={aListing?.id ?? ""}
              placeholder={tr.compare.pickA}
              options={optionsExcluding(bListing?.id)}
              onChange={(v) => setPair(v || null, bListing?.id ?? null)}
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">{tr.compare.pickB}</label>
          <Picker
            value={bListing?.id ?? ""}
            placeholder={tr.compare.pickB}
            options={optionsExcluding(aListing?.id)}
            onChange={(v) => setPair(aListing?.id ?? null, v || null)}
          />
        </div>
      </div>

      {bothChosen ? (
        <div className="overflow-x-auto">
          {/* table-fixed keeps both listing columns exactly equal width so their
              thumbnails render at the same size. */}
          <table className="w-full border-collapse table-fixed">
            <colgroup>
              <col className="w-24 sm:w-36" />
              <col className="w-1/2" />
              <col className="w-1/2" />
            </colgroup>
            <thead>
              <tr>
                <th />
                <th className="p-2 align-top text-left">
                  <Header l={aListing} />
                </th>
                <th className="p-2 align-top text-left">
                  <Header l={bListing} />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-border">
                  <td className="py-2.5 pr-2 text-xs font-semibold text-muted-foreground align-middle">{rowLabel(row.key)}</td>
                  {(["a", "b"] as const).map((side) => (
                    <td
                      key={side}
                      className={`py-2.5 px-2 text-sm align-middle ${
                        row.highlight === side ? "font-bold text-primary" : "text-foreground"
                      }`}
                    >
                      {renderValue(row, side)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {locked ? tr.compare.introLocked : tr.compare.intro}
        </div>
      )}
    </div>
  );
}
