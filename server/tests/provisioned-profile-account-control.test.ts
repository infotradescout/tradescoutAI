import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isProvisionedProfileAccountControlConfirmed,
  isPublicProfileAccountGateOpen,
} from "../services/provisionedProfileAccountControl";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("provisioned profile account control", () => {
  it.each([
    [
      "email-verified local account",
      { emailVerified: true, provider: "local", verificationStatus: "pending" },
    ],
    [
      "admin-provisioned account",
      { emailVerified: false, provider: "admin_provisioned", verificationStatus: "pending" },
    ],
    [
      "approved account",
      { emailVerified: false, provider: "local", verificationStatus: "approved" },
    ],
  ])("accepts %s", (_label, candidate) => {
    expect(isProvisionedProfileAccountControlConfirmed(candidate)).toBe(true);
  });

  it("rejects an unverified public-registration account with only a matching email", () => {
    expect(
      isProvisionedProfileAccountControlConfirmed({
        emailVerified: false,
        provider: "local",
        verificationStatus: "pending",
      })
    ).toBe(false);
  });

  it("opens the public profile gate only for a public, controlled, non-rejected account", () => {
    const candidate = {
      profileVisibility: "public",
      emailVerified: false,
      provider: "admin_provisioned",
      verificationStatus: "pending",
    };

    expect(isPublicProfileAccountGateOpen(candidate)).toBe(true);
    expect(isPublicProfileAccountGateOpen({ ...candidate, profileVisibility: "private" })).toBe(
      false
    );
    expect(isPublicProfileAccountGateOpen({ ...candidate, verificationStatus: "rejected" })).toBe(
      false
    );
    expect(
      isPublicProfileAccountGateOpen({
        ...candidate,
        provider: "local",
      })
    ).toBe(false);
  });

  it.each([
    "server/services/mouldingMillworkProfileProvisioning.ts",
    "server/services/jrsAutoGlassProfileProvisioning.ts",
    "server/services/proFabProfileProvisioning.ts",
    "server/services/laPlumbingProfileProvisioning.ts",
  ])("guards email-based owner adoption in %s", (relativePath) => {
    const source = read(relativePath);

    expect(source).toContain("isProvisionedProfileAccountControlConfirmed({");
    expect(source).toContain("refused an unconfirmed pre-existing account");
  });
});
