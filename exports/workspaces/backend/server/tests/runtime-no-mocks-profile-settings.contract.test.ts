import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("runtime no-mock and profile settings contracts", () => {
  it("runtime server code does not import drizzle-mock", () => {
    const files = [
      "server/assistantActions.ts",
      "server/data-management.ts",
      "server/notification-service.ts",
      "server/social-features.ts",
      "server/social-routes.ts",
      "server/services/knowledgeService.ts",
      "server/services/llmProvider.ts",
      "server/services/messagingService.ts",
      "server/services/projectService.ts",
      "server/services/workerService.ts",
    ];

    for (const file of files) {
      expect(read(file)).not.toContain("drizzle-mock");
    }
  });

  it("llm provider has no demo/mock provider export", () => {
    const source = read("server/services/llmProvider.ts");
    expect(source).not.toContain("class DemoProvider");
    expect(source).not.toContain("Demo/Mock provider");
  });

  it("profile settings keeps profile basics uploader and save action", () => {
    const source = read("client/src/pages/ProfileSettings.tsx");
    expect(source).toContain("Profile Basics");
    expect(source).toContain("handleProfilePhotoSelected");
    expect(source).toContain("saveProfileBasics");
    expect(source).toContain('fetch("/api/user/profile"');
    expect(source).toContain("profileImageUrl: profileBasics.profileImageUrl");
    expect(source).not.toContain("preferences: (user?.preferences || {})");
    expect(source).toContain("onClick={saveProfileBasics}");
    expect(source).toContain("onClick={savePalette}");
    expect(source).toContain("onClick={saveCustomColors}");
    expect(source).toContain("onClick={saveServicesDescription}");
    expect(source).toContain("onClick={saveProfileBooking}");
  });

  it("settings page profile editor does not overwrite unrelated preferences", () => {
    const source = read("client/src/pages/settings.tsx");
    expect(source).toContain('apiRequest("PUT", "/api/user/profile"');
    expect(source).toContain('apiRequest("PATCH", "/api/users/preferences"');
    expect(source).toContain("bio: profileForm.bio");
    expect(source).toContain('Link href="/profile-settings"');
    expect(source).toContain("profileImageUrl: profileForm.profileImageUrl");
    expect(source).not.toContain(
      "profileImageUrl: profileForm.profileImageUrl,\n        preferences:"
    );
  });
});
