import { describe, it, expect } from "vitest";
import { serializeSearchCriteria } from "@/lib/analytics/criteria-snapshot";
import type { AiCriteria } from "@/lib/ai/criteria";

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

describe("serializeSearchCriteria", () => {
  it("drops the assistant reply from the stored snapshot", () => {
    const snap = serializeSearchCriteria({ ...base, city: "Zagreb", reply: "applied your filters!" });
    expect("reply" in snap).toBe(false);
    expect(snap.city).toBe("Zagreb");
  });

  it("keeps the structured fields verbatim", () => {
    const snap = serializeSearchCriteria({
      ...base,
      city: "Split",
      roomsMin: 2,
      priceMax: 200000,
      mustHave: ["parking", "balcony"],
      relevanceQuery: "quiet street near the sea",
    });
    expect(snap.city).toBe("Split");
    expect(snap.roomsMin).toBe(2);
    expect(snap.priceMax).toBe(200000);
    expect(snap.mustHave).toEqual(["parking", "balcony"]);
    expect(snap.relevanceQuery).toBe("quiet street near the sea");
  });

  it("normalizes missing array fields to empty arrays", () => {
    // Simulate a malformed object where arrays are absent (defensive path).
    const malformed = { ...base } as unknown as AiCriteria;
    // @ts-expect-error deliberately removing a required array to test the guard
    delete malformed.neighborhoods;
    const snap = serializeSearchCriteria(malformed);
    expect(snap.neighborhoods).toEqual([]);
    expect(snap.mustHave).toEqual([]);
    expect(snap.textExclude).toEqual([]);
  });
});
