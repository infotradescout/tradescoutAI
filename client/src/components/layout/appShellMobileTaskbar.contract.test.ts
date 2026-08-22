import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("AppShell mobile taskbar contract", () => {
  it("builds the exact five-app order, keeps Direct Connect resumable, and puts apps after it in Menu", () => {
    const shell = read("client/src/components/layout/AppShellCore.tsx");
    const primaryLabelsBlock = shell.slice(
      shell.indexOf("export const MOBILE_TASKBAR_PRIMARY_LABELS"),
      shell.indexOf("] as const", shell.indexOf("export const MOBILE_TASKBAR_PRIMARY_LABELS"))
    );
    const primaryLabels = [...primaryLabelsBlock.matchAll(/^\s+"([^"]+)",?$/gm)].map(
      (match) => match[1]
    );

    expect(primaryLabels).toEqual(["Scout", "Direct Connect", "Businesses", "Jobs", "Community"]);
    expect(shell).toContain(
      'import { DIRECT_CONNECT_TASKBAR_RESUME_HREF } from "@/pages/direct-connect/directConnectWorkspaceState"'
    );
    expect(shell).toContain('item.label === "Direct Connect"');
    expect(shell).toContain("? { ...item, href: DIRECT_CONNECT_TASKBAR_RESUME_HREF }");
    expect(shell).toContain("return [...stablePrimary, ...secondaryApps]");
  });

  it("uses one stable mobile app owner and removes contextual global workflow ordering", () => {
    const shell = read("client/src/components/layout/AppShellCore.tsx");
    const mobileBar = read("client/src/components/navigation/MobileAppBar.tsx");

    expect(shell).toContain("const mobileTaskbarNav = buildMobileAppTaskbarNav(featureNav)");
    expect(shell).toMatch(
      /<MobileAppBar\s+items=\{mobileTaskbarNav\}\s+primaryLimit=\{5\}\s+stablePrimary/
    );
    expect(shell).not.toContain("buildMobileFlowNav");
    expect(shell).not.toContain("buildMobileSimplifiedNav");
    expect(shell).not.toContain("mobileFlowNav");
    expect(mobileBar).toContain("stablePrimary?: boolean");
    expect(mobileBar).toContain("partitionMobileAppBarItems");
    expect(mobileBar).toContain('data-stable-primary={stablePrimary ? "true" : undefined}');
  });

  it("keeps Menu app-only while account and system tools stay at the top right", () => {
    const shell = read("client/src/components/layout/AppShellCore.tsx");
    const featureNav = shell.slice(
      shell.indexOf("const buildFeatureNav"),
      shell.indexOf("export const MOBILE_TASKBAR_PRIMARY_LABELS")
    );
    const coreNav = featureNav.slice(
      featureNav.indexOf("const coreNav"),
      featureNav.indexOf("const advancedNav")
    );
    const advancedNav = featureNav.slice(
      featureNav.indexOf("const advancedNav"),
      featureNav.indexOf("const includedAdvanced")
    );

    expect(featureNav).toContain('label: "Share"');
    expect(featureNav).toContain('label: "Exchange"');
    expect(featureNav).toContain('label: "Help"');
    expect(coreNav).not.toContain('label: "Share"');
    expect(advancedNav).toContain('label: "Share"');
    expect(featureNav).not.toContain('label: "Admin"');
    expect(featureNav).not.toContain('label: "Profile"');
    expect(featureNav).not.toContain('label: "Settings"');
    expect(featureNav).not.toContain('label: "Notifications"');
    expect(shell).not.toContain("topRightUnlockableItems");
    expect(shell).not.toContain("Unlockable features");
    expect(shell).not.toContain('label: "Messages"');
    expect(shell).toContain(
      "{isMobile && isToolsOpen && !isAuthOrSetupSurface && !isMobileSimplified && ("
    );
    expect(shell).toContain(
      "{isMobile && isToolsOpen && !isAuthOrSetupSurface && isMobileSimplified && ("
    );
    expect(shell).toContain("<RightToolsPanel");

    expect(shell).toContain('aria-label="Open account and tools"');
    expect(shell).toContain('label: "Profile"');
    expect(shell).toContain('label: "Profile settings"');
    expect(shell).toContain('label: "Settings"');
    expect(shell).toContain('label: "Permissions & roles"');
    expect(shell).toContain('label: "Verification"');
    expect(shell).toContain('label: "Notifications"');
    expect(shell).toContain('label: "Privacy"');
    expect(shell).toContain('label: "Security"');
    expect(shell).toContain("isAuthenticated && shouldShowAdminNav");
    expect(shell).toContain("Admin controls");
  });

  it("preserves shell exclusions, progressive exposure, bottom inset, and mobile target sizing", () => {
    const shell = read("client/src/components/layout/AppShellCore.tsx");
    const wrapper = read("client/src/components/layout/AppShell.tsx");
    const mobileBar = read("client/src/components/navigation/MobileAppBar.tsx");

    expect(shell).toContain("const showFeatureNav = !isAuthOrSetupSurface && !isAdminSurface");
    expect(shell).toContain("isOnboardingSurfacePath(location)");
    expect(shell).toContain(
      "includeAdvancedHrefs: shouldGateAdvancedNav ? unlockedAdvancedHrefs : null"
    );
    expect(shell).toContain('bottom: showFeatureNav && isMobile ? "var(--bottom-nav-h)" : 0');
    expect(shell).toContain('"calc(62px + env(safe-area-inset-bottom))"');
    expect(wrapper).toContain("!isPublicProfileSurface");
    expect(mobileBar).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(mobileBar).toContain("min-h-[44px] min-w-[44px]");
    expect(mobileBar).toContain("whitespace-normal text-center");
    expect(mobileBar).toContain("aria-label={item.label}");
  });
});
