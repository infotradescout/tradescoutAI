import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routes = fs.readFileSync(path.resolve(process.cwd(), "server/routes.ts"), "utf8");
const measurement = fs.readFileSync(
  path.resolve(process.cwd(), "server/services/acquisitionMeasurement.ts"),
  "utf8"
);
const onboarding = fs.readFileSync(
  path.resolve(process.cwd(), "server/routes/onboarding.ts"),
  "utf8"
);
const migration = fs.readFileSync(
  path.resolve(process.cwd(), "migrations/0121_organic_acquisition_measurement.sql"),
  "utf8"
);
const schema = fs.readFileSync(path.resolve(process.cwd(), "shared/schema.ts"), "utf8");
const auth = fs.readFileSync(path.resolve(process.cwd(), "server/auth.ts"), "utf8");
const preScout = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/pre-scout-setup.tsx"),
  "utf8"
);

describe("registration acquisition authority contract", () => {
  it("records both registration flows only after login succeeds", () => {
    const multiStart = routes.indexOf("req.login(created.user, async (err)");
    const multiEnd = routes.indexOf("    } catch (error: any)", multiStart);
    const multiCallback = routes.slice(multiStart, multiEnd);
    expect(multiCallback.indexOf("if (err)")).toBeGreaterThanOrEqual(0);
    expect(multiCallback.indexOf('flow: "multi_profile"')).toBeGreaterThan(
      multiCallback.indexOf("if (err)")
    );

    const standardStart = routes.indexOf("req.login(userForLogin, async (err)");
    const standardEnd = routes.indexOf("    } catch (error: any)", standardStart);
    const standardCallback = routes.slice(standardStart, standardEnd);
    expect(standardCallback.indexOf("if (err)")).toBeGreaterThanOrEqual(0);
    expect(standardCallback.indexOf('flow: "standard"')).toBeGreaterThan(
      standardCallback.indexOf("if (err)")
    );
  });

  it("rejects client-declared signup completion on the public attribution route", () => {
    expect(routes).toContain('if (conversionType === "signup_completed")');
    expect(routes).toContain('code: "SERVER_CONFIRMED_SIGNUP_REQUIRED"');
  });

  it("uses the canonical partial unique index for indexed lifetime idempotence", () => {
    expect(migration).toContain("idx_events_acquisition_lifecycle_user_unique");
    expect(migration).toContain("acquisition.registration_completed");
    expect(migration).toContain("acquisition.activation_completed");
    expect(schema).toContain('uniqueIndex("idx_events_acquisition_lifecycle_user_unique")');
    expect(measurement).toContain("on conflict do nothing");
    expect(measurement).toContain("returning id");
    expect(measurement).not.toContain("select id\n         from events");
    expect(measurement).toContain("data->>'serverConfirmed' = 'true'");
    expect(measurement).toContain("data->>'projectionOf' = 'users.created_at'");
  });

  it("records only newly created Google and Facebook accounts", () => {
    expect(routes).toContain("_wasNewSocialUser = isNewUser");
    expect(auth).toContain("_wasNewSocialUser = true");
    expect(auth.match(/_wasNewSocialUser = false/g)?.length).toBeGreaterThanOrEqual(2);
    expect(routes).toContain('flow: "oauth_google"');
    expect(routes).toContain('flow: "oauth_facebook"');
    expect(routes).toContain("isNewSocialRegistrationUser(user)");
    expect(routes).toContain("stageOAuthDiscoveryHandoff(req)");
    expect(auth).toContain('provider: "facebook"');
    expect(auth).toContain("providerId: profile.id");
    expect(auth).toContain("if (!user.provider)");
    expect(auth).toContain('user.provider === "facebook"');
  });

  it("carries only the bounded signed discovery token through local and OAuth signup", () => {
    expect(preScout).toContain("normalizeDiscoveryAttributionToken");
    expect(preScout).toContain("DISCOVERY_ATTRIBUTION_HANDOFF_PARAM");
    expect(preScout).toContain("params.set(DISCOVERY_ATTRIBUTION_HANDOFF_PARAM");
    expect(preScout).toContain("{ discoveryAttributionToken }");
    expect(routes).toContain("stageAcquisitionDiscoveryTokenHandoff(req, rawToken)");
    expect(routes).not.toContain("req.query.businessSlug");
    expect(routes).not.toContain("req.query.sourceHint");
  });

  it("records activation only after canonical outcome completion succeeds", () => {
    const routeStart = onboarding.indexOf('router.post("/api/onboarding/complete"');
    const routeEnd = onboarding.indexOf("// GET /api/onboarding/status", routeStart);
    const canonicalRoute = onboarding.slice(routeStart, routeEnd);
    const completion = canonicalRoute.indexOf("await completeOutcomeOnboarding");
    const activation = canonicalRoute.indexOf("await recordServerConfirmedActivation");
    const response = canonicalRoute.indexOf("return res.json({ success: true, result })");

    expect(completion).toBeGreaterThan(-1);
    expect(activation).toBeGreaterThan(completion);
    expect(response).toBeGreaterThan(activation);
    const activationCall = canonicalRoute.slice(activation, response);
    expect(activationCall).toMatch(/resultClass:\s*result\.kind === "business_profile"/);
    expect(activationCall).not.toContain("parsed.goal");
    expect(activationCall).not.toContain("parsed.business");
    expect(activationCall).toContain("Activation measurement failed soft");

    const retiredStepRoute = onboarding.slice(
      onboarding.indexOf('router.post("/api/onboarding/complete-step"'),
      routeStart
    );
    expect(retiredStepRoute).not.toContain("recordServerConfirmedActivation");
  });
});
