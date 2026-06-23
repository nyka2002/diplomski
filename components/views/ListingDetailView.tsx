"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, Phone, Mail, Building2 } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { translations, lowercasePreservingAcronyms } from "@/lib/i18n/translations";
import type { Listing } from "@/lib/data/listings";
import HeartButton from "@/components/HeartButton";

export default function ListingDetailView({ listing }: { listing: Listing }) {
  const { lang, savedIds, toggleSaved, listingOrigin } = useApp();
  const router = useRouter();
  const tr = translations[lang];
  const [idx, setIdx] = useState(0);
  const saved = savedIds.has(listing.id);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [listing.id]);

  // The whole property detail renders in lowercase (matching the app's
  // lowercase aesthetic), preserving all-caps acronyms.
  const lc = lowercasePreservingAcronyms;
  const title = lc(lang === "en" ? listing.title : listing.titleHr);
  const description = lc(lang === "en" ? listing.description : listing.descriptionHr);
  const isRent = listing.type === "rent";
  // Spec rows that hold a place name (location / address / street / city /
  // county / neighborhood, EN or HR) keep their original casing — lowercasing a
  // proper noun like "Zagreb, Trešnjevka" reads wrong. Everything else (rooms,
  // area, energy class, …) still renders lowercase.
  const isPlaceLabel = (label: string, labelHr: string) =>
    /location|address|street|neighbo|city|county|district|lokacij|adres|ulic|kvart|mjesto|naselj|grad|župan/i.test(
      `${label} ${labelHr}`,
    );
  const prev = () => setIdx((i) => (i - 1 + listing.images.length) % listing.images.length);
  const next = () => setIdx((i) => (i + 1) % listing.images.length);

  // Return to wherever the listing was opened from (incl. its filter query);
  // fall back to the matching browse page.
  const backHref = listingOrigin || (listing.type === "sale" ? "/buy" : "/rent");
  const backLabel = backHref.split("?")[0] === "/saved" ? tr.listing.backSaved : tr.listing.back;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Sticky so it stays reachable no matter how far the page is scrolled. */}
      <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-4 bg-background/80 backdrop-blur-lg">
        <button
          onClick={() => router.push(backHref, { scroll: false })}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ChevronLeft size={15} /> {backLabel}
        </button>
      </div>

      {/* Title row */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground leading-tight tracking-tight">
          {title}
        </h1>
        <HeartButton
          saved={saved}
          onToggle={(e) => {
            e.preventDefault();
            toggleSaved(listing.id);
          }}
          size="lg"
        />
      </div>
      <p className="text-sm text-muted-foreground mb-2">{listing.location}</p>
      <p className="text-2xl font-extrabold mb-8" style={{ color: "var(--primary)" }}>
        {lc(listing.price)}
      </p>

      {/* Gallery */}
      <div className="mb-10 rounded-3xl overflow-hidden bg-purple-50 dark:bg-purple-900/20 relative aspect-video shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={listing.images[idx]} alt={title} className="w-full h-full object-cover" />
        {listing.images.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label={lang === "en" ? "previous image" : "prethodna slika"}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 dark:bg-gray-900/80 shadow hover:bg-white dark:hover:bg-gray-900 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={next}
              aria-label={lang === "en" ? "next image" : "sljedeća slika"}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 dark:bg-gray-900/80 shadow hover:bg-white dark:hover:bg-gray-900 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {listing.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`${lang === "en" ? "go to image" : "idi na sliku"} ${i + 1}`}
                  aria-current={i === idx}
                  className={`rounded-full transition-all duration-200 ${
                    i === idx ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section>
            <h2 className="text-xl font-extrabold text-foreground mb-3">
              {tr.listing.description}
            </h2>
            <p className="text-muted-foreground leading-relaxed">{description}</p>
          </section>
          <section>
            <h2 className="text-xl font-extrabold text-foreground mb-4">{tr.listing.specs}</h2>
            <div className="rounded-2xl border border-border overflow-hidden">
              <table className="w-full">
                <tbody>
                  {listing.specs.map(({ label, labelHr, value, valueHr }, i) => (
                    <tr key={label} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                      <td className="px-5 py-3 text-sm text-muted-foreground font-medium w-1/2">
                        {lowercasePreservingAcronyms(lang === "en" ? label : labelHr)}
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground font-bold">
                        {isPlaceLabel(label, labelHr)
                          ? (lang === "en" ? value : (valueHr ?? value))
                          : lc(lang === "en" ? value : (valueHr ?? value))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <a
            href={listing.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold hover:underline"
            style={{ color: "var(--primary)" }}
          >
            <ExternalLink size={14} /> {tr.listing.viewOriginal}
          </a>
        </div>

        {/* Seller / landlord panel. Seller data keeps its original casing (it's
            proper nouns — names, agencies, emails). Only the fields that are
            actually present render, so scraped ads without a phone/email don't
            show empty rows. */}
        <aside>
          <div className="sticky top-24 bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h3 className="font-extrabold text-foreground text-sm mb-5">
              {isRent ? tr.listing.landlordInfo : tr.listing.sellerInfo}
            </h3>
            {(() => {
              const { name, agency, phone, email } = listing.seller;
              // The header name: prefer the person/agency name, fall back to agency.
              const headerName = name || agency;
              // Show agency as a sub-line only when it adds info beyond the name.
              const subAgency = agency && agency !== name ? agency : "";
              const hasAnyContact = Boolean(phone || email || subAgency);
              return (
                <>
                  {headerName && (
                    <div className="flex items-center gap-3 mb-5">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                        style={{ background: "linear-gradient(135deg, #7B6FC4, #C084A0)" }}
                      >
                        {(headerName[0] ?? "").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground text-sm">{headerName}</p>
                        {subAgency && (
                          <p className="text-xs text-muted-foreground truncate">{subAgency}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {hasAnyContact ? (
                    <div className="space-y-3 mb-5">
                      {phone && (
                        <a
                          href={`tel:${phone}`}
                          className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Phone size={13} className="shrink-0 text-purple-400" />
                          <span className="text-xs">{phone}</span>
                        </a>
                      )}
                      {email && (
                        <a
                          href={`mailto:${email}`}
                          className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Mail size={13} className="shrink-0 text-pink-400" />
                          <span className="text-xs break-all">{email}</span>
                        </a>
                      )}
                      {subAgency && (
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <Building2 size={13} className="shrink-0 text-purple-400" />
                          <span className="text-xs">{subAgency}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                      {tr.listing.contactNote}
                    </p>
                  )}
                  {listing.originalUrl && (
                    <a
                      href={listing.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                      style={{ background: "linear-gradient(135deg, #7B6FC4 0%, #C084A0 100%)" }}
                    >
                      {isRent ? tr.listing.contactLandlord : tr.listing.contactSeller}
                    </a>
                  )}
                </>
              );
            })()}
          </div>
        </aside>
      </div>
    </div>
  );
}
