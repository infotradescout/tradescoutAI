import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("ISSA Build verified public renderer", () => {
  it("routes ISSA Build through its verified full-service frame", () => {
    const dispatcher = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");

    expect(dispatcher).toContain('normalizedSlug === ISSA_BUILD_PROFILE_SLUG');
    expect(dispatcher).toContain("<IssaBuildProfileTruthFrame {...props} />");
  });

  it("shows the verified scope and keeps TradeScout as the inquiry funnel", () => {
    const renderer = read("client/src/pages/profile-sites/IssaBuildProfileTruthFrame.tsx");

    expect(renderer).toContain("100% Verified by TradeScout");
    expect(renderer).toContain("Material selection");
    expect(renderer).toContain("Material sourcing and availability");
    expect(renderer).toContain("Custom onyx fabrication");
    expect(renderer).toContain("Backlighting design and installation");
    expect(renderer).toContain("Custom onyx installation");
    expect(renderer).toContain("Residential and commercial projects");
    expect(renderer).toContain("Project fulfillment");
    expect(renderer).toContain("TradeScout manages every inquiry. ISSA Build handles the work.");
    expect(renderer).toContain("Start a Request");
    expect(renderer).toContain("<ExpressDirectConnectPanel");
    expect(renderer).toContain('initialView="request"');
    expect(renderer).toContain('initialRequestType="request_quote"');
  });

  it("does not reduce ISSA Build to a referral-only or material-only role", () => {
    const renderer = read("client/src/pages/profile-sites/IssaBuildProfileTruthFrame.tsx").toLowerCase();

    expect(renderer).not.toContain("referral-only");
    expect(renderer).not.toContain("material-only");
    expect(renderer).not.toContain("consultation-only");
    expect(renderer).not.toContain("verification pending");
    expect(renderer).not.toContain("pending transfer");
  });
});
