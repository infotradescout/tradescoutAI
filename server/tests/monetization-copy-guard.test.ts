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
    expect(source).toContain("Unlabeled payment requests");
    expect(source).not.toContain("only pay for quality leads");
  });

  it("comparison pages avoid pay-on-completion contractor claims", () => {
    const compareHub = read("client/src/pages/compare.tsx");
    const angi = read("client/src/pages/compare-angi.tsx");
    const homeServices = read("client/src/pages/compare-home-services.tsx");
    const leadGeneration = read("client/src/pages/compare-lead-generation.tsx");
    const realEstate = read("client/src/pages/compare-real-estate.tsx");
    const homeAdvisor = read("client/src/pages/compare-homeadvisor.tsx");

    expect(compareHub).toContain("does not sell leads");
    expect(angi).toContain("does not sell leads");
    expect(homeServices).toContain("does not sell leads");
    expect(leadGeneration).toContain("does not sell leads");
    expect(realEstate).toContain("does not sell leads");
    expect(homeAdvisor).toContain("does not sell leads");
    expect(compareHub).toContain("does not charge to connect");
    expect(angi).toContain("does not charge to connect");
    expect(homeServices).toContain("does not charge to connect");
    expect(leadGeneration).toContain("does not charge to connect");
    expect(realEstate).toContain("does not charge to connect");
    expect(homeAdvisor).toContain("does not charge to connect");

    expect(compareHub).not.toContain("pay-on-completion");
    expect(angi).not.toContain("pay-on-completion");
    expect(homeServices).not.toContain("pay-on-completion");
    expect(leadGeneration).not.toContain("pay-on-completion");
    expect(realEstate).not.toContain("pay-on-completion");
    expect(homeAdvisor).not.toContain("pay-on-completion");
    expect(compareHub).not.toContain("fee only on completed work");
    expect(angi).not.toContain("fee only on completed work");
    expect(homeServices).not.toContain("fee only on completed work");
    expect(leadGeneration).not.toContain("fee only on completed work");
    expect(realEstate).not.toContain("fee only on completed work");
    expect(homeAdvisor).not.toContain("fee only on completed work");
  });

  it("pricing page keeps explicit no-fee language", () => {
    const pricing = read("client/src/pages/pricing.tsx");

    expect(pricing).toContain("TradeScout is free forever");
    expect(pricing).toContain(
      "without a subscription, access tier, lead fee, or charge to connect"
    );
    expect(pricing).toContain("do not pay them. That is not TradeScout");
  });

  it("core trust pages include paid-exception and scam-safety language", () => {
    const howItWorks = read("client/src/pages/how-it-works.tsx");
    const directConnectInfo = read("client/src/pages/direct-connect-info.tsx");
    const landing = read("client/src/pages/landing.tsx");

    expect(howItWorks).toContain("does not sell leads");
    expect(howItWorks).toContain("does not charge to connect");
    expect(howItWorks).toContain("is a scam");

    expect(directConnectInfo).toContain("never charges to connect");
    expect(directConnectInfo).toContain("What payment requests are legitimate?");
    expect(directConnectInfo).toContain("scam");

    expect(landing).toContain("No lead sales");
    expect(landing).toContain("claiming to unlock access, ranking, or visibility is a scam");
  });

  it("terms page states no-charge-for-access with labeled optional paid products", () => {
    const terms = read("client/src/pages/legal/terms-of-service.tsx");
    const paymentProcessing = read("client/src/pages/payment-processing.tsx");

    expect(terms).toContain("Access to TradeScout features, connections, and information is $0");
    expect(terms).toContain(
      "Any payment request outside labeled checkout should be treated as fraud"
    );

    expect(paymentProcessing).toContain(
      "Access to TradeScout features, connections, and information is $0"
    );
    expect(paymentProcessing).toContain("Legitimate checkouts");
  });
});
