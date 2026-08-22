import { test, expect } from "./fixtures/botArmy";

// Basic e2e guard: community feed shows posts for the user's county

test.describe("Community feed scoped to user county", () => {
  test("shows county posts on /community-feed", async ({ page }) => {
    // Assumes fixture session authentication.

    await page.goto("/community-feed");

    // Wait for at least one post card to appear
    const postCards = page.locator('[data-testid="community-post-card"]');
    await expect(postCards.first()).toBeVisible();

    // Spot check that at least one post shows some content
    const firstText = await postCards.first().innerText();
    expect(firstText.length).toBeGreaterThan(0);
  });

  test("keeps every authenticated feed view visible at mobile widths", async ({ page }) => {
    for (const width of [320, 360, 390, 640]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/community-feed");

      const viewbar = page.getByTestId("community-feed-view-controls");
      await expect(viewbar).toBeVisible();
      await expect(viewbar.getByRole("button", { name: "Saved" })).toBeVisible();

      const geometry = await viewbar.evaluate((element) => {
        const nav = element.getBoundingClientRect();
        const buttons = Array.from(element.querySelectorAll("button"));
        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          labels: buttons.map((button) => button.textContent?.trim()),
          tops: buttons.map((button) => button.getBoundingClientRect().top),
          allContained: buttons.every((button) => {
            const rect = button.getBoundingClientRect();
            return rect.left >= nav.left - 1 && rect.right <= nav.right + 1;
          }),
          allTouchHeight: buttons.every(
            (button) => button.getBoundingClientRect().height >= 44
          ),
        };
      });

      expect(geometry.labels).toEqual(["Near me", "Explore", "For you", "Newest", "Saved"]);
      expect(geometry.allContained).toBe(true);
      expect(geometry.allTouchHeight).toBe(true);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
      expect(Math.abs(geometry.tops[0] - geometry.tops[1])).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.tops[2] - geometry.tops[3])).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.tops[3] - geometry.tops[4])).toBeLessThanOrEqual(1);
      expect(geometry.tops[2]).toBeGreaterThan(geometry.tops[0]);

      if (width === 390) {
        const saved = viewbar.getByRole("button", { name: "Saved" });
        await saved.focus();
        const focusState = await saved.evaluate((button) => {
          const nav = button.closest('[data-testid="community-feed-view-controls"]');
          const navStyle = nav ? getComputedStyle(nav) : null;
          return {
            active: document.activeElement === button,
            overflowX: navStyle?.overflowX,
            overflowY: navStyle?.overflowY,
          };
        });
        expect(focusState).toEqual({
          active: true,
          overflowX: "visible",
          overflowY: "visible",
        });
      }
    }

    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    const zoomedViewbar = page.getByTestId("community-feed-view-controls");
    const zoomedGeometry = await zoomedViewbar.evaluate((element) => {
      const nav = element.getBoundingClientRect();
      const buttons = Array.from(element.querySelectorAll("button"));
      return {
        allContained: buttons.every((button) => {
          const rect = button.getBoundingClientRect();
          return rect.left >= nav.left - 1 && rect.right <= nav.right + 1;
        }),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    });
    expect(zoomedGeometry.allContained).toBe(true);
    expect(zoomedGeometry.scrollWidth).toBeLessThanOrEqual(zoomedGeometry.clientWidth + 1);

    await page.evaluate(() => {
      document.documentElement.style.fontSize = "";
    });
    await page.setViewportSize({ width: 641, height: 844 });
    const desktopViewbar = page.getByTestId("community-feed-view-controls");
    await expect(desktopViewbar).toHaveCSS("flex-wrap", "nowrap");
    const desktopGeometry = await desktopViewbar.evaluate((element) => {
      const nav = element.getBoundingClientRect();
      return {
        allContained: Array.from(element.querySelectorAll("button")).every((button) => {
          const rect = button.getBoundingClientRect();
          return rect.left >= nav.left - 1 && rect.right <= nav.right + 1;
        }),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    });
    expect(desktopGeometry.allContained).toBe(true);
    expect(desktopGeometry.scrollWidth).toBeLessThanOrEqual(desktopGeometry.clientWidth + 1);

    for (const name of ["Near me", "Saved"]) {
      const control = desktopViewbar.getByRole("button", { name });
      await control.focus();
      const focusClearance = await control.evaluate((button) => {
        const nav = button.closest('[data-testid="community-feed-view-controls"]');
        if (!nav) return null;
        const navRect = nav.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        return {
          active: document.activeElement === button,
          top: buttonRect.top - navRect.top,
          left: buttonRect.left - navRect.left,
          right: navRect.right - buttonRect.right,
          bottom: navRect.bottom - buttonRect.bottom,
        };
      });
      expect(focusClearance?.active).toBe(true);
      expect(focusClearance?.top).toBeGreaterThanOrEqual(4);
      expect(focusClearance?.left).toBeGreaterThanOrEqual(4);
      expect(focusClearance?.right).toBeGreaterThanOrEqual(4);
      expect(focusClearance?.bottom).toBeGreaterThanOrEqual(4);
    }
  });
});
