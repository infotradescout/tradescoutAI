import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const wrapper = read("client/src/components/layout/AppShell.tsx");
const core = read("client/src/components/layout/AppShellCore.tsx");
const frame = read("client/src/components/layout/AuthenticatedSocialFrame.tsx");
const mobileBottomNav = read("client/src/components/navigation/MobileAppBar.tsx");

describe("signed-in TradeScout social frame", () => {
  it("preserves the current top navigation without rebuilding it", () => {
    expect(wrapper).toContain('import AppShellCore from "./AppShellCore"');
    expect(wrapper).toContain("<AppShellCore");
    expect(wrapper).not.toContain("ts-desktop-primary-nav");
    expect(wrapper).not.toContain("TradeScoutLogo");

    expect(core).toContain("ts-desktop-primary-nav");
    expect(core).toContain("TradeScoutLogo");
    expect(core).toContain('aria-label="Primary"');
  });

  it("adds a persistent desktop bottom nav and preserves the existing mobile bottom nav", () => {
    expect(wrapper).toContain('data-testid="desktop-bottom-nav"');
    expect(wrapper).toContain("<MobileAppBar items={desktopBottomNavItems} primaryLimit={5} />");
    expect(wrapper).toContain("ts-desktop-bottom-nav-active");
    expect(wrapper).toContain("bottom: 58px !important");

    expect(core).toContain("MOBILE FEATURE NAV");
    expect(core).toContain("isMobileSimplified ? mobileFlowNav : mobileNav.ordered");
    expect(mobileBottomNav).toContain('className="ts-bottom-nav');
    expect(mobileBottomNav).toContain("primaryLimit");
  });

  it("restores left-account, center-content, and right-activity composition", () => {
    expect(wrapper).toContain("<AuthenticatedSocialFrame");
    expect(frame).toContain('data-testid="authenticated-social-frame"');
    expect(frame).toContain('aria-label="Account shortcuts"');
    expect(frame).toContain('data-testid="authenticated-social-frame-content"');
    expect(frame).toContain('aria-label="Activity and quick actions"');
    expect(frame).toContain("Start a Request");
    expect(frame).toContain("Your activity");
  });

  it("never applies the signed-in frame or desktop bottom nav to public/custom profiles", () => {
    expect(wrapper).toContain("__TS_CUSTOM_DOMAIN_PROFILE_SLUG__");
    expect(wrapper).toContain("isPublicProfileLikePath(pathOnly)");
    expect(wrapper).toContain('/^\\/(?:u|p)\\/[^/]+(?:\\/|$)/i');
    expect(wrapper).toContain('/^\\/business\\/[^/]+(?:\\/edit)?$/i');
    expect(wrapper).toContain('pathOnly === "/jw-stone"');
    expect(wrapper).toContain("!isPublicProfileSurface");
  });
});
