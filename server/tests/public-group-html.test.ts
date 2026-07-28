import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getGroupById: vi.fn(),
  getCommunityPost: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getGroupById: mocks.getGroupById,
    getCommunityPost: mocks.getCommunityPost,
  },
}));

import { buildPublicGroupHtml } from "../publicGroupHtml";
import { upgradePublicSocialPreviewHtml } from "../publicSocialPreviewHtml";
import { resolveSignedSocialPreviewToken } from "../signedSocialPreview";

const templateHtml = `<!doctype html>
<html>
  <head>
    <title>TradeScout</title>
    <meta name="description" content="TradeScout" />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="TradeScout" />
    <meta property="og:description" content="TradeScout" />
    <meta property="og:url" content="https://www.thetradescout.com" />
    <meta property="og:image" content="/tradescout-social-preview.png" />
    <meta property="og:image:secure_url" content="/tradescout-social-preview.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="TradeScout" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="TradeScout" />
    <meta name="twitter:description" content="TradeScout" />
    <meta name="twitter:image" content="/tradescout-social-preview.png" />
    <meta name="twitter:image:alt" content="TradeScout" />
    <link rel="canonical" href="https://www.thetradescout.com" />
  </head>
  <body><div id="root"></div></body>
</html>`;

const publicGroup = {
  id: "group-123",
  name: "Escambia Makers",
  description:
    "Swap ideas with nearby makers. Call 850-555-0100 or visit private.example for details.",
  groupType: "interest",
  scope: "county",
  stateCode: "FL",
  cityName: "Pensacola",
  regionName: null,
  imageUrl: "/uploads/groups/avatar.webp",
  bannerUrl: "/uploads/groups/banner.webp",
  memberCount: 128,
  postCount: 42,
  isPrivate: false,
  isActive: true,
  createdBy: "private-owner-id",
  requiresApproval: true,
};

