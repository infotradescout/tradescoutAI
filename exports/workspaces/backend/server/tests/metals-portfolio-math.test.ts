import { describe, expect, it } from "vitest";
import { computeMetalsPortfolioSummary } from "../services/metalsPortfolioMath";

describe("Metals portfolio math", () => {
  it("computes average-cost holdings and P/L", () => {
    const summary = computeMetalsPortfolioSummary(
      [
        { direction: "buy", metalCode: "XAU", quantityOz: 2, totalUsd: 4000, executedAtMs: 1 },
        { direction: "buy", metalCode: "XAU", quantityOz: 1, totalUsd: 2500, executedAtMs: 2 },
        { direction: "sell", metalCode: "XAU", quantityOz: 1, totalUsd: 2600, executedAtMs: 3 },
      ],
      { XAU: 3000 }
    );

    const xau = summary.metals.find((m) => m.metalCode === "XAU");
    expect(xau).toBeTruthy();
    expect(xau!.quantityOz).toBeCloseTo(2, 6);
    // Avg cost: (4000+2500)/3 = 2166.6667; after selling 1oz, remaining cost basis = 4333.33
    expect(xau!.costBasisUsd).toBeCloseTo(4333.33, 2);
    // Realized: sell proceeds - removed cost (2600 - 2166.67) = 433.33
    expect(xau!.realizedUsd).toBeCloseTo(433.33, 2);
    expect(xau!.marketValueUsd).toBeCloseTo(6000, 2);
    expect(xau!.unrealizedUsd).toBeCloseTo(1666.67, 2);
  });

  it("returns null market values when price is missing", () => {
    const summary = computeMetalsPortfolioSummary(
      [{ direction: "buy", metalCode: "OTHER", quantityOz: 1, totalUsd: 10, executedAtMs: 1 }],
      {}
    );

    const other = summary.metals.find((m) => m.metalCode === "OTHER");
    expect(other).toBeTruthy();
    expect(other!.marketValueUsd).toBeNull();
    expect(other!.unrealizedUsd).toBeNull();
  });
});
