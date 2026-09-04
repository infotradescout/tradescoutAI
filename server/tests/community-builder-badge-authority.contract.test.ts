import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("Community Builder badge authority projection", () => {
  it("updates roles, badges, and preferences from the same profile/user locked snapshot", () => {
    const source = read("server/communityBuilderBadgeService.ts");

    expect(source).toContain("updateUserPreservingApprovedProfessionalRoles({");
    expect(source).toContain("buildPatch: ({ currentUser, approvedProfessionalRoles })");
    expect(source).toContain("approvedRoleSet.has(professionalRole)");
    expect(source).toContain('"community_builder"');
    expect(source).toContain("currentUser.badges");
    expect(source).toContain("currentUser.preferences");
    expect(source).not.toContain("storage.getUser");
    expect(source).not.toContain("storage.updateUser");
  });
});
