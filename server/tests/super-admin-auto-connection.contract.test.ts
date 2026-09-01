import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("super-admin auto-connection contracts", () => {
  it("ensures new users are auto-linked to super admin in createUser", () => {
    const storageSource = read("server/storage.ts");

    expect(storageSource).toContain("ensureSuperAdminConnectionForUser");
    expect(storageSource).toContain("await ensureSuperAdminConnectionForUser(String(user.id));");
  });

  it("self-heals auto-connection on authenticated session fetch", () => {
    const routesSource = read("server/routes.ts");

    expect(routesSource).toContain("superAdminConnectionEnsuredForUserId");
    expect(routesSource).toContain("await ensureSuperAdminConnectionForUser(String(userId));");
  });

  it("writes only social discovery edges and never grants contact authority", () => {
    const helperSource = read("server/utils/superAdminConnection.ts");

    expect(helperSource).toContain("insert into user_follows");
    expect(helperSource).not.toContain("contact_permissions");
    expect(helperSource).not.toContain("system_super_admin_auto");
    expect(helperSource).not.toContain("do update set");
    expect(helperSource).toContain("must never create");
    expect(helperSource).toContain("or rewrite contact authority");
  });

  it("keeps synthetic integration users out of production relationship provisioning", () => {
    const testAuthSource = read("server/tests/helpers/testAuth.ts");

    expect(testAuthSource).toContain('process.env.RUN_INTEGRATION_TESTS === "true"');
    expect(testAuthSource).toContain('email.endsWith("@tradescout.test")');
    expect(testAuthSource).not.toContain('values.role === "super_admin"');
    expect(testAuthSource).toContain(".insert(users)");
  });
});
