import { describe, it, expect } from "vitest";
import { criteriaToFilters, type AiCriteria } from "@/lib/ai/criteria";

const base: AiCriteria = {
  city: null,
  neighborhoods: [],
  priceMin: null,
  priceMax: null,
  areaMin: null,
  areaMax: null,
  roomsMin: null,
  roomsMax: null,
  mustHave: [],
  forbidden: [],
  niceToHave: [],
  relevanceQuery: null,
  reply: "ok",
};

describe("criteriaToFilters", () => {
  it("maps the example: studio/one-bed + private parking + balcony in Zagreb", () => {
    const f = criteriaToFilters({
      ...base,
      city: "Zagreb",
      roomsMin: 0,
      roomsMax: 1,
      mustHave: ["parking", "balcony"],
    });
    expect(f.city).toBe("Zagreb");
    expect(f.roomsMin).toBe(0);
    expect(f.roomsMax).toBe(1);
    // mustHave amenities become the same boolean filters the manual checkboxes set
    expect(f.parking).toBe(true);
    expect(f.balcony).toBe(true);
  });

  it("keeps forbidden / niceToHave / relevance as the AI overlay", () => {
    const f = criteriaToFilters({
      ...base,
      forbidden: ["pets"],
      niceToHave: ["furnished"],
      relevanceQuery: "great sea view",
    });
    expect(f.forbidden).toEqual(["pets"]);
    expect(f.niceToHave).toEqual(["furnished"]);
    expect(f.relevance).toBe("great sea view");
    // overlay amenities must NOT become hard boolean filters
    expect(f.pets).toBeUndefined();
    expect(f.furnished).toBeUndefined();
  });

  it("emits an empty filter object when criteria are all empty (a reset)", () => {
    expect(criteriaToFilters(base)).toEqual({});
  });

  it("preserves roomsMin === 0 (studio) rather than dropping it", () => {
    const f = criteriaToFilters({ ...base, roomsMin: 0, roomsMax: 0 });
    expect(f.roomsMin).toBe(0);
    expect(f.roomsMax).toBe(0);
  });
});
