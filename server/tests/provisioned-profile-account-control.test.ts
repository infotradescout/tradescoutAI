import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isProvisionedProfileAccountControlConfirmed } from "../services/provisionedProfileAccountControl";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("provisioned profile account control", () => {
  it.each([
    { emailVerified: true, provider: "local", verificationStatus: "pending" },
    { emailVerified: false, provider: "admin_provisioned", verificationStatus: "pending" },
    { emailVerified: false, provider: "local", verificationStatus: "approved" },
  ])("accepts a real custody signal", (candidate) => {
    expect(isProvisionedProfileAccountControlConfirmed(candidate)).toBe(true);
  });

  it("rejects a matching email without an account-control signal", () => {
    expect(
      isProvisionedProfileAccountControlConfirmed({
        emailVerified: false,
        provider: "local",
        verificationStatus: "pending",
      })
    ).toBe(false);
  });

  it.each([
    "mouldingMillworkProfileProvisioning.ts",
    "jrsAutoGlassProfileProvisioning.ts",
    "proFabProfileProvisioning.ts",
    "laPlumbingProfileProvisioning.ts",
  ])("guards %s before adopting a matching account", (filename) => {
    const source = read(`server/services/${filename}`);
    const ownerLookup = source.indexOf("const [existingOwner]");
    const accountGuard = source.indexOf("isProvisionedProfileAccountControlConfirmed", ownerLookup);
    const ownerMutation = source.indexOf("const [owner]", ownerLookup);

    expect(ownerLookup).toBeGreaterThan(-1);
    expect(accountGuard).toBeGreaterThan(ownerLookup);
    expect(ownerMutation).toBeGreaterThan(accountGuard);
    expect(source).toContain("refused an unconfirmed pre-existing account");
  });
});
