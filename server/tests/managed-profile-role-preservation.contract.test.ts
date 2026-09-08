import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("managed profile role projection preservation", () => {
  it.each([
    ["server/services/jrsAutoGlassProfileProvisioning.ts", "auto_service"],
    ["server/services/laPlumbingProfileProvisioning.ts", "specialty_tradesperson"],
    ["server/services/mouldingMillworkProfileProvisioning.ts", "business_owner"],
    ["server/services/proFabProfileProvisioning.ts", "contractor"],
  ])("atomically adds the managed role in %s", (file, role) => {
    const source = read(file);

    expect(source).toContain("coalesce(${users.roles}, array[]::text[])");
    expect(source).toContain("select array_agg(distinct role_value)");
    expect(source).toContain(`'${role}'`);
    expect(source).not.toContain("const existingRoles = Array.isArray(existingOwner?.roles)");
  });
});
