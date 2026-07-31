import { describe, it, expect } from "vitest";
import {
  mean,
  variance,
  std,
  normalCdf,
  twoSidedP,
  chiSquare1SF,
  percentile,
  bootstrapCI,
  binomTwoSidedP,
  mcnemar,
  wilcoxonSignedRank,
  cohensKappa,
  holmBonferroni,
} from "@/lib/eval/stats.mjs";

describe("descriptive stats", () => {
  it("mean, sample variance, std", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(variance([2, 4, 6])).toBe(4); // ((-2)^2+0+2^2)/(3-1)
    expect(std([2, 4, 6])).toBe(2);
  });
  it("percentile interpolates", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5);
    expect(percentile([1, 2, 3, 4], 0)).toBe(1);
  });
});

describe("normal / chi-square tails", () => {
  it("normalCdf at known points", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
  });
  it("two-sided p from z=1.96 is ~0.05", () => {
    expect(twoSidedP(1.96)).toBeCloseTo(0.05, 2);
  });
  it("chi-square(1) at 3.841 has tail ~0.05", () => {
    expect(chiSquare1SF(3.841)).toBeCloseTo(0.05, 2);
  });
});

describe("McNemar's test", () => {
  it("exact two-sided binomial for small discordant counts", () => {
    // b=1, c=9: p = 2*(C(10,0)+C(10,1))/2^10 = 22/1024
    expect(binomTwoSidedP(1, 10)).toBeCloseTo(22 / 1024, 6);
    const r = mcnemar(1, 9);
    expect(r.method).toBe("exact");
    expect(r.p).toBeCloseTo(22 / 1024, 6);
  });
  it("uses continuity-corrected chi-square for larger discordant counts", () => {
    const r = mcnemar(25, 5); // n=30 >= 25
    expect(r.method).toBe("chi2cc");
    expect(r.statistic).toBeCloseTo((Math.abs(25 - 5) - 1) ** 2 / 30, 5);
    expect(r.p).toBeLessThan(0.001);
  });
  it("no discordant pairs → p=1", () => {
    expect(mcnemar(0, 0).p).toBe(1);
  });
});

describe("Wilcoxon signed-rank", () => {
  it("drops zeros and splits rank sums", () => {
    const r = wilcoxonSignedRank([1, 2, 3]);
    expect(r.n).toBe(3);
    expect(r.wPlus + r.wMinus).toBe((3 * 4) / 2); // total rank sum
    expect(r.W).toBe(0);
  });
  it("is symmetric under sign flip", () => {
    const a = wilcoxonSignedRank([1, 2, 3, 4]);
    const b = wilcoxonSignedRank([-1, -2, -3, -4]);
    expect(b.p).toBeCloseTo(a.p, 10);
  });
  it("all-zero differences → p=1", () => {
    expect(wilcoxonSignedRank([0, 0, 0]).p).toBe(1);
  });
});

describe("Cohen's kappa", () => {
  it("perfect agreement → 1", () => {
    expect(cohensKappa([1, 0, 1, 0], [1, 0, 1, 0]).kappa).toBeCloseTo(1);
  });
  it("chance-level agreement → ~0", () => {
    expect(cohensKappa([1, 1, 0, 0], [1, 0, 1, 0]).kappa).toBeCloseTo(0, 10);
  });
  it("partial agreement matches hand calculation", () => {
    // po=0.8, pe=0.48 → kappa=0.32/0.52
    const r = cohensKappa([1, 1, 1, 0, 0], [1, 1, 0, 0, 0]);
    expect(r.po).toBeCloseTo(0.8);
    expect(r.kappa).toBeCloseTo(0.32 / 0.52, 6);
  });
});

describe("Holm–Bonferroni", () => {
  it("adjusts p-values in original order, monotone and capped", () => {
    expect(holmBonferroni([0.01, 0.04, 0.03])).toEqual([
      expect.closeTo(0.03, 10),
      expect.closeTo(0.06, 10),
      expect.closeTo(0.06, 10),
    ]);
  });
});

describe("bootstrap CI", () => {
  it("is deterministic for a fixed seed and brackets the point estimate", () => {
    const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = bootstrapCI(vals, { seed: 42, iterations: 1000 });
    const b = bootstrapCI(vals, { seed: 42, iterations: 1000 });
    expect(a).toEqual(b); // reproducible
    expect(a.point).toBeCloseTo(5.5);
    expect(a.lo).toBeLessThan(a.point);
    expect(a.hi).toBeGreaterThan(a.point);
  });
});
