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

  it("writes both social follow edges and accepted contact permission", () => {
    const helperSource = read("server/utils/superAdminConnection.ts");

    expect(helperSource).toContain("insert into user_follows");
    expect(helperSource).toContain("'accepted'");
    expect(helperSource).toContain("system_super_admin_auto");
    expect(helperSource).toContain("'platform_support'");
  });

  it("keeps super-admin authority gate within contact_permissions varchar(30)", () => {
    const helperSource = read("server/utils/superAdminConnection.ts");
    const match = helperSource.match(/SUPER_ADMIN_AUTHORITY_GATE\s*=\s*"([^"]+)"/);

    expect(match?.[1]).toBeTruthy();
    expect((match?.[1] ?? "").length).toBeLessThanOrEqual(30);
  });
});
