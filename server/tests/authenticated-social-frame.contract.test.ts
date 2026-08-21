import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const wrapper = read("client/src/components/layout/AppShell.tsx");
const core = read("client/src/components/layout/AppShellCore.tsx");
const mobileBottomNav = read("client/src/components/navigation/MobileAppBar.tsx");
const scoutHome = read("client/src/scout/ScoutHome.tsx");
const scoutOs = read("client/src/scout/ScoutOS.tsx");
const scoutSearchDock = read("client/src/scout/ScoutSearchDock.tsx");
const styles = read("client/src/index.css");
const community = read("client/src/pages/community-feed.tsx");
const jobs = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

describe("signed-in TradeScout OS shell", () => {
  it("gives each app one full-width workspace without a universal social frame", () => {
    expect(wrapper).toContain('import AppShellCore from "./AppShellCore"');
    expect(wrapper).toContain(
      "<AppShellCore footer={showDesktopBottomNav ? undefined : footer}>{children}</AppShellCore>"
    );
    expect(wrapper).not.toContain("AuthenticatedSocialFrame");
    expect(wrapper).not.toContain("showAuthenticatedSocialFrame");
    expect(wrapper).not.toContain('data-testid="authenticated-social-frame"');
  });

  it("keeps brand and compact system actions at the top without competing route navigation", () => {
    expect(core).toContain("TradeScoutLogo");
    expect(core).toContain('aria-label="Open Start here guide"');
    expect(core).toContain('aria-label="Open profile & tools panel"');
    expect(core).toContain('["/api/social/conversations/requests/incoming"]');
    expect(core).toContain("contactRequestCount");
    expect(core).toContain('aria-label="Messages and helpers"');
    expect(core).toContain('"/direct-connect/inbox?filter=requests"');
    expect(core).toContain("contactRequestCount={contactRequestCount}");
    expect(core).not.toContain("ts-desktop-primary-nav");
    expect(core).not.toContain('aria-label="Primary"');
    expect(core).not.toContain("desktopPrimaryNav");
    expect(core).not.toContain("What can I do?");
    expect(styles).not.toContain(".ts-desktop-primary-nav");
    expect(styles).not.toContain(".ts-desktop-nav-item");
  });

  it("keeps account tools on demand with no persistent right-rail escape hatch", () => {
    expect(core).not.toContain("VITE_PIN_RIGHT_TOOLS_V1");
    expect(core).not.toContain("shouldPinRightTools");
    expect(core).not.toContain("RIGHT_TOOLS_COLLAPSED_KEY");
    expect(core).not.toContain("RIGHT_TOOLS_COLLAPSED_W");
    expect(core).not.toContain("isRightToolsCollapsed");
    expect(core).not.toContain("toggleRightToolsCollapsed");
    expect(core).toContain("{!isMobile && isToolsOpen && !isAuthOrSetupSurface && (");
    expect(core).toContain("<RightToolsPanel");
    expect(core).toContain("contactRequestCount={contactRequestCount}");
    expect(core).toContain("onNavigate={() => setIsToolsOpen(false)}");
  });

  it("uses the persistent bottom taskbar for primary navigation on desktop and mobile", () => {
    expect(wrapper).toContain('const DESKTOP_BOTTOM_NAV_HEIGHT = "58px"');
    expect(wrapper).toContain('data-testid="desktop-bottom-nav"');
    expect(wrapper).toContain("<MobileAppBar items={desktopBottomNavItems} primaryLimit={5} />");
    expect(wrapper).toContain("ts-desktop-bottom-nav-active");
    expect(wrapper).toContain("bottom: ${DESKTOP_BOTTOM_NAV_HEIGHT} !important;");

    expect(core).toContain("MOBILE FEATURE NAV");
    expect(core).toContain("isMobileSimplified ? mobileFlowNav : mobileNav.ordered");
    expect(mobileBottomNav).toContain('className="ts-bottom-nav');
    expect(mobileBottomNav).toContain("primaryLimit");
  });

  it("puts Scout's primary outcome input before continuation and clears both taskbars", () => {
    const homeMarkup = scoutHome.slice(scoutHome.lastIndexOf("return ("));
    const inputIndex = homeMarkup.indexOf("{primaryOutcomeInput}");
    const continuationIndex = homeMarkup.indexOf("<ScoutControlSnapshot");

    expect(inputIndex).toBeGreaterThan(-1);
    expect(continuationIndex).toBeGreaterThan(inputIndex);
    expect(scoutSearchDock).toContain('placement?: "inline" | "fixed"');
    expect(scoutSearchDock).toContain('data-testid="scout-primary-outcome-input"');
    expect(scoutSearchDock).toContain('placement === "inline"');
    expect(styles).toContain(".scout-search-dock-inline");
    expect(scoutOs).toContain('placement="inline"');
    expect(scoutOs).toContain("{hasUserMessages ? (");
    expect(scoutOs).toContain('placement="fixed"');
    expect(wrapper).toContain("bottom: calc(${DESKTOP_BOTTOM_NAV_HEIGHT} + 0.5rem) !important;");
  });

  it("keeps Community feed controls and Jobs tabs responsive without changing their product roles", () => {
    expect(community).toContain(
      'className="ts-community-viewbar mb-3 flex flex-nowrap items-center gap-1.5 overflow-x-auto'
    );
    expect(styles).toMatch(/\.ts-community-viewbar\s*\{[^}]*flex-wrap:\s*nowrap;/s);
    expect(styles).toMatch(/\.ts-community-viewbar\s*\{[^}]*overflow-x:\s*auto;/s);
    expect(styles).not.toMatch(/\.ts-community-viewbar\s*\{[^}]*flex-wrap:\s*wrap;/s);
    expect(styles).toMatch(/\.ts-community-viewbar__item\s*\{[^}]*min-height:\s*44px;/s);
    expect(community).toContain('data-testid="community-start-actions"');
    expect(community).toContain("<details");
    expect(community).toContain(
      'className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"'
    );
    expect(community).not.toContain("lg:grid-cols-[minmax(0,1fr)_300px]");
    expect(community).toContain("xl:grid-cols-[minmax(0,1fr)_300px]");

    expect(jobs).toContain('className="w-full max-w-full overflow-x-hidden"');
    expect(jobs).toContain('className="grid grid-cols-3 gap-1 md:flex');
    expect(jobs).toContain("SECTION_SHORT_LABELS[section]");
    expect(jobs).toContain("min-w-0 items-center justify-center");
  });

  it("never applies the signed-in desktop taskbar to public or custom profiles", () => {
    expect(wrapper).toContain("__TS_CUSTOM_DOMAIN_PROFILE_SLUG__");
    expect(wrapper).toContain("isPublicProfileLikePath(pathOnly)");
    expect(wrapper).toContain("/^\\/(?:u|p)\\/[^/]+(?:\\/|$)/i");
    expect(wrapper).toContain("/^\\/business\\/[^/]+(?:\\/edit)?$/i");
    expect(wrapper).toContain('pathOnly === "/jw-stone"');
    expect(wrapper).toContain("!isPublicProfileSurface");
  });
});
