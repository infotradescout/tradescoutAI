import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getManagedPartnerProfileDefinition } from "@shared/managedPartnerProfileRegistry";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("ISSA Build verified full-service profile", () => {
  it("records ISSA Build as 100% verified without weakening the TradeScout inquiry funnel", () => {
    const normalizer = read("server/services/issaBuildVerifiedProfileNormalization.ts");

    expect(normalizer).toContain('ISSA_BUILD_VERIFICATION_STATUS = "fully_verified"');
    expect(normalizer).toContain("verification_percent: 100");
    expect(normalizer).toContain('verification_label: "100% Verified by TradeScout"');
    expect(normalizer).toContain('"business_identity", "full_service_capability"');
    expect(normalizer).toContain('request_routing: "tradescout_managed_inquiry_funnel"');
    expect(normalizer).toContain('service_delivery: "issa_build"');
    expect(normalizer).toContain('label: "Start a Request"');
    expect(normalizer).toContain("100% Verified by TradeScout");
  });

  it("publishes and discovers the complete ISSA Build operating scope", () => {
    const normalizer = read("server/services/issaBuildVerifiedProfileNormalization.ts");

    expect(normalizer).toContain("publicDiscoveryEnabled: true");
    for (const fact of [
      "Material selection",
      "Custom onyx fabrication",
      "Backlighting design and installation",
      "Custom onyx installation",
      "Residential and commercial projects",
      "Project consultation",
    ]) {
      expect(normalizer).toContain(fact);
    }

    expect(normalizer).toContain(
      "TradeScout manages the inquiry; ISSA Build handles material selection, custom fabrication, backlighting, and installation"
    );
  });

  it("keeps account stewardship separate from business verification", () => {
    expect(getManagedPartnerProfileDefinition("issa-build")).toMatchObject({
      archetype: "product_house",
      controlMode: "admin_stewarded_pending_owner_transfer",
      contactMode: "tradescout_managed",
      exposureMode: "public",
      requestMode: "profile_request_flow",
      requestRecipientSlug: "issa-build",
      expectedPrimaryCta: "Start a Request",
      relationshipLabel: "Verified full-service translucent onyx projects",
    });

    const notes = getManagedPartnerProfileDefinition("issa-build")?.notes || "";
    expect(notes).toContain("Fully verified independent business");
    expect(notes).toContain("does not reduce verification");
  });

  it("runs after shared contact normalization and cannot project verification to sibling profiles", () => {
    const contactPass = read("server/services/jwStoneManagedContactProvisioning.ts");
    const normalizer = read("server/services/issaBuildVerifiedProfileNormalization.ts");

    expect(contactPass).toContain("await normalizeIssaBuildVerifiedFullServiceProfile();");
    expect(
      contactPass.indexOf("await normalizeIssaBuildVerifiedFullServiceProfile();")
    ).toBeGreaterThan(contactPass.indexOf("await normalizeManagedPartnerContact(definition);"));
    expect(normalizer).toContain(".where(eq(businesses.slug, ISSA_BUILD_PROFILE_SLUG))");
    expect(normalizer).toContain(".where(eq(profiles.slug, ISSA_BUILD_PROFILE_SLUG))");
    expect(normalizer).toContain(".update(businesses)");
    expect(normalizer).toContain(".update(profiles)");
    expect(normalizer).not.toContain(".update(users)");
    expect(normalizer).not.toContain(".update(contractors)");
    expect(normalizer).not.toContain("verifiedLicensed: true");
    expect(normalizer).not.toContain("verifiedInsured: true");
  });

  it("documents the corrected public truth", () => {
    const sourceRecord = read("docs/profile-sources/ISSA_BUILD.md");

    expect(sourceRecord).toContain("100% verified");
    expect(sourceRecord).toContain("Custom onyx fabrication, including cutting and shaping");
    expect(sourceRecord).toContain("Backlighting design and installation");
    expect(sourceRecord).toContain("Custom onyx installation");
    expect(sourceRecord).toContain("TradeScout manages the inquiry funnel");
    expect(sourceRecord).toContain("only an account-control state");
    expect(sourceRecord).toContain("without transferring ISSA Build ownership");
  });
});
