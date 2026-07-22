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

  it("uses the dedicated card from reusable and legacy social share buttons", () => {
    const shareButton = read("client/src/components/ShareButton.tsx");
    const socialPost = read("client/src/components/social/PostCard.tsx");

    expect(shareButton).toContain("await share({");
    expect(socialPost).toContain("void share({");
    expect(socialPost).not.toContain("<ShareModal");
  });
});
