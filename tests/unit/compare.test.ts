import { describe, it, expect } from "vitest";
import { buildComparisonRows } from "@/lib/listings/compare";
import type { Listing } from "@/lib/listings/types";

function make(over: Partial<Listing>): Listing {
  return {
    id: "x-1",
    type: "sale",
    title: "A",
    titleHr: "A",
    price: "€100,000",
    priceEur: 100000,
    location: "Zagreb, Trešnjevka",
    areaM2: 50,
    rooms: 2,
    postedAt: "2026-01-01T00:00:00Z",
    images: [],
    specs: [],
    seller: { name: "", phone: "", email: "", agency: "" },
    attributes: { balcony: false, parking: false, furnished: false, pets: false },
    source: "njuskalo",
    ...over,
  } as Listing;
}

describe("buildComparisonRows", () => {
  const a = make({ priceEur: 100000, price: "€100,000", areaM2: 50, rooms: 2, attributes: { balcony: true, parking: false, furnished: false, pets: false } });
  const b = make({ id: "y-2", source: "oglasnik", priceEur: 120000, price: "€120,000", areaM2: 70, rooms: 3, attributes: { balcony: false, parking: true, furnished: false, pets: false } });
  const rows = buildComparisonRows(a, b);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));

  it("cheaper listing wins the price row", () => {
    expect(byKey.price.highlight).toBe("a"); // 100k < 120k
  });
  it("larger area wins", () => {
    expect(byKey.area.highlight).toBe("b"); // 70 > 50
  });
  it("more rooms wins", () => {
    expect(byKey.rooms.highlight).toBe("b"); // 3 > 2
  });
  it("equal numeric fields are not highlighted", () => {
    const rows2 = buildComparisonRows(a, make({ priceEur: 100000, areaM2: 50, rooms: 2 }));
    expect(Object.fromEntries(rows2.map((r) => [r.key, r])).price.highlight).toBeNull();
  });
  it("amenity rows carry booleans and are never highlighted", () => {
    expect(byKey.balcony).toMatchObject({ kind: "amenity", a: true, b: false, highlight: null });
    expect(byKey.parking).toMatchObject({ kind: "amenity", a: false, b: true, highlight: null });
  });
  it("text rows (type, location) carry raw values, no highlight", () => {
    expect(byKey.location).toMatchObject({ a: "Zagreb, Trešnjevka", highlight: null });
    expect(byKey.type.a).toBe("sale");
  });
  it("does not expose the listing source (not shown in the comparison)", () => {
    expect(byKey.source).toBeUndefined();
  });
  it("produces a stable row set (type, price, area, rooms, location, 4 amenities)", () => {
    expect(rows.map((r) => r.key)).toEqual(["type", "price", "area", "rooms", "location", "balcony", "parking", "furnished", "pets"]);
  });
});
