import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("business claim/profile entry contracts", () => {
  const appRoutes = read("client/src/AppRoutes.tsx");
  const claimPage = read("client/src/pages/claim-my-business.tsx");
  const applyPage = read("client/src/pages/contractor-apply.tsx");
  const businessProfileView = read("client/src/pages/BusinessProfileView.tsx");
  const compatibilityRedirects = read("client/src/routing/compatibilityRedirects.ts");

  it("keeps one canonical claims-first entry and redirects every legacy apply alias to it", () => {
    expect(appRoutes).toContain('<Route path="/claim-my-business">');
    expect(appRoutes).toContain("<LazyPage Component={ClaimMyBusiness} />");
    expect(appRoutes).toContain('<Route path="/businesses/apply">');
    expect(appRoutes).toContain(
      '<RedirectTo to="/claim-my-business?source=businesses_apply_legacy" />'
    );
    expect(compatibilityRedirects).toContain('from: "/contractors/apply"');
    expect(compatibilityRedirects).toContain('from: "/contractor-apply"');
    expect(compatibilityRedirects).not.toContain('to: "/businesses/apply"');
    expect(compatibilityRedirects).not.toContain('to: "/onboarding?lane=offer_services"');
  });

  it("frames claim and apply entry as broad business/provider surfaces while preserving contractor compatibility detail", () => {
    expect(claimPage).toContain("Claim from Google Maps");
    expect(claimPage).toContain("verify ownership before the");
    expect(claimPage).toContain("business attaches to your account");
    expect(claimPage).toContain("Create a claimable shell from the Maps listing");

    expect(applyPage).toContain("Create Business Account to Apply");
    expect(applyPage).toContain("Join TradeScout as a verified business or service provider");
    expect(applyPage).toContain("Business & Provider Application | Join TradeScout");
    expect(applyPage).toContain("Join TradeScout as a Business or Provider");
    expect(applyPage).toContain("Business / Provider Application");
    expect(applyPage).toContain("Direct Connect requests from your community");
    expect(applyPage).toContain("verified local businesses, providers, and contractor specialties");

    expect(applyPage).toContain("Contractor Type");
    expect(applyPage).toContain("General Contractor");
    expect(applyPage).toContain("Residential Contractor");
    expect(applyPage).toContain("contractor guidelines");
  });

  it("keeps business profile entry paths compatible beside Direct Connect", () => {
    expect(businessProfileView).toContain("const directConnectUrl = `/direct-connect?");
    expect(businessProfileView).toContain("const claimUrl = `/claim-my-business?");
    expect(businessProfileView).toContain(
      'value: "Keep the business and county context together."'
    );
    expect(businessProfileView).toContain("Claim or connect");
    expect(businessProfileView).toContain(
      "Direct Connect keeps job context, fit review, and contact in one flow."
    );
    expect(businessProfileView).toContain("Claim with Google Maps");
  });

  it("blocks chatbot, lead-selling, pay-to-play, and internal architecture framing across entry surfaces", () => {
    const combined = [claimPage, applyPage, businessProfileView].join("\n").toLowerCase();

    expect(combined).not.toContain("scout chatbot");
    expect(combined).not.toContain("lead-selling");
    expect(combined).not.toContain("lead selling");
    expect(combined).not.toContain("pay-to-play");
    expect(combined).not.toContain("routing algorithm");
    expect(combined).not.toContain("authority layer");
    expect(combined).not.toContain("backend routing system");
    expect(combined).not.toContain("handoff doctrine");
    expect(combined).not.toContain("operating system architecture");
  });
});
