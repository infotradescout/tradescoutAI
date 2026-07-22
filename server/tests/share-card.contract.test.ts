import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("dedicated Share Card contract", () => {
  it("mounts one app-level share surface and routes shared context into it", () => {
    const app = read("client/src/App.tsx");
    const shareUtility = read("client/src/utils/share.ts");

    expect(app).toContain("<ShareCardHost />");
    expect(shareUtility).toContain('SHARE_CARD_EVENT = "tradescout:open-share-card"');
    expect(shareUtility).toContain("window.dispatchEvent(new CustomEvent<ShareCardPayload>");
  });

  it("makes Community a primary destination without publishing automatically", () => {
    const card = read("client/src/components/share/ShareCardHost.tsx");

    expect(card).toContain("Share to Community");
    expect(card).toContain('compose: "1"');
    expect(card).toContain("prefill");
    expect(card).toContain("/login?next=");
    expect(card).not.toContain('apiRequest("POST", "/api/community/posts"');
  });

  it("uses the dedicated card from reusable buttons without inventing a social-post route", () => {
    const shareButton = read("client/src/components/ShareButton.tsx");
    const socialPost = read("client/src/components/social/PostCard.tsx");
    const socialFeed = read("client/src/components/social/SocialFeed.tsx");

    expect(shareButton).toContain("await share({");
    expect(socialFeed).toContain("@deprecated Quarantined socialPosts client");
    expect(socialPost).not.toContain("void share({");
    expect(socialPost).not.toContain("buildCommunityPostPath");
    expect(socialPost).not.toContain("<ShareModal");
    expect(
      fs.existsSync(path.resolve(process.cwd(), "client/src/components/social/ShareModal.tsx"))
    ).toBe(false);
  });

  it("keeps group and group-post share destinations on the mounted detail route", () => {
    const appRoutes = read("client/src/AppRoutes.tsx");
    const groupDetail = read("client/src/pages/group-detail.tsx");
    const groups = read("client/src/pages/groups.tsx");

    expect(appRoutes).toContain('<Route path="/group/:id">');
    expect(groupDetail).toContain("const groupId = params?.id");
    expect(groupDetail).toContain("buildCommunityGroupPath(groupId)");
    expect(groupDetail).toContain("buildCommunityGroupPath(groupId, post.id)");
    expect(groupDetail).toContain('new URLSearchParams(search).get("post")');
    expect(groupDetail).toContain("getElementById(`group-post-${sharedPostId}`)");
    expect(groups).toContain("buildCommunityGroupPath(group.id)");
    expect(groupDetail).not.toContain("`/groups/${groupId}");
    expect(groups).not.toContain("`/groups/${group.id}");
  });
});