function signedTokenFromHtml(html: string): string {
  const imageUrl = html.match(
    /<meta property="og:image" content="([^"]*\/images\/social\/card\/([^"]+)\.png)"/
  )?.[1];
  expect(imageUrl).toBeTruthy();
  return new URL(String(imageUrl).replace(/&amp;/g, "&")).pathname
    .replace(/^\/images\/social\/card\//, "")
    .replace(/\.png$/, "");
}

describe("public community group HTML", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "public-group-html-test-secret";
    mocks.getGroupById.mockResolvedValue(publicGroup);
    mocks.getCommunityPost.mockResolvedValue(undefined);
  });

  it("publishes the exact shared post only when it is visible and belongs to the group", async () => {
    const publicPost = {
      id: "post-456",
      title: "Workbench restoration",
      content: "A local oak workbench is ready for its next step.",
      imageUrls: ["/uploads/groups/workbench.webp"],
      tags: ["group:group-123", "projects"],
      isPublished: true,
      isHidden: false,
    };
    mocks.getCommunityPost.mockResolvedValueOnce(publicPost);

    const html = await buildPublicGroupHtml({
      groupId: "group-123",
      postId: "post-456",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).toContain(
      "<title>Workbench restoration | Escambia Makers | TradeScout Groups</title>"
    );
    expect(html).toContain(
      'link rel="canonical" href="https://www.thetradescout.com/group/group-123?post=post-456"'
    );
    expect(html).toContain(
      'property="og:image" content="https://www.thetradescout.com/uploads/groups/workbench.webp"'
    );
    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain('data-seo-group-post="post-456"');

    const upgraded = upgradePublicSocialPreviewHtml(html!);
    const resolved = resolveSignedSocialPreviewToken(signedTokenFromHtml(upgraded));
    expect(resolved?.context).toMatchObject({
      kind: "community_post",
      title: "Workbench restoration | Escambia Makers",
      brandName: "TradeScout Groups",
      eyebrow: "Group post",
      ctaLabel: "View post · Join the conversation",
      sourceImageUrl: "https://www.thetradescout.com/uploads/groups/workbench.webp",
    });

    mocks.getCommunityPost.mockResolvedValueOnce({ ...publicPost, isHidden: true });
    await expect(
      buildPublicGroupHtml({
        groupId: "group-123",
        postId: "post-456",
        origin: "https://www.thetradescout.com",
        templateHtml,
      })
    ).resolves.toBeNull();

    mocks.getCommunityPost.mockResolvedValueOnce({
      ...publicPost,
      tags: ["group:different-group"],
    });
    await expect(
      buildPublicGroupHtml({
        groupId: "group-123",
        postId: "post-456",
        origin: "https://www.thetradescout.com",
        templateHtml,
      })
    ).resolves.toBeNull();
  });

  it("publishes safe group metadata and lets the global upgrader build a group card", async () => {
    const html = await buildPublicGroupHtml({
      groupId: "group-123",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).toContain("<title>Escambia Makers | TradeScout Groups</title>");
    expect(html).toContain(
      'link rel="canonical" href="https://www.thetradescout.com/group/group-123"'
    );
    expect(html).toContain(
      'property="og:image" content="https://www.thetradescout.com/uploads/groups/banner.webp"'
    );
    expect(html).toContain('property="og:site_name" content="TradeScout Groups"');
    expect(html).toContain('data-seo-group="true"');
    expect(html).toContain("<strong>Area:</strong> Pensacola, FL");
    expect(html).toContain("128 members");
    expect(html).toContain("Continue through TradeScout");
    expect(html).not.toContain("850-555-0100");
    expect(html).not.toContain("private.example");
    expect(html).not.toContain("private-owner-id");
    expect(html).not.toContain("requiresApproval");

    const upgraded = upgradePublicSocialPreviewHtml(html!);
    const resolved = resolveSignedSocialPreviewToken(signedTokenFromHtml(upgraded));
    expect(resolved?.context).toMatchObject({
      kind: "group",
      title: "Escambia Makers",
      brandName: "TradeScout Groups",
      eyebrow: "Community group",
      ctaLabel: "View group · Join the conversation",
      sourceImageUrl: "https://www.thetradescout.com/uploads/groups/banner.webp",
    });
  });

  it("fails closed for private, inactive, unknown, malformed, and unreadable groups", async () => {
    mocks.getGroupById.mockResolvedValueOnce({ ...publicGroup, isPrivate: true });
    await expect(
      buildPublicGroupHtml({
        groupId: "group-123",
        origin: "https://www.thetradescout.com",
        templateHtml,
      })
    ).resolves.toBeNull();

    mocks.getGroupById.mockResolvedValueOnce({ ...publicGroup, isActive: false });
    await expect(
      buildPublicGroupHtml({
        groupId: "group-123",
        origin: "https://www.thetradescout.com",
        templateHtml,
      })
    ).resolves.toBeNull();

    mocks.getGroupById.mockResolvedValueOnce(undefined);
    await expect(
      buildPublicGroupHtml({
        groupId: "group-123",
        origin: "https://www.thetradescout.com",
        templateHtml,
      })
    ).resolves.toBeNull();

    mocks.getGroupById.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(
      buildPublicGroupHtml({
        groupId: "group-123",
        origin: "https://www.thetradescout.com",
        templateHtml,
      })
    ).resolves.toBeNull();

    const callsBeforeMalformed = mocks.getGroupById.mock.calls.length;
    await expect(
      buildPublicGroupHtml({
        groupId: "../private",
        origin: "https://www.thetradescout.com",
        templateHtml,
      })
    ).resolves.toBeNull();
    expect(mocks.getGroupById).toHaveBeenCalledTimes(callsBeforeMalformed);
  });

  it("registers the public group renderer before the SPA catch-all", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf8");
    const groupRouteIndex = source.indexOf('app.get("/group/:id"');
    const catchAllIndex = source.indexOf('app.get("*"');

    expect(source).toContain('import { buildPublicGroupHtml } from "./publicGroupHtml"');
    expect(groupRouteIndex).toBeGreaterThan(-1);
    expect(source).toContain("const html = await buildPublicGroupHtml({");
    expect(source).toContain('postId: typeof req.query.post === "string" ? req.query.post : null');
    expect(groupRouteIndex).toBeLessThan(catchAllIndex);
  });
});
