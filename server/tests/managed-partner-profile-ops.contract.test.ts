import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getManagedPartnerProfileDefinition,
  MANAGED_PARTNER_PROFILE_DEFINITIONS,
} from "@shared/managedPartnerProfileRegistry";
import { ISSA_BUILD_MANAGED_CONTACT } from "@shared/issaBuildManagedContact";
import { JW_STONE_MANAGED_CONTACT } from "@shared/jwStonePresentation";
import { RED_GRANITI_MANAGED_CONTACT } from "@shared/redGranitiProfile";
import { TRADESCOUT_MANAGED_CONTACT } from "@shared/tradeScoutManagedContact";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("concurrent managed partner profile operations", () => {
  it("keeps the five established profiles in the permanent registry", () => {
    expect(MANAGED_PARTNER_PROFILE_DEFINITIONS).toHaveLength(5);
    expect(new Set(MANAGED_PARTNER_PROFILE_DEFINITIONS.map((item) => item.slug)).size).toBe(5);
    expect(MANAGED_PARTNER_PROFILE_DEFINITIONS.map((item) => item.slug)).toEqual([
      "red-graniti",
      "jw-stone",
      "issa-build",
      "property-blessings",
      "precision-aerial-services",
    ]);

    expect(getManagedPartnerProfileDefinition(" RED-GRANITI ")?.requestRecipientSlug).toBe(
      "jw-stone"
    );
    expect(getManagedPartnerProfileDefinition("missing-profile")).toBeNull();
  });

  it("centralizes the managed phone and email without flattening profile ownership", () => {
    expect(TRADESCOUT_MANAGED_CONTACT).toEqual({
      label: "TradeScout managed contact",
      phone: "(850) 543-0748",
      tel: "+18505430748",
      email: "contact@thetradescout.com",
      description: "Calls and messages from this profile are handled through TradeScout.",
    });
    expect(ISSA_BUILD_MANAGED_CONTACT.phone).toBe(TRADESCOUT_MANAGED_CONTACT.phone);
    expect(ISSA_BUILD_MANAGED_CONTACT.email).toBe(TRADESCOUT_MANAGED_CONTACT.email);
    expect(JW_STONE_MANAGED_CONTACT.phone).toBe(TRADESCOUT_MANAGED_CONTACT.phone);
    expect(JW_STONE_MANAGED_CONTACT.email).toBe(TRADESCOUT_MANAGED_CONTACT.email);
    expect(RED_GRANITI_MANAGED_CONTACT.phone).toBe(TRADESCOUT_MANAGED_CONTACT.phone);
    expect(RED_GRANITI_MANAGED_CONTACT.email).toBe(TRADESCOUT_MANAGED_CONTACT.email);

    const jw = getManagedPartnerProfileDefinition("jw-stone");
    const red = getManagedPartnerProfileDefinition("red-graniti");
    const issa = getManagedPartnerProfileDefinition("issa-build");
    expect(jw?.controlMode).toBe("owner_controlled_tradescout_managed_contact");
    expect(red?.controlMode).toBe("tradescout_admin_controlled");
    expect(issa?.controlMode).toBe("admin_stewarded_pending_owner_transfer");
  });

  it("keeps public, direct-only, and pending-contact lanes visible at the same time", () => {
    expect(getManagedPartnerProfileDefinition("property-blessings")).toMatchObject({
      archetype: "contractor",
      contactMode: "business_phone_tradescout_email",
      exposureMode: "public",
      requestMode: "profile_request_flow",
    });
    expect(getManagedPartnerProfileDefinition("precision-aerial-services")).toMatchObject({
      archetype: "service_creator",
      controlMode: "admin_stewarded_pending_claim",
      contactMode: "pending_owner_contact",
      exposureMode: "direct_only",
      requestMode: "pending",
      expectedPrimaryCta: "Start a Request",
    });
  });

  it("normalizes permanent and intake-promoted contacts after profile provisioning", () => {
    const contactProvisioner = read("server/services/jwStoneManagedContactProvisioning.ts");
    const bootstrap = read("server/services/steelHomePackagesProfileProvisioning.ts");

    expect(contactProvisioner).toContain(
      'import { getRuntimeManagedPartnerProfileDefinitions } from "./managedPartnerIntake"'
    );
    expect(contactProvisioner).toContain(
      "const runtimeDefinitions = await getRuntimeManagedPartnerProfileDefinitions()"
    );
    expect(contactProvisioner).toContain('definition.contactMode === "tradescout_managed"');
    expect(contactProvisioner).toContain("normalizeManagedPartnerContact(definition)");
    expect(contactProvisioner).toContain("independent transaction");
    expect(contactProvisioner).toContain('contact_management: "tradescout_managed"');
    expect(contactProvisioner).toContain("TRADESCOUT_MANAGED_CONTACT_SOURCE");
    expect(contactProvisioner).not.toContain(".update(profiles)");
    expect(contactProvisioner).not.toContain(".update(users)");

    expect(bootstrap).toContain("await provisionRedGranitiProfile();");
    expect(bootstrap).toContain("await provisionTradeScoutManagedPartnerContacts();");
    expect(bootstrap.indexOf("await provisionTradeScoutManagedPartnerContacts();")).toBeGreaterThan(
      bootstrap.indexOf("await provisionRedGranitiProfile();")
    );
    expect(bootstrap).toContain("This must remain the final pass");
  });

  it("extends the live health board with intake-promoted profile definitions", () => {
    const staticHealth = read("server/services/managedPartnerProfileHealth.ts");
    const runtimeHealth = read("server/services/runtimeManagedPartnerProfileHealth.ts");

    for (const code of [
      "business_missing",
      "profile_missing",
      "business_not_active",
      "profile_not_published",
      "ownership_mismatch",
      "public_discovery_off",
      "direct_only_discovery_on",
      "admin_custody_missing",
      "managed_phone_mismatch",
      "managed_email_mismatch",
      "notification_email_mismatch",
      "contact_pending",
      "primary_cta_mismatch",
      "legacy_direct_connect_copy",
      "request_recipient_unavailable",
    ]) {
      expect(`${staticHealth}\n${runtimeHealth}`).toContain(code);
    }

    expect(runtimeHealth).toContain("getRuntimeManagedPartnerProfileDefinitions");
    expect(runtimeHealth).toContain("getManagedPartnerProfileHealth()");
    expect(runtimeHealth).toContain("dynamicDefinitions");
    expect(runtimeHealth).toContain("auditRuntimeDefinition");
    expect(runtimeHealth).toContain("hasVerifiedTradeScoutAdminCustody");
    expect(runtimeHealth).toContain("ready: items.filter");
    expect(runtimeHealth).toContain("attention: items.filter");
    expect(runtimeHealth).toContain("blocked: items.filter");
  });

  it("exposes intake and live health inside the existing TradePartner operations portal", () => {
    const route = read("server/routes/professional-partnerships.ts");
    const portal = read("client/src/pages/admin-tradepartner-ops.tsx");
    const healthBoard = read("client/src/pages/admin-managed-partner-profiles.tsx");
    const intakeBoard = read("client/src/pages/admin-managed-partner-intakes.tsx");

    expect(route).toContain('"/api/admin/managed-partners"');
    expect(route).toContain("getRuntimeManagedPartnerProfileHealth");
    expect(route).toContain('"/api/admin/managed-partner-intakes"');
    expect(route).toContain('"/api/admin/managed-partner-intakes/:id"');
    expect(route).toContain("createManagedPartnerIntake");
    expect(route).toContain("updateManagedPartnerIntake");
    expect(route).toContain("isAuthenticated");
    expect(route).toContain("requireAdmin");
    expect(route).toContain('res.setHeader("Cache-Control", "no-store")');

    expect(portal).toContain(
      'import AdminManagedPartnerIntakesPage from "@/pages/admin-managed-partner-intakes"'
    );
    expect(portal).toContain('defaultValue="partner-intake"');
    expect(portal).toContain('value="partner-intake"');
    expect(portal).toContain("<AdminManagedPartnerIntakesPage />");
    expect(portal).toContain("<AdminManagedPartnerProfilesPage />");

    expect(intakeBoard).toContain('queryKey: ["/api/admin/managed-partner-intakes"]');
    expect(intakeBoard).toContain("refetchInterval: 30_000");
    expect(intakeBoard).toContain('data-testid="managed-partner-intake-queue"');
    expect(intakeBoard).toContain("Add partner");
    expect(intakeBoard).toContain("Edit intake");
    expect(intakeBoard).toContain("Open live profile");

    expect(healthBoard).toContain('queryKey: ["/api/admin/managed-partners"]');
    expect(healthBoard).toContain("refetchInterval: 60_000");
    expect(healthBoard).toContain('data-testid="managed-partner-profile-ops"');
    expect(healthBoard).toContain("Requests → {item.requestRecipientSlug}");
  });
});
