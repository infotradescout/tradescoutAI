import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("locked landing conversion instrumentation contract", () => {
  const landingPath = path.resolve(process.cwd(), "client/src/pages/TradeScoutLandingPage.tsx");
  const directConnectShellPath = path.resolve(
    process.cwd(),
    "client/src/pages/direct-connect/DirectConnectShell.tsx"
  );
  const analyticsRoutesPath = path.resolve(process.cwd(), "server/routes/analytics-routes.ts");

  const landingSource = fs.readFileSync(landingPath, "utf8");
  const directConnectSource = fs.readFileSync(directConnectShellPath, "utf8");
  const analyticsRoutesSource = fs.readFileSync(analyticsRoutesPath, "utf8");

  it("tracks locked landing page views through demand analytics", () => {
    expect(landingSource).toContain("bootstrapDemandAttribution");
    expect(landingSource).toContain('trackDemandEvent("landing_view"');
    expect(landingSource).toContain('"locked_public_landing"');
    expect(analyticsRoutesSource).toContain('"demand.landing_view"');
  });

  it("tracks Start a Request clicks and preserves the landing request source", () => {
    expect(landingSource).toContain('trackDemandEvent("cta_click"');
    expect(landingSource).toContain('"start_request"');
    expect(landingSource).toContain('"landing_primary_cta"');
    expect(landingSource).toContain("withDemandQueryParams(LANDING_PRIMARY_REQUEST_HREF)");
    expect(analyticsRoutesSource).toContain('"demand.cta_click"');
  });

  it("attributes request composer starts back to the locked landing CTA", () => {
    expect(directConnectSource).toContain('params.get("source")');
    expect(directConnectSource).toContain("prefillSource={requestPrefill?.source}");
    expect(directConnectSource).toContain('"direct_connect_request_started"');
    expect(directConnectSource).toContain('source: prefillSource || "direct_connect_start"');
    expect(analyticsRoutesSource).toContain('"direct_connect_request_started"');
  });
});
