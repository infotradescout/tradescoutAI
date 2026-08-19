import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ISSA_BUILD_MANAGED_CONTACT } from "@shared/issaBuildManagedContact";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("ISSA Build TradeScout-managed contact", () => {
  it("uses the approved Levon phone and TradeScout email", () => {
    expect(ISSA_BUILD_MANAGED_CONTACT).toEqual({
      label: "TradeScout managed contact",
      heading: "ISSA Build inquiries",
      phone: "(850) 543-0748",
      tel: "+18505430748",
      email: "contact@thetradescout.com",
      description: "Calls and messages from this profile are handled through TradeScout.",
    });
  });

  it("shows the managed pair only inside the dedicated ISSA Build presentation", () => {
    const showcase = read("client/src/pages/profile-sites/LuxuryMaterialHouseShowcase.tsx");

    expect(showcase).toContain(
      'import { ISSA_BUILD_BUSINESS_NAME } from "@shared/issaBuildProfile"'
    );
    expect(showcase).toContain(
      'import { ISSA_BUILD_MANAGED_CONTACT } from "@shared/issaBuildManagedContact"'
    );
    expect(showcase).toContain(
      "profileName.trim().toLowerCase() === ISSA_BUILD_BUSINESS_NAME.toLowerCase()"
    );
    expect(showcase).toContain('data-testid="issa-build-managed-contact"');
    expect(showcase).toContain("managedContact.label");
    expect(showcase).toContain("managedContact.phone");
    expect(showcase).toContain("managedContact.email");
    expect(showcase).toContain("`tel:${managedContact.tel}`");
    expect(showcase).toContain("`mailto:${managedContact.email}`");
    expect(showcase).toContain("<Phone");
    expect(showcase).toContain("<Mail");
  });

  it("normalizes the production record without borrowing another business or transferring ownership", () => {
    const provisioner = read("server/services/issaBuildProfileProvisioning.ts");

    expect(provisioner).toContain(
      'import { ISSA_BUILD_MANAGED_CONTACT } from "@shared/issaBuildManagedContact"'
    );
    expect(provisioner).toContain(
      'export const ISSA_BUILD_MANAGED_CONTACT_SOURCE = "tradescout_managed_contact"'
    );
    expect(provisioner).toContain("phone: ISSA_BUILD_MANAGED_CONTACT.phone");
    expect(provisioner).toContain("email: ISSA_BUILD_MANAGED_CONTACT.email");
    expect(provisioner).toContain("notificationEmail: ISSA_BUILD_MANAGED_CONTACT.email");
    expect(provisioner).toContain('contact_management: "tradescout_managed"');
    expect(provisioner).toContain("managed_contact_phone: ISSA_BUILD_MANAGED_CONTACT.phone");
    expect(provisioner).toContain("managed_contact_email: ISSA_BUILD_MANAGED_CONTACT.email");
    expect(provisioner).toContain("ISSA_BUILD_MANAGED_CONTACT_SOURCE");
    expect(provisioner).toContain("ownerUserId: profileOwnerUserId");
    expect(provisioner).not.toContain("JW_STONE_PROFILE_SLUG");
    expect(provisioner).not.toContain("activeBusinessId");
    expect(provisioner).not.toContain("activeProfileId");
  });

  it("records the operator correction without exposing owner-account contact", () => {
    const sourceRecord = read("docs/profile-sources/ISSA_BUILD.md");

    expect(sourceRecord).toContain("Operator correction (2026-08-19)");
    expect(sourceRecord).toContain("superseded for ISSA Build's dedicated presentation");
    expect(sourceRecord).toContain("visible **TradeScout managed contact**");
    expect(sourceRecord).toContain("Only the approved managed pair may be shown");
    expect(sourceRecord).toContain("without transferring ISSA Build ownership");
    expect(sourceRecord).not.toMatch(/issaichev|@gmail\.com|password/i);
  });
});
