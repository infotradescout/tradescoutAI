import { describe, expect, it } from "vitest";
import { projectSupportedAboutTarget } from "../services/presenceAboutIntent";

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: "synthetic-first-profile",
    ownerUserId: "synthetic-owner",
    businessId: "synthetic-business",
    roleContext: "business_owner",
    slug: "synthetic-first-profile",
    status: "published",
    publiclyReleased: true,
    contentBlocksRevision: 3,
    seoMeta: { customDomain: "SYNTHETIC.EXAMPLE" },
    contentBlocks: [
      { type: "siteTemplate", data: { id: "default" } },
      { type: "hero", data: { title: "Owner supplied title" } },
      { type: "gallery", data: { images: [{ url: "https://images.example/owner.jpg" }] } },
    ],
    ...overrides,
  } as any;
}

describe("first About publication target", () => {
  it("offers an insertion snapshot without creating a block or publishing text", () => {
    const source = profile();
    const before = JSON.stringify(source);
    const result = projectSupportedAboutTarget(source, {}, {});
    expect(result).toMatchObject({
      ok: true,
      target: {
        targetMode: "create", currentText: "", field: "body", contentBlocksRevision: 3,
        profileTargetIdentity: {
          ownerUserId: "synthetic-owner", businessId: "synthetic-business",
          slug: "synthetic-first-profile", publiclyReleased: true, customDomain: "synthetic.example",
        },
      },
    });
    expect(JSON.stringify(source)).toBe(before);
    const restored = projectSupportedAboutTarget(profile({ contentBlocksRevision: 5 }), {}, {});
    expect(restored).toMatchObject({ ok: true, target: { contentBlocksRevision: 5 } });
  });

  it.each([
    { status: "draft" },
    { publiclyReleased: false },
  ])("keeps an unreleased or unpublished profile ineligible: %j", (changes) => {
    expect(projectSupportedAboutTarget(profile(changes), {}, {}))
      .toEqual({ ok: false, reason: "ABOUT_HIDDEN" });
  });

  it("respects scoped About visibility before owner fallback visibility", () => {
    const base = profile();
    expect(projectSupportedAboutTarget(base, { profileSections: { about: false } }, {}))
      .toMatchObject({ ok: false, reason: "ABOUT_HIDDEN" });
    const scoped = { ...base, contentBlocks: [...base.contentBlocks,
      { type: "profileSections", data: { about: true } }] };
    expect(projectSupportedAboutTarget(scoped, { profileSections: { about: false } }, {}))
      .toMatchObject({ ok: true, target: { targetMode: "create" } });
    expect(projectSupportedAboutTarget({ ...base, contentBlocks: [...base.contentBlocks,
      { type: "profileSections", data: { about: false } }] }, {}, {}))
      .toMatchObject({ ok: false, reason: "ABOUT_HIDDEN" });
  });

  it("distinguishes inserting a block from replacing an existing empty block", () => {
    const base = profile();
    expect(projectSupportedAboutTarget({ ...base, contentBlocks: [...base.contentBlocks,
      { type: "about", data: { text: "", heading: "Owner heading" } }] }, {}, {}))
      .toMatchObject({ ok: true, target: { targetMode: "replace", currentText: "", field: "text" } });
    expect(projectSupportedAboutTarget({ ...base, contentBlocks: [...base.contentBlocks,
      { type: "about", data: { body: "Owner copy" } },
      { type: "about", data: { body: "Another owner block" } }] }, {}, {}))
      .toMatchObject({ ok: false, reason: "ABOUT_BLOCK_MULTIPLE" });
  });

  it("rejects unsupported adapters and malformed revision snapshots", () => {
    const base = profile();
    expect(projectSupportedAboutTarget(profile({ slug: "jw-stone" }), {}, {}))
      .toMatchObject({ ok: false, reason: "UNSUPPORTED_TEMPLATE" });
    expect(projectSupportedAboutTarget(base, {}, { tradePartner: true }))
      .toMatchObject({ ok: false, reason: "UNSUPPORTED_TEMPLATE" });
    expect(projectSupportedAboutTarget(profile({ contentBlocks: [
      { type: "siteTemplate", data: { id: "electrician-solo" } }, ...base.contentBlocks.slice(1),
    ] }), {}, {})).toMatchObject({ ok: false, reason: "UNSUPPORTED_TEMPLATE" });
    for (const revision of [undefined, 0, -1, 1.5]) {
      expect(projectSupportedAboutTarget(profile({ contentBlocksRevision: revision }), {}, {}))
        .toMatchObject({ ok: false, reason: "ABOUT_BLOCK_UNSUPPORTED" });
    }
  });
});
