import { test, expect } from "./fixtures/botArmy";

const routes: { path: string; sectionLabel: string }[] = [
  { path: "/community", sectionLabel: "Community" },
  { path: "/groups", sectionLabel: "Groups" },
  { path: "/hoa-management", sectionLabel: "HOA" },
  { path: "/hoa-dashboard", sectionLabel: "HOA Dashboard" },
  { path: "/messages", sectionLabel: "Messages" },
  { path: "/community-feed", sectionLabel: "Community Feed" },
];

test.describe("CommunityShell layout + navigation", () => {
  for (const route of routes) {
    test(`renders header + bottom nav correctly on ${route.path}` , async ({ page }) => {
      await page.goto(`http://localhost:5173${route.path}`);

      const locationEl = page.getByTestId("community-shell-header-location");
      const sectionEl = page.getByTestId("community-shell-header-section");

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
