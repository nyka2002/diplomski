"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { translations } from "@/lib/i18n/translations";
import type { Lang } from "@/lib/i18n/translations";
import { GradientButton } from "@/components/common";
import SelectDropdown from "@/components/SelectDropdown";
import { listingSchema } from "@/lib/validation/listing";
import { fieldErrors } from "@/lib/validation/auth";
import { saveListingAction } from "@/lib/admin/actions";
import type { AdminListing } from "@/lib/admin/data";

const inputCls =
  "w-full rounded-xl border border-border bg-input-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-700 transition-all";

type FormState = {
  type: "sale" | "rent";
  status: "active" | "inactive" | "removed";
  title: string;
  titleHr: string;
  priceEur: string;
  priceDisplay: string;
  city: string;
  areaM2: string;
  rooms: string;
  description: string;
  descriptionHr: string;
  images: string;
  balcony: boolean;
  parking: boolean;
  furnished: boolean;
  pets: boolean;
  sellerName: string;
  sellerPhone: string;
  sellerEmail: string;
  sellerAgency: string;
  sourceUrl: string;
};

function initialState(listing: AdminListing | null): FormState {
  return {
    type: listing?.type ?? "sale",
    status: listing?.status ?? "active",
    title: listing?.title ?? "",
    titleHr: listing?.titleHr ?? "",
    priceEur: listing ? String(listing.priceEur) : "",
    priceDisplay: listing?.price ?? "",
    city: listing?.location ?? "",
    areaM2: listing ? String(listing.areaM2) : "",
    rooms: listing ? String(listing.rooms) : "",
    description: listing?.description ?? "",
    descriptionHr: listing?.descriptionHr ?? "",
    images: (listing?.images ?? []).join("\n"),
    balcony: listing?.attributes.balcony ?? false,
    parking: listing?.attributes.parking ?? false,
    furnished: listing?.attributes.furnished ?? false,
    pets: listing?.attributes.pets ?? false,
    sellerName: listing?.seller.name ?? "",
    sellerPhone: listing?.seller.phone ?? "",
    sellerEmail: listing?.seller.email ?? "",
    sellerAgency: listing?.seller.agency ?? "",
    sourceUrl: listing?.originalUrl ?? "",
  };
}

// Split the image textarea (newline- or comma-separated) into a clean list.
function parseImages(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ListingForm({
  lang,
  listing,
  onClose,
  onSaved,
}: {
  lang: Lang;
  listing: AdminListing | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const tr = translations[lang];
  const ta = tr.admin;
  const [form, setForm] = useState<FormState>(() => initialState(listing));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const err = (key: string): string | undefined => {
    const code = errors[key];
    return code ? tr.validation[code as keyof typeof tr.validation] : undefined;
  };

  const payload = () => ({
    id: listing?.id,
    type: form.type,
    status: form.status,
    title: form.title,
    titleHr: form.titleHr,
    priceEur: form.priceEur,
    priceDisplay: form.priceDisplay,
    city: form.city,
    areaM2: form.areaM2,
    rooms: form.rooms,
    description: form.description,
    descriptionHr: form.descriptionHr,
    images: parseImages(form.images),
    balcony: form.balcony,
    parking: form.parking,
    furnished: form.furnished,
    pets: form.pets,
    sellerName: form.sellerName,
    sellerPhone: form.sellerPhone,
    sellerEmail: form.sellerEmail,
    sellerAgency: form.sellerAgency,
    sourceUrl: form.sourceUrl,
  });

  const submit = async () => {
    if (saving) return;
    setFormError("");
    const data = payload();
    const parsed = listingSchema.safeParse(data);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSaving(true);
    const res = await saveListingAction(data);
    setSaving(false);
    if (!res.ok) {
      if (res.errors) setErrors(res.errors);
      setFormError(res.formError ? (tr.authError[res.formError as keyof typeof tr.authError] ?? ta.genericError) : "");
      return;
    }
    onSaved();
  };

  const field = (
    label: string,
    key: keyof FormState,
    opts: { type?: string; textarea?: boolean } = {},
  ) => (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
      {opts.textarea ? (
        <textarea
          value={form[key] as string}
          onChange={(e) => set(key, e.target.value as FormState[typeof key])}
          rows={3}
          className={`${inputCls} resize-y leading-relaxed`}
        />
      ) : (
        <input
          type={opts.type ?? "text"}
          value={form[key] as string}
          onChange={(e) => set(key, e.target.value as FormState[typeof key])}
          className={inputCls}
        />
      )}
      {err(key) && <p className="mt-1 text-xs font-medium text-destructive">{err(key)}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-foreground">
            {listing ? ta.editListing : ta.newListing}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {formError && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
            {formError}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                {ta.type}
              </label>
              <SelectDropdown
                value={form.type}
                onChange={(v) => set("type", v as FormState["type"])}
                className={inputCls}
                options={[
                  { value: "sale", label: ta.sale },
                  { value: "rent", label: ta.rent },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                {ta.status}
              </label>
              <SelectDropdown
                value={form.status}
                onChange={(v) => set("status", v as FormState["status"])}
                className={inputCls}
                options={[
                  { value: "active", label: ta.statusActive },
                  { value: "inactive", label: ta.statusInactive },
                  { value: "removed", label: ta.statusRemoved },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field(ta.fTitle, "title")}
            {field(ta.fTitleHr, "titleHr")}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field(ta.fPriceEur, "priceEur", { type: "number" })}
            {field(ta.fPriceDisplay, "priceDisplay")}
          </div>

          {field(ta.fCity, "city")}

          <div className="grid grid-cols-2 gap-4">
            {field(ta.fArea, "areaM2", { type: "number" })}
            {field(ta.fRooms, "rooms", { type: "number" })}
          </div>

          {field(ta.fDescription, "description", { textarea: true })}
          {field(ta.fDescriptionHr, "descriptionHr", { textarea: true })}
          {field(ta.fImages, "images", { textarea: true })}

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">
              {ta.fAmenities}
            </label>
            <div className="flex flex-wrap gap-4">
              {(["balcony", "parking", "furnished", "pets"] as const).map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form[a]}
                    onChange={(e) => set(a, e.target.checked)}
                    className="h-4 w-4 rounded accent-purple-500"
                  />
                  {tr.filters[a]}
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <label className="block text-xs font-semibold text-muted-foreground mb-2">
              {ta.fSeller}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field(ta.fSellerName, "sellerName")}
              {field(ta.fSellerPhone, "sellerPhone")}
              {field(ta.fSellerEmail, "sellerEmail", { type: "email" })}
              {field(ta.fSellerAgency, "sellerAgency")}
            </div>
          </div>

          {field(ta.fSourceUrl, "sourceUrl")}
        </div>

        <div className="mt-6 flex gap-3">
          <GradientButton onClick={submit} disabled={saving} className="flex-1">
            {saving ? ta.saving : ta.save}
          </GradientButton>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            {ta.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
