import { describe, it, expect } from "vitest";
import {
  parseListingQuery,
  buildListingSearch,
  countActiveFilters,
  searchParamsToQuery,
} from "@/lib/listings/params";
import type { ListingQuery } from "@/lib/listings/types";

describe("listing query <-> search params", () => {
  it("round-trips a full query (incl. county, neighborhoods, ranges, AI overlay)", () => {
    const q: ListingQuery = {
      type: "sale",
      sort: "priceLow",
      county: "Grad Zagreb",
      city: "Zagreb",
      neighborhoods: ["Maksimir", "Trnje"],
      priceMin: 100000,
      priceMax: 300000,
      areaMin: 40,
      roomsMin: 2,
      roomsMax: 3,
      balcony: true,
      forbidden: ["pets"],
      niceToHave: ["parking"],
      relevance: "near a park",
      textExclude: [{ label: "ne u prizemlju", terms: ["prizemlje", "ground floor"] }],
    };
    const round = parseListingQuery(new URLSearchParams(buildListingSearch(q)));
    expect(round).toEqual(q);
  });

  it("round-trips multiple textExclude entries and drops malformed tx params", () => {
    const q: ListingQuery = {
      textExclude: [
        { label: "ne u prizemlju", terms: ["prizemlje", "ground floor"] },
        { label: "bez podruma", terms: ["podrum", "basement"] },
      ],
    };
    const sp = new URLSearchParams(buildListingSearch(q));
    sp.append("tx", "not-json"); // a malformed entry must be ignored, not throw
    sp.append("tx", JSON.stringify({ label: "x" })); // missing terms → dropped
    const round = parseListingQuery(sp);
    expect(round.textExclude).toEqual(q.textExclude);
    expect(countActiveFilters(round)).toBe(2);
  });

  it("omits defaults and empty values from the query string", () => {
    const qs = buildListingSearch({ type: "rent", sort: "dateNew", page: 1 });
    expect(qs).toBe("type=rent"); // dateNew is the default sort; page 1 is implicit
  });

  it("drops invalid/garbage params when parsing", () => {
    const q = parseListingQuery(new URLSearchParams("type=condo&sort=weird&priceMin=abc"));
    expect(q.type).toBeUndefined();
    expect(q.sort).toBeUndefined();
    expect(q.priceMin).toBeUndefined();
  });

  it("parses repeated neighborhood params into an array", () => {
    const q = searchParamsToQuery({ city: "Zagreb", neighborhood: ["Maksimir", "Trnje"] });
    expect(q.neighborhoods).toEqual(["Maksimir", "Trnje"]);
  });

  it("counts active filters: county, city, each neighborhood, ranges, amenities, AI overlay", () => {
    // county(1) + city(1) + neighborhoods(2) + priceMin(1) + roomsMax(1)
    // + balcony(1) + forbidden(1) + relevance(1) = 9
    expect(
      countActiveFilters({
        county: "Grad Zagreb",
        city: "Zagreb",
        neighborhoods: ["Maksimir", "Trnje"],
        priceMin: 1,
        roomsMax: 3,
        balcony: true,
        forbidden: ["pets"],
        relevance: "quiet",
      }),
    ).toBe(9);
  });
});
