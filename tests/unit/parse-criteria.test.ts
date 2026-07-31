import { describe, it, expect } from "vitest";
import { parseCriteria } from "@/lib/ai/criteria";

const full = {
  city: "Zagreb",
  neighborhoods: ["Trnje"],
  priceMin: null,
  priceMax: 200000,
  areaMin: 50,
  areaMax: null,
  roomsMin: 2,
  roomsMax: null,
  mustHave: ["balcony"],
  forbidden: [],
  niceToHave: ["parking"],
  relevanceQuery: "near a park",
  textExclude: [{ labelHr: "bez prizemlja", labelEn: "no ground floor", terms: ["prizemlje"] }],
  reply: "Here you go.",
};

describe("parseCriteria", () => {
  it("parses clean JSON unchanged (default OpenAI path)", () => {
    const out = parseCriteria(JSON.stringify(full));
    expect(out).toEqual(full);
  });

  it("recovers JSON wrapped in Markdown fences", () => {
    const out = parseCriteria("```json\n" + JSON.stringify(full) + "\n```");
    expect(out?.city).toBe("Zagreb");
    expect(out?.priceMax).toBe(200000);
  });

  it("recovers JSON embedded in surrounding prose", () => {
    const out = parseCriteria(`Sure! Here are the criteria:\n${JSON.stringify(full)}\nHope that helps.`);
    expect(out?.mustHave).toEqual(["balcony"]);
  });

  it("fills defaults for missing fields", () => {
    const out = parseCriteria(JSON.stringify({ city: "Split" }));
    expect(out).toEqual({
      city: "Split",
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
      reply: "",
    });
  });

  it("drops unknown amenity values", () => {
    const out = parseCriteria(JSON.stringify({ mustHave: ["balcony", "garden", "parking"] }));
    expect(out?.mustHave).toEqual(["balcony", "parking"]);
  });

  it("drops textExclude entries with no terms or no label", () => {
    const out = parseCriteria(
      JSON.stringify({
        textExclude: [
          { labelHr: "", labelEn: "", terms: [] },
          { labelHr: "prizemlje", labelEn: "ground", terms: [] },
          { labelHr: "kat", labelEn: "floor", terms: ["prizemlje"] },
        ],
      }),
    );
    expect(out?.textExclude).toEqual([{ labelHr: "kat", labelEn: "floor", terms: ["prizemlje"] }]);
  });

  it("returns null when no JSON object is present", () => {
    expect(parseCriteria("I could not understand that.")).toBeNull();
    expect(parseCriteria("")).toBeNull();
  });

  it("returns null for a JSON array (not a criteria object)", () => {
    expect(parseCriteria("[1, 2, 3]")).toBeNull();
  });
});
