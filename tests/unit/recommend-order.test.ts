import { describe, it, expect } from "vitest";
import { orderByIdRank } from "@/lib/listings/recommend-order";
import type { Listing } from "@/lib/listings/types";

function make(id: string): Listing {
  return {
    id,
    type: "sale",
    title: id,
    titleHr: id,
    price: "€100,000",
    priceEur: 100000,
    location: "Zagreb",
    areaM2: 50,
    rooms: 2,
    description: "",
    descriptionHr: "",
    originalUrl: "",
    postedAt: "2026-01-01T00:00:00Z",
    images: [],
    specs: [],
    seller: { name: "", phone: "", email: "", agency: "" },
    attributes: { balcony: false, parking: false, furnished: false, pets: false },
    source: "njuskalo",
  } as Listing;
}

describe("orderByIdRank", () => {
  const listings = [make("c"), make("a"), make("b")]; // fetch order is arbitrary

  it("reorders listings to match the ranked id order", () => {
    const out = orderByIdRank(listings, ["a", "b", "c"]);
    expect(out.map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  it("drops ranked ids that are missing from the fetched rows", () => {
    const out = orderByIdRank(listings, ["a", "x", "b"]); // x wasn't fetched
    expect(out.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("ignores fetched rows not present in the ranking", () => {
    const out = orderByIdRank(listings, ["b"]);
    expect(out.map((l) => l.id)).toEqual(["b"]);
  });

  it("returns empty for an empty ranking", () => {
    expect(orderByIdRank(listings, [])).toEqual([]);
  });
});
