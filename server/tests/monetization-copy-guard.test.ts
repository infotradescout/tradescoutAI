import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("public monetization copy guards", () => {
  it("contractor signup states $0 core message and scam warning", () => {
    const source = read("client/src/pages/contractor-signup.tsx");

    expect(source).toContain("features, connections, and information is $0");
    expect(source).toContain("unlabeled payment requests");
    expect(source).not.toContain("only pay for quality leads");
  });

  it("comparison pages avoid pay-on-completion contractor claims", () => {
    const angi = read("client/src/pages/compare-angi.tsx");
    const homeAdvisor = read("client/src/pages/compare-homeadvisor.tsx");

    expect(angi).toContain(
      "no contractor lead fees, no monthly subscription, and no post-job contractor fee"
    );
    expect(homeAdvisor).toContain(
      "no contractor lead fees, no monthly subscription, and no post-job contractor fee"
    );

    expect(angi).not.toContain("pay-on-completion");
    expect(homeAdvisor).not.toContain("pay-on-completion");
    expect(angi).not.toContain("fee only on completed work");
    expect(homeAdvisor).not.toContain("fee only on completed work");
  });

  it("pricing page keeps explicit no-fee language", () => {
    const pricing = read("client/src/pages/pricing.tsx");

    expect(pricing).toContain("$0 for access to TradeScout features, connections, and information");
    expect(pricing).toContain("Payment Safety Notice");
    expect(pricing).toContain("outside clearly labeled checkout");
  });

  it("core trust pages include paid-exception and scam-safety language", () => {
    const howItWorks = read("client/src/pages/how-it-works.tsx");
    const directConnectInfo = read("client/src/pages/direct-connect-info.tsx");
    const landing = read("client/src/pages/landing.tsx");

    expect(howItWorks).toContain(
      "does not sell leads or charge for access to features, connections, or information"
    );
    expect(howItWorks).toContain("separate optional products and connected platforms");
    expect(howItWorks).toContain("treated as a scam");

    expect(directConnectInfo).toContain("features, connections, and information is $0");
    expect(directConnectInfo).toContain("What payment requests are legitimate?");
    expect(directConnectInfo).toContain("treated as a scam");

    expect(landing).toContain("$0 access to features, connections, and information");
    expect(landing).toContain(
      "Revenue comes from separate optional products and connected platforms"
    );
    expect(landing).not.toContain("no payment model at all");
  });

  it("terms page states no-charge-for-access with labeled optional paid products", () => {
    const terms = read("client/src/pages/legal/terms-of-service.tsx");
    const paymentProcessing = read("client/src/pages/payment-processing.tsx");

    expect(terms).toContain("Access to TradeScout features, connections, and information is $0");
    expect(terms).toContain(
      "Optional paid products/services are clearly disclosed before checkout"
    );
    expect(terms).toContain(
      "Any payment request outside labeled checkout should be treated as fraud"
    );

    expect(paymentProcessing).toContain(
      "Access to TradeScout features, connections, and information is $0"
    );
    expect(paymentProcessing).toContain("separate optional products and connected platforms");
  });
});
