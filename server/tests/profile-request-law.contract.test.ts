import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("anonymous public-profile request law", () => {
  const route = read("server/routes/tradepartner-express.ts");
  const decisionService = read("server/services/profileRequestDecisionService.ts");
  const confirmationService = read("server/services/profileRequestConfirmation.ts");
  const cleanupWorker = read("server/services/profileRequestDecisionCleanupWorker.ts");
  const serverLifecycle = read("server/index.ts");
  const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
  const redProfile = read("client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx");
  const migration = read("migrations/0128_profile_request_decision_proofs.sql");

  it("stages anonymous intent with a generic 202 before any requester lookup or mutation", () => {
    const anonymousStart = route.indexOf("if (!viewerId) {");
    const requesterStart = route.indexOf("let requester = await storage.getUser(viewerId)");
    const anonymousBranch = route.slice(anonymousStart, requesterStart);

    expect(anonymousStart).toBeGreaterThan(0);
    expect(requesterStart).toBeGreaterThan(anonymousStart);
    expect(anonymousBranch).toContain("profileRequestDecisionService.stage({");
    expect(anonymousBranch).toContain("return res.status(202).json({");
    expect(anonymousBranch).toContain('status: "decision_required"');
    expect(anonymousBranch).not.toContain("storage.getUser");
    expect(anonymousBranch).not.toContain("storage.getUserByEmail");
    expect(anonymousBranch).not.toContain("storage.createUser");
    expect(anonymousBranch).not.toContain("storage.updateUser");
    const responseStart = anonymousBranch.indexOf("return res.status(202).json({");
    const response = anonymousBranch.slice(responseStart);
    expect(response).not.toContain("accountCreated:");
    expect(response).not.toContain("deliveryCustody:");
  });

  it("binds the opaque proof to one browser session, source, and exact target", () => {
    expect(route).toContain(
      'const PROFILE_REQUEST_SESSION_NONCE_KEY = "profileRequestDecisionNonce"'
    );
    expect(route).toContain("hashProfileRequestSessionBinding(nonce)");
    expect(decisionService).toContain('createHmac("sha256", secret)');
    expect(decisionService).toContain('row.status !== "pending" || row.consumed_at');
    expect(decisionService).toContain("secureHexEqual(row.session_binding_hash");
    expect(decisionService).toContain("row.source !== PROFILE_REQUEST_SOURCE");
    expect(decisionService).toContain("normalizeSlug(row.target_profile_slug) !== expectedSlug");
    expect(decisionService).toContain("row.target_profile_id !== row.profile_id");
    expect(decisionService).toContain("row.target_business_id !== row.business_id");
    expect(decisionService).toContain("row.target_owner_user_id !== row.owner_user_id");
  });

  it("locks every mutable authority row and consumes proof in the winning transaction", () => {
    expect(decisionService).toContain("FOR UPDATE OF decision, profile, business, owner_account");
    expect(decisionService.indexOf("FOR UPDATE OF decision")).toBeLessThan(
      decisionService.indexOf("const result = await finalize")
    );
    expect(decisionService).toContain("AND status = 'pending'");
    expect(decisionService).toContain("AND consumed_at IS NULL");
    expect(decisionService).toContain("request_payload = '{}'::jsonb");
    expect(confirmationService).toContain("assertTargetAuthority(decision)");
    const finalizeStart = confirmationService.indexOf(
      "export async function finalizeConfirmedAnonymousProfileRequest"
    );
    const finalizeBody = confirmationService.slice(finalizeStart);
    expect(finalizeBody.indexOf("assertTargetAuthority(decision)")).toBeLessThan(
      finalizeBody.indexOf("resolveRequesterInsideConfirmation(")
    );
    const confirmationRoute = route.slice(
      route.indexOf('"/api/tradepartner-profiles/:slug/express-request/confirm"'),
      route.indexOf('"/api/tradepartner-profiles/:slug/express-request"', route.indexOf("confirm"))
    );
    expect(
      confirmationRoute.indexOf("const confirmed = await confirmAnonymousProfileRequest")
    ).toBeLessThan(
      confirmationRoute.indexOf("delivery = await deliverConfirmedAnonymousProfileRequest")
    );
    expect(confirmationRoute).toContain("confirmed request delivery failed after commit");
    expect(confirmationRoute).toContain("return res.status(201).json({");
  });

  it("keeps confirmation immutable in both public-profile clients", () => {
    for (const source of [panel, redProfile]) {
      expect(source).toContain("/express-request/confirm");
      expect(source).toContain('authorityGate: "decision_card"');
      expect(source).toContain('source: "tradepartner_profile"');
      expect(source).toContain("decisionProof,");
      const confirmBodyStart = source.indexOf('authorityGate: "decision_card"');
      const confirmBody = source.slice(confirmBodyStart, confirmBodyStart + 220);
      expect(confirmBody).not.toContain("email:");
      expect(confirmBody).not.toContain("phone:");
      expect(confirmBody).not.toContain("message:");
    }
  });

  it("ships a forward-only short-lived proof table without rewriting history", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.profile_request_decision_proofs"
    );
    expect(migration).toContain("proof_hash varchar(64) NOT NULL");
    expect(migration).toContain("session_binding_hash varchar(64) NOT NULL");
    expect(migration).toContain("CHECK (authority_gate = 'decision_card')");
    expect(migration).toContain("CHECK (source = 'tradepartner_profile')");
    expect(migration).toContain("rename this file/journal tag to 0131");
  });

  it("drains expired proof state independently of the optional scheduler", () => {
    expect(cleanupWorker).toContain('this.drainSafely("startup")');
    expect(cleanupWorker).toContain('this.drainSafely("interval")');
    expect(cleanupWorker).toContain('this.drainSafely("shutdown")');
    expect(cleanupWorker).toContain("if (this.inFlight) return this.inFlight");
    expect(serverLifecycle).toContain("await startProfileRequestDecisionCleanupWorker()");
    expect(serverLifecycle).toContain(
      "await stopProfileRequestDecisionCleanupWorker({ drain: true })"
    );
    expect(serverLifecycle.indexOf("await stopProfileRequestDecisionCleanupWorker")).toBeLessThan(
      serverLifecycle.indexOf("void pool.end()")
    );
  });
});
