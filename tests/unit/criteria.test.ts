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
  textExclude: [],
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

  it("maps a floor exclusion to a separate textExclude entry (atomic), keeping the location wish in relevance", () => {
    const f = criteriaToFilters({
      ...base,
      roomsMin: 2,
      roomsMax: 2,
      mustHave: ["balcony"],
      niceToHave: ["furnished"],
      relevanceQuery: "near the center",
      textExclude: [
        { labelHr: "ne u prizemlju", labelEn: "not on the ground floor", terms: ["prizemlje", "prizemlju", "ground floor"] },
      ],
    });
    // location wish stays semantic, floor exclusion is its own hard filter
    expect(f.relevance).toBe("near the center");
    expect(f.textExclude).toEqual([
      { labelHr: "ne u prizemlju", labelEn: "not on the ground floor", terms: ["prizemlje", "prizemlju", "ground floor"] },
    ]);
  });

  it("falls back to the other language when one label is missing", () => {
    const f = criteriaToFilters({
      ...base,
      textExclude: [{ labelHr: "ne u prizemlju", labelEn: "", terms: ["prizemlje"] }],
    });
    expect(f.textExclude).toEqual([
      { labelHr: "ne u prizemlju", labelEn: "ne u prizemlju", terms: ["prizemlje"] },
    ]);
  });

  it("drops textExclude entries with no label or no usable terms", () => {
    const f = criteriaToFilters({
      ...base,
      textExclude: [
        { labelHr: "", labelEn: "", terms: ["x"] },
        { labelHr: "bez podruma", labelEn: "no basement", terms: ["  "] },
      ],
    });
    expect(f.textExclude).toBeUndefined();
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
