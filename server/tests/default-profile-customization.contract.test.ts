import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  readProfileSectionConfigBlock,
  upsertProfileSectionConfigBlock,
} from "@shared/profileSectionConfig";
import {
  COLOR_PRESETS,
  getPresetNames,
  getProfileBrandColorsForPreset,
} from "@shared/colorPresets";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("default profile customization contract", () => {
  it("stores section visibility on the exact profile without losing other content", () => {
    const original = [
      { type: "siteTemplate", data: { id: "default" } },
      { type: "hero", data: { title: "Built for this business" } },
    ];
    const first = upsertProfileSectionConfigBlock(original, {
      about: true,
      services: false,
    });
    const second = upsertProfileSectionConfigBlock(first, { contactCard: true });

    expect(readProfileSectionConfigBlock(second)).toEqual({
      about: true,
      services: false,
      contactCard: true,
    });
    expect(second).toContainEqual(original[0]);
    expect(second).toContainEqual(original[1]);
    expect(second.filter((block) => block.type === "profileSections")).toHaveLength(1);
  });

  it("preserves legacy section choices on the first profile-scoped write only", () => {
    const legacy = {
      about: false,
      services: true,
      reviews: false,
    };
    const first = upsertProfileSectionConfigBlock([], { services: false }, legacy);
    expect(readProfileSectionConfigBlock(first)).toEqual({
      about: false,
      services: false,
      reviews: false,
    });

    const second = upsertProfileSectionConfigBlock(
      first,
      { contactCard: false },
      { about: true, reviews: true }
    );
    expect(readProfileSectionConfigBlock(second)).toEqual({
      about: false,
      services: false,
      reviews: false,
      contactCard: false,
    });
  });

  it("maps every preset to valid profile colors with a preset-local surface fallback", () => {
    for (const name of getPresetNames()) {
      const colors = getProfileBrandColorsForPreset(name);
      for (const value of Object.values(colors)) {
        expect(value, `${name} should save a six-digit hex color`).toMatch(/^#[0-9a-f]{6}$/i);
      }
      expect(colors.surface).toBe(COLOR_PRESETS[name].surface || COLOR_PRESETS[name].background);
    }

    expect(getProfileBrandColorsForPreset("warm").background).toBe("#1c1917");
    expect(getProfileBrandColorsForPreset("warm").surface).toBe("#1c1917");
  });

  it("uses explicit services instead of repeating the business category", () => {
    const source = read("client/src/pages/ProfileSiteView.tsx");
    expect(source).toMatch(
      /profileServiceTags\.length > 0\s*\?\s*profileServiceTags\s*:\s*businessServiceTags\.length > 0\s*\?\s*businessServiceTags\s*:\s*publicCategories/
    );
    expect(source).not.toContain(
      'siteTemplate === "videographer" && profileServiceTags.length > 0'
    );
  });

  it("does not repeat hero copy as a synthetic About section", () => {
    const source = read("client/src/pages/ProfileSiteView.tsx");
    expect(source).toContain("const defaultAboutText = explicitAboutText;");
    expect(source).toContain("aboutText={defaultAboutText}");
  });

  it("renders the management bar in normal flow above the default landing page", () => {
    const source = read("client/src/pages/ProfileSiteView.tsx");
    const defaultBranch = source.slice(source.lastIndexOf("return ("));
    expect(defaultBranch).not.toContain("manageChromeSpacer");
    expect(defaultBranch.indexOf("{manageChrome}")).toBeLessThan(
      defaultBranch.indexOf("<DefaultProfileTheme")
    );
  });

  it("loads and saves colors and sections through exact profile-scoped endpoints", () => {
    const editor = read("client/src/pages/ProfileSiteEditor.tsx");
    const routes = read("server/routes/profiles.ts");

    expect(editor).toContain("`/api/profiles/${encodeURIComponent(detail.id)}/brand-colors`");
    expect(editor).toContain("`/api/profiles/${encodeURIComponent(profile.id)}/brand-colors`");
    expect(editor).toContain("`/api/profiles/${encodeURIComponent(detail.id)}/profile-sections`");
    expect(editor).toContain("`/api/profiles/${encodeURIComponent(profile.id)}/profile-sections`");
    expect(editor).not.toContain('apiRequest("PATCH", "/api/users/color-scheme"');
    expect(editor).not.toContain('apiRequest("PATCH", "/api/users/profile-sections"');
    expect(editor).toContain('typeof colors.primaryDark === "string"');
    expect(editor).toContain('typeof colors.accent === "string"');
    expect(editor).not.toContain("primaryDark: customColors.primary");
    expect(editor).not.toContain("accent: customColors.primary");

    expect(routes).toContain('router.patch("/api/profiles/:id/brand-colors"');
    expect(routes).toContain('router.patch("/api/profiles/:id/profile-sections"');
    expect(routes).toContain("getProfileByIdForOwner(userId, profileId)");
    expect(routes).toContain("...existingProfileData");
    expect(routes).toContain("...existingBrandColors");
    expect(routes).toContain("profileBrandColorsSchema.parse(req.body)");
    expect(routes).toContain("eq(businesses.ownerUserId, profile.ownerUserId)");
    expect(routes).toContain("profileSections.rolesAndBadges !== false");
    expect(routes).toContain("profile.contentBlocks,");
    expect(routes).toContain("legacySections");
    expect(routes).toContain("services: business.services || []");
    expect(routes).toContain("...(business.city ? { city: business.city } : {})");
    expect(routes).toContain(
      "business.tradePartner === true && (business.address || business.zipCode)"
    );
  });

  it("keeps Cameron data outside the shared renderer", () => {
    const theme = read("client/src/pages/profile-sites/DefaultProfileTheme.tsx").toLowerCase();
    expect(theme).not.toContain("precision-aerial");
    expect(theme).not.toContain("cameron");
    expect(theme).not.toContain("pensacola");
    expect(theme).not.toContain("chillshots");
  });
});
