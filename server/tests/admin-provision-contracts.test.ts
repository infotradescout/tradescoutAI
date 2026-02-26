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
  });

  it("bulk import keeps optional public profile toggle", () => {
    const adminImportSource = read("client/src/pages/admin-business-import.tsx");
    const routesSource = read("server/routes.ts");

    expect(adminImportSource).toContain("createPublicProfiles");
    expect(routesSource).toContain("createPublicProfiles");
    expect(routesSource).toContain("createdPublicProfiles");
  });
});
