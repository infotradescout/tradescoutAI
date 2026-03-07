import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("admin provisioning contract guards", () => {
  it("provision route keeps activation/verification email toggles", () => {
    const routesSource = read("server/routes.ts");

    expect(routesSource).toContain("/api/admin/users/provision");
    expect(routesSource).toContain("sendActivationEmail");
    expect(routesSource).toContain("sendVerificationEmail");
    expect(routesSource).toContain("activationLinkIncluded");
    expect(routesSource).toContain("verifyLinkIncluded");
  });

  it("admin provisioning UI sends expected payload keys", () => {
    const adminProvisioningSource = read("client/src/pages/admin-provisioning.tsx");

    expect(adminProvisioningSource).toContain("sendEmail");
    expect(adminProvisioningSource).toContain("sendActivationEmail");
    expect(adminProvisioningSource).toContain("sendVerificationEmail");
    expect(adminProvisioningSource).toContain("verifyLink");
  });

  it("support provisioning UI keeps profile creation payload", () => {
    const adminProvisionUserSource = read("client/src/pages/admin-provision-user.tsx");

    expect(adminProvisionUserSource).toContain("profile:");
    expect(adminProvisionUserSource).toContain("create: true");
    expect(adminProvisionUserSource).toContain("createBusinessRecord");
    expect(adminProvisionUserSource).toContain("profileAbout");
    expect(adminProvisionUserSource).toContain("businessWebsite");
    expect(adminProvisionUserSource).toContain("provisionUserTypes");
    expect(adminProvisionUserSource).toContain("businessTags");
    expect(adminProvisionUserSource).toContain("SelectTrigger");
    expect(adminProvisionUserSource).toContain(
      'className="w-full sm:w-auto bg-ts-orange hover:bg-ts-orange-dark"'
    );
  });

  it("provision route persists extended contact/location payload", () => {
    const routesSource = read("server/routes.ts");

    expect(routesSource).toContain("const stateCodeRaw");
    expect(routesSource).toContain("countyFips must be 5 characters");
    expect(routesSource).toContain("profile.about must be 5000 characters or fewer");
    expect(routesSource).toContain("contentBlocks: profileAbout");
    expect(routesSource).toContain("provisionUserTypes");
    expect(routesSource).toContain("services: businessTags.length > 0 ? businessTags : undefined");
  });

  it("provision and support edit wire trade tags into routing declarations", () => {
    const routesSource = read("server/routes.ts");
    const adminProvisionUserSource = read("client/src/pages/admin-provision-user.tsx");

    expect(routesSource).toContain("const rawProvisionTradeTags");
    expect(routesSource).toContain("resolveOrCreateTradeTagSlugs(provisionTradeTags)");
    expect(routesSource).toContain("resolvedTradeTags: resolvedProvisionTradeTags.slugs");
    expect(routesSource).toContain("upsertProviderDeclarationForUser");
    expect(routesSource).toContain("const rawSupportTradeTags");
    expect(routesSource).toContain("const supportTradeTagsProvided");
    expect(routesSource).toContain("resolveOrCreateTradeTagSlugs(supportTradeTags)");
    expect(routesSource).toContain("safePrefs[key] = resolvedSupportTradeTags?.slugs || []");
    expect(routesSource).toContain("const mergedTradeIds = Array.from");
    expect(adminProvisionUserSource).toContain(
      "tradeTags: normalizedTradeTags.length > 0 ? normalizedTradeTags : undefined"
    );
    expect(adminProvisionUserSource).toContain("patch.tradeTags = normalizedEditTradeTags");
    expect(adminProvisionUserSource).toContain(
      "Trade tags for routing (comma separated, optional)"
    );
    expect(adminProvisionUserSource).toContain("Resolved trade tags:");
  });

  it("bulk import keeps optional public profile toggle", () => {
    const adminImportSource = read("client/src/pages/admin-business-import.tsx");
    const routesSource = read("server/routes.ts");

    expect(adminImportSource).toContain("createPublicProfiles");
    expect(routesSource).toContain("createPublicProfiles");
    expect(routesSource).toContain("createdPublicProfiles");
  });
});
