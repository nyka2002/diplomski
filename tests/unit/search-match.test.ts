import { describe, it, expect } from "vitest";
import { listingMatchesCriteria } from "@/lib/searches/match";
import type { Listing, ListingQuery } from "@/lib/listings/types";

function make(over: Partial<Listing>): Listing {
  return {
    id: "x-1",
    type: "sale",
    title: "Bright apartment",
    titleHr: "Svijetli stan",
    price: "€150,000",
    priceEur: 150000,
    location: "Zagreb, Trnje",
    areaM2: 60,
    rooms: 3,
    description: "third floor, elevator",
    descriptionHr: "treći kat, lift",
    postedAt: "2026-01-01T00:00:00Z",
    images: [],
    specs: [],
    seller: { name: "", phone: "", email: "", agency: "" },
    attributes: { balcony: true, parking: false, furnished: false, pets: false },
    source: "njuskalo",
    originalUrl: "",
    ...over,
  } as Listing;
}

describe("listingMatchesCriteria", () => {
  const base = make({});

  it("matches when no criteria constrain it (only type)", () => {
    expect(listingMatchesCriteria(base, { type: "sale" })).toBe(true);
  });

  it("rejects a different type", () => {
    expect(listingMatchesCriteria(base, { type: "rent" })).toBe(false);
  });

  it("city matches by prefix on 'City, Neighborhood'", () => {
    expect(listingMatchesCriteria(base, { city: "Zagreb" })).toBe(true);
    expect(listingMatchesCriteria(base, { city: "Split" })).toBe(false);
  });

  it("neighborhoods require an exact 'City, Neighborhood' match", () => {
    expect(listingMatchesCriteria(base, { city: "Zagreb", neighborhoods: ["Trnje"] })).toBe(true);
    expect(listingMatchesCriteria(base, { city: "Zagreb", neighborhoods: ["Maksimir"] })).toBe(false);
  });

  it("enforces price / area / rooms ranges", () => {
    expect(listingMatchesCriteria(base, { priceMax: 100000 })).toBe(false);
    expect(listingMatchesCriteria(base, { priceMin: 100000, priceMax: 200000 })).toBe(true);
    expect(listingMatchesCriteria(base, { areaMin: 80 })).toBe(false);
    expect(listingMatchesCriteria(base, { roomsMin: 4 })).toBe(false);
    expect(listingMatchesCriteria(base, { roomsMin: 2, roomsMax: 3 })).toBe(true);
  });

  it("requires present amenities and excludes forbidden ones", () => {
    expect(listingMatchesCriteria(base, { balcony: true })).toBe(true);
    expect(listingMatchesCriteria(base, { parking: true })).toBe(false); // base has no parking
    expect(listingMatchesCriteria(base, { forbidden: ["balcony"] })).toBe(false); // base HAS balcony
    expect(listingMatchesCriteria(base, { forbidden: ["parking"] })).toBe(true);
  });

  it("applies textual exclusions across title/description (both languages)", () => {
    const c: ListingQuery = { type: "sale", textExclude: [{ labelHr: "bez lifta", labelEn: "no elevator", terms: ["elevator", "lift"] }] };
    expect(listingMatchesCriteria(base, c)).toBe(false); // description mentions elevator/lift
    const noLift = make({ description: "second floor", descriptionHr: "drugi kat" });
    expect(listingMatchesCriteria(noLift, c)).toBe(true);
  });

  it("combines several constraints (all must hold)", () => {
    const c: ListingQuery = { type: "sale", city: "Zagreb", priceMax: 200000, roomsMin: 3, balcony: true };
    expect(listingMatchesCriteria(base, c)).toBe(true);
    expect(listingMatchesCriteria(make({ rooms: 2 }), c)).toBe(false);
  });
});
