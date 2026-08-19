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
  it("tracks every current managed or temporarily stewarded partner in one registry", () => {
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
    });
  });

  it("normalizes managed contacts only after the current profile provisioners finish", () => {
    const contactProvisioner = read("server/services/jwStoneManagedContactProvisioning.ts");
    const bootstrap = read("server/services/steelHomePackagesProfileProvisioning.ts");

    expect(contactProvisioner).toContain(
      "MANAGED_PARTNER_PROFILE_DEFINITIONS.filter"
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

  it("audits contact, ownership, discovery, publication, request recipient, and CTA truth", () => {
    const health = read("server/services/managedPartnerProfileHealth.ts");

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
      expect(health).toContain(code);
    }

    expect(health).toContain("hasVerifiedTradeScoutAdminCustody");
    expect(health).toContain("resolveStatus(issues)");
    expect(health).toContain("ready: items.filter");
    expect(health).toContain("attention: items.filter");
    expect(health).toContain("blocked: items.filter");
  });

  it("exposes the live audit inside the existing TradePartner operations portal", () => {
    const route = read("server/routes/professional-partnerships.ts");
    const portal = read("client/src/pages/admin-tradepartner-ops.tsx");
    const board = read("client/src/pages/admin-managed-partner-profiles.tsx");

    expect(route).toContain('"/api/admin/managed-partners"');
    expect(route).toContain("isAuthenticated");
    expect(route).toContain("requireAdmin");
    expect(route).toContain("getManagedPartnerProfileHealth");
    expect(route).toContain('res.setHeader("Cache-Control", "no-store")');

    expect(portal).toContain(
      'import AdminManagedPartnerProfilesPage from "@/pages/admin-managed-partner-profiles"'
    );
    expect(portal).toContain('defaultValue="managed-profiles"');
    expect(portal).toContain('value="managed-profiles"');
    expect(portal).toContain("<AdminManagedPartnerProfilesPage />");

    expect(board).toContain('queryKey: ["/api/admin/managed-partners"]');
    expect(board).toContain("refetchInterval: 60_000");
    expect(board).toContain('data-testid="managed-partner-profile-ops"');
    expect(board).toContain("Open live profile");
    expect(board).toContain("Requests → {item.requestRecipientSlug}");
    expect(board).toContain("No operating gaps found.");
  });
});
