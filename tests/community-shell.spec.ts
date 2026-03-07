import { test, expect } from "./fixtures/botArmy";

const routes: { path: string; sectionLabel: string; requiresAuth?: boolean }[] = [
  { path: "/community", sectionLabel: "Community" },
  { path: "/groups", sectionLabel: "Groups" },
  { path: "/hoa-management", sectionLabel: "HOA", requiresAuth: true },
  { path: "/hoa-dashboard", sectionLabel: "HOA Dashboard", requiresAuth: true },
  { path: "/messages", sectionLabel: "Messages", requiresAuth: true },
  { path: "/community-feed", sectionLabel: "Community Feed" },
];

test.describe("CommunityShell layout + navigation", () => {
  for (const route of routes) {
    test(`renders header + bottom nav correctly on ${route.path}`, async ({ page, baseURL }) => {
      const target = baseURL ? `${baseURL}${route.path}` : route.path;
      await page.goto(target);

      const locationEl = page.getByTestId("community-shell-header-location");
      const sectionEl = page.getByTestId("community-shell-header-section");

      if (route.requiresAuth) {
        const hasShellHeader = await locationEl.isVisible({ timeout: 1500 }).catch(() => false);
        if (!hasShellHeader) {
          await expect(page).toHaveURL(/\/(pre-scout-setup|login)/);
          return;
        }
      }

      await expect(locationEl).toBeVisible();
      await expect(sectionEl).toHaveText(route.sectionLabel);

      await page.setViewportSize({ width: 390, height: 844 });

      const bottomNav = page.getByTestId("community-shell-bottom-nav");
      await expect(bottomNav).toBeVisible();

      const communityNav = page.getByTestId("nav-community");
      await communityNav.click();

      await expect(page).toHaveURL(/\/community/);
      await expect(communityNav).toHaveAttribute("aria-current", "page");
    });
  }
});
