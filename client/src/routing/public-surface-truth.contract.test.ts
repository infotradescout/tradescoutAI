import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public surface truth contracts", () => {
  it("keeps all three working calculators reachable", () => {
    const routes = read("client/src/AppRoutes.tsx");

    expect(routes).toMatch(
      /<Route path="\/car-sales-financing">[\s\S]{0,160}Component=\{CarSalesFinancing\}/
    );
    expect(routes).toMatch(
      /<Route path="\/car-sales-payment-calculator">[\s\S]{0,160}Component=\{CarSalesPaymentCalculator\}/
    );
    expect(routes).toMatch(
      /<Route path="\/realtor-calculator">[\s\S]{0,160}Component=\{RealtorCalculator\}/
    );
  });

  it("wires the calculator pages to tested financial logic without inert quote actions", () => {
    const financing = read("client/src/pages/car-sales-financing.tsx");
    const payment = read("client/src/pages/car-sales-payment-calculator.tsx");
    const realtor = read("client/src/pages/realtor-calculator.tsx");

    expect(financing).toContain("calculateAmortizedLoan");
    expect(payment).toContain("calculateAutoLoan");
    expect(payment).toContain("calculateAmortizedLoan");
    expect(realtor).toContain("calculateAmortizedLoan");
    expect(realtor).toContain("calculateCommission");
    expect(realtor).toContain("calculateAffordableHomePrice");

    expect(financing).not.toMatch(/Prime Auto Credit|Submit Application|Start New Application/);
    expect(payment).not.toMatch(/button-generate-quote|button-compare-options/);
    expect(realtor).not.toContain("button-generate-amortization");
  });

  it("sends every visible event shortcut to the Community event composer", () => {
    const socialFrame = read("client/src/components/layout/AuthenticatedSocialFrame.tsx");
    const comprehensiveNav = read("client/src/components/navigation/ComprehensiveNav.tsx");
    const target = "/community-feed?compose=1&category=event";

    expect(socialFrame).toContain(target);
    expect(comprehensiveNav).toContain(target);
    expect(socialFrame).not.toContain('href: "/event-management"');
    expect(comprehensiveNav).not.toContain('href: "/event-management"');
  });
});
