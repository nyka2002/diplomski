import { describe, it, expect } from "vitest";
import {
  precisionAtK,
  recallAtK,
  reciprocalRank,
  meanReciprocalRank,
  averagePrecision,
  meanAveragePrecision,
  dcgAtK,
  ndcgAtK,
  mean,
} from "@/lib/eval/metrics.mjs";

describe("ranking metrics", () => {
  const ranked = ["a", "b", "c", "d", "e"];
  const relevant = new Set(["b", "d"]);

  it("precision@k counts relevant items in the top-k", () => {
    expect(precisionAtK(ranked, relevant, 2)).toBeCloseTo(0.5); // b relevant, a not
    expect(precisionAtK(ranked, relevant, 4)).toBeCloseTo(0.5); // b,d of 4
    expect(precisionAtK([], relevant, 3)).toBe(0);
  });

  it("recall@k is found-relevant over total-relevant", () => {
    expect(recallAtK(ranked, relevant, 2)).toBeCloseTo(0.5); // found b of {b,d}
    expect(recallAtK(ranked, relevant, 4)).toBeCloseTo(1); // found b,d
    expect(recallAtK(ranked, new Set(), 4)).toBe(0);
  });

  it("reciprocal rank uses the first relevant position", () => {
    expect(reciprocalRank(ranked, relevant)).toBeCloseTo(1 / 2); // b at position 2
    expect(reciprocalRank(["x", "y", "b"], relevant)).toBeCloseTo(1 / 3);
    expect(reciprocalRank(["x", "y"], relevant)).toBe(0);
  });

  it("MRR averages reciprocal ranks over queries", () => {
    const q = [
      { ranked: ["b", "a"], relevant }, // 1/1
      { ranked: ["a", "d"], relevant }, // 1/2
    ];
    expect(meanReciprocalRank(q)).toBeCloseTo((1 + 0.5) / 2);
  });

  it("average precision averages precision at relevant ranks", () => {
    // relevant b(pos2), d(pos4): (1/2 + 2/4) / 2 = 0.5
    expect(averagePrecision(ranked, relevant)).toBeCloseTo(0.5);
    // perfect ranking of both relevant first: (1/1 + 2/2)/2 = 1
    expect(averagePrecision(["b", "d", "a"], relevant)).toBeCloseTo(1);
  });

  it("MAP averages AP over queries", () => {
    expect(
      meanAveragePrecision([
        { ranked: ["b", "d"], relevant }, // 1
        { ranked: ["a", "b", "d"], relevant }, // (1/2 + 2/3)/2 = 0.5833
      ]),
    ).toBeCloseTo((1 + (0.5 + 2 / 3) / 2) / 2);
  });

  it("nDCG is 1 for an ideal ranking and <1 otherwise", () => {
    const grade = (id: string) => (id === "b" ? 3 : id === "d" ? 2 : 0);
    expect(ndcgAtK(["b", "d", "a"], grade, 3)).toBeCloseTo(1);
    const bad = ndcgAtK(["a", "d", "b"], grade, 3);
    expect(bad).toBeGreaterThan(0);
    expect(bad).toBeLessThan(1);
  });

  it("dcg discounts by log2 of the rank", () => {
    const grade = (id: string) => (id === "a" ? 1 : 0);
    expect(dcgAtK(["a"], grade, 1)).toBeCloseTo(1); // 1/log2(2)=1
    expect(dcgAtK(["x", "a"], grade, 2)).toBeCloseTo(1 / Math.log2(3));
  });

  it("mean handles the empty case", () => {
    expect(mean([])).toBe(0);
    expect(mean([2, 4])).toBe(3);
  });
});
