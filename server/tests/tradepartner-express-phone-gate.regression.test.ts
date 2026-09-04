import fs from "node:fs";
import path from "node:path";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { registerTradePartnerExpressRoutes } from "../routes/tradepartner-express";

const app = express();
app.use(express.json());
registerTradePartnerExpressRoutes(app);

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public Express Direct Connect phone gate", () => {
  it.each([
    {},
    { authorityGate: "profile_direct_connect", decision: "call" },
    {
      authorityGate: "profile_direct_connect",
      decision: "call",
      phone: "+1 404 555 0100",
      tel: "tel:+14045550100",
    },
  ])("never returns raw provider contact for an unauthenticated caller (%#)", async (body) => {
    const response = await request(app)
      .post("/api/tradepartner-profiles/public-profile/express-contact/reveal")
      .send(body);

    expect(response.status).toBe(410);
    expect(response.body).toEqual({
      code: "DIRECT_CONNECT_REQUEST_REQUIRED",
      contactPreference: "call",
      nextAction: "submit_express_request",
      message:
        "Contact is only shared through a submitted Direct Connect request to the exact business.",
    });
    expect(response.body).not.toHaveProperty("phone");
    expect(response.body).not.toHaveProperty("tel");
    expect(JSON.stringify(response.body)).not.toContain("tel:");
    expect(JSON.stringify(response.body)).not.toContain("14045550100");
  });

  it("does not resolve provider phone data for the public Express route", () => {
    const route = read("server/routes/tradepartner-express.ts");

    expect(route).not.toContain("normalizeDirectConnectPhone");
    expect(route).not.toContain("ownerPhone: users.phone");
    expect(route).not.toContain("profileData.phone || row?.ownerPhone");
    expect(route).not.toContain("target.phone");
  });

  it("persists call with requester contact consent before the assigned provider response", () => {
    const route = read("server/routes/tradepartner-express.ts");
    const responseStart = route.indexOf("return res.status(201).json({");
    const responseEnd = route.indexOf("});", responseStart);
    const preAuthorizationResponse = route.slice(responseStart, responseEnd);

    expect(route).toContain('contactPreference: z.enum(["platform_message", "call"])');
    expect(route).toContain("contactPreference: body.contactPreference");
    expect(route).toContain("createExpressDirectConnectAuthority(tx, {");
    expect(route).toContain("sourceDecisionCardId: authority.sourceDecisionCardId");
    expect(route).toContain("contactPermissionId: authority.contactPermissionId");
    expect(route).toContain("contactReleaseState: authority.contactGateState");
    expect(route).toContain('status: "invited"');
    expect(route).toContain('type: "provider_invited"');
    expect(responseStart).toBeGreaterThanOrEqual(0);
    expect(preAuthorizationResponse).not.toContain("phone");
    expect(preAuthorizationResponse).not.toContain("tel");
  });

  it("never launches a tel URL from the public profile panel", () => {
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");

    expect(panel).toContain('setRequestedContactPreference("call")');
    expect(panel).toContain("contactPreference: requestedContactPreference");
    expect(panel).toContain("They receive your name and phone");
    expect(panel).not.toContain("/express-contact/reveal");
    expect(panel).not.toContain("json?.tel");
    expect(panel).not.toContain("window.location.href");
    expect(panel).not.toContain("href={callTel}");
    expect(panel).not.toContain('view === "call_started"');
  });
});
