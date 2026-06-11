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

  it("attributes request submissions back to the locked landing CTA when source is present", () => {
    expect(directConnectSource).toContain('"direct_connect_request_submitted"');
    expect(directConnectSource).toContain("source: prefillSource || null");
    expect(analyticsRoutesSource).toContain('"direct_connect_request_submitted"');
  });

  it("keeps forbidden old landing copy out of the locked public landing", () => {
    expect(landingSource).toContain("Connection Without Compromise");
    expect(landingSource).toContain("Start a Request");
    expect(landingSource).toContain("Direct Connect");
    expect(landingSource).not.toContain("Ask Scout");
    expect(landingSource).not.toContain("Scout routes");
    expect(landingSource).not.toContain("Find Any Local Business Near You");
    expect(landingSource).not.toContain("Scout interprets");
    expect(landingSource).not.toContain("Get started with Scout");
    expect(landingSource).not.toContain("routing algorithm");
    expect(landingSource).not.toContain("authority layer");
    expect(landingSource).not.toContain("handoff doctrine");
    expect(landingSource).not.toContain("backend routing system");
    expect(landingSource).not.toContain("operating system architecture");
  });
});
