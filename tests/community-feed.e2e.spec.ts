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
          allTouchHeight: buttons.every((button) => button.getBoundingClientRect().height >= 44),
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

  test("keeps the composer and primary Post action reachable without submitting", async ({
    page,
  }) => {
    const communityCreateRequests: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/community/posts"
      ) {
        communityCreateRequests.push(request.url());
      }
    });

    await page.addInitScript(() => {
      window.localStorage.setItem("ts:start-guide-seen-v1", "1");
    });

    for (const width of [320, 390, 640, 641]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/community-feed");
      await page.getByRole("button", { name: "Create post" }).click();

      const composer = page.getByTestId("community-post-composer");
      await expect(composer).toBeVisible();
      const mobileGeometry = await composer.evaluate((element) => {
        const card = element.getBoundingClientRect();
        const body = element.querySelector(".ts-community-composer__body");
        const textarea = element.querySelector(".ts-community-composer__input");
        const actions = element.querySelector(".ts-community-composer__actions");
        const attachments = element.querySelector(".ts-community-composer__attachments");
        const submit = element.querySelector(".ts-community-submit-action");
        const contained = (child: Element | null) => {
          if (!child) return false;
          const rect = child.getBoundingClientRect();
          return rect.left >= card.left - 1 && rect.right <= card.right + 1;
        };

        return {
          cardClientWidth: element.clientWidth,
          cardScrollWidth: element.scrollWidth,
          bodyContained: contained(body),
          textareaContained: contained(textarea),
          actionsContained: contained(actions),
          attachmentsContained: contained(attachments),
          attachmentsClientWidth: attachments?.clientWidth || 0,
          attachmentsScrollWidth: attachments?.scrollWidth || 0,
          submitContained: contained(submit),
          submitHeight: submit?.getBoundingClientRect().height || 0,
          documentClientWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
        };
      });

      expect(mobileGeometry.bodyContained).toBe(true);
      expect(mobileGeometry.textareaContained).toBe(true);
      expect(mobileGeometry.actionsContained).toBe(true);
      expect(mobileGeometry.attachmentsContained).toBe(true);
      expect(mobileGeometry.submitContained).toBe(true);
      expect(mobileGeometry.submitHeight).toBeGreaterThanOrEqual(44);
      expect(mobileGeometry.cardScrollWidth).toBeLessThanOrEqual(
        mobileGeometry.cardClientWidth + 1
      );
      expect(mobileGeometry.documentScrollWidth).toBeLessThanOrEqual(
        mobileGeometry.documentClientWidth + 1
      );

      const attachments = composer.locator(".ts-community-composer__attachments");
      if (width <= 640) {
        await expect(attachments).toHaveCSS("overflow-x", "auto");
      }
      if (width === 320) {
        expect(mobileGeometry.attachmentsScrollWidth).toBeGreaterThan(
          mobileGeometry.attachmentsClientWidth
        );
      }
      for (const name of ["Photo", "Poll"]) {
        const action = attachments.getByRole("button", { name });
        await action.scrollIntoViewIfNeeded();
        await action.focus();
        const actionGeometry = await action.evaluate((button) => {
          const strip = button.closest(".ts-community-composer__attachments");
          if (!strip) return null;
          const stripRect = strip.getBoundingClientRect();
          const buttonRect = button.getBoundingClientRect();
          const submit = document.querySelector(".ts-community-submit-action");
          const card = document.querySelector('[data-testid="community-post-composer"]');
          const submitRect = submit?.getBoundingClientRect();
          const cardRect = card?.getBoundingClientRect();
          const submitContained =
            submitRect !== undefined &&
            cardRect !== undefined &&
            submitRect.left >= cardRect.left - 1 &&
            submitRect.right <= cardRect.right + 1;
          return {
            active: document.activeElement === button,
            left: buttonRect.left - stripRect.left,
            right: stripRect.right - buttonRect.right,
            submitContained,
          };
        });
        expect(actionGeometry?.active, `${width}px ${name} focus`).toBe(true);
        expect(actionGeometry?.left, `${width}px ${name} left`).toBeGreaterThanOrEqual(-1);
        expect(actionGeometry?.right, `${width}px ${name} right`).toBeGreaterThanOrEqual(-1);
        expect(actionGeometry?.submitContained, `${width}px Post after ${name}`).toBe(true);
      }
    }

    for (const viewport of [
      { width: 768, height: 320 },
      { width: 1440, height: 480 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/community-feed");
      await page.getByRole("button", { name: "Create post" }).click();

      const composer = page.getByTestId("community-post-composer");
      const textarea = composer.locator(".ts-community-composer__input");
      const cancel = composer.getByRole("button", { name: "Cancel" });
      const updateCategory = composer.getByRole("button", { name: "Update" });
      const eventCategory = composer.getByRole("button", { name: "Event" });
      const saleCategory = composer.getByRole("button", { name: "For Sale" });
      const photo = composer.getByRole("button", { name: "Photo" });
      const video = composer.getByRole("button", { name: "Video" });
      const poll = composer.getByRole("button", { name: "Poll" });
      const submit = composer.getByTestId("button-submit-post");

      await expect(composer).toHaveCSS("position", "static");
      await textarea.fill("D10 local layout proof — do not submit");

      for (const [name, control] of [
        ["Cancel", cancel],
        ["composer textarea", textarea],
        ["Update category", updateCategory],
        ["Event category", eventCategory],
        ["For Sale category", saleCategory],
        ["Photo", photo],
        ["Video", video],
        ["Poll", poll],
        ["Post", submit],
      ] as const) {
        await control.scrollIntoViewIfNeeded();
        await control.focus();
        const clearance = await control.evaluate((element) => {
          const root = document.querySelector("#app-scroll-root");
          if (!root) return null;
          const rootRect = root.getBoundingClientRect();
          const controlRect = element.getBoundingClientRect();
          return {
            active: document.activeElement === element,
            top: controlRect.top - rootRect.top,
            bottom: rootRect.bottom - controlRect.bottom,
            left: controlRect.left - rootRect.left,
            right: rootRect.right - controlRect.right,
          };
        });

        expect(clearance, `${viewport.width}x${viewport.height} ${name}`).not.toBeNull();
        expect(clearance?.active, `${viewport.width}x${viewport.height} ${name} focus`).toBe(true);
        expect(
          clearance?.top,
          `${viewport.width}x${viewport.height} ${name} top`
        ).toBeGreaterThanOrEqual(-1);
        expect(
          clearance?.bottom,
          `${viewport.width}x${viewport.height} ${name} bottom`
        ).toBeGreaterThanOrEqual(-1);
        expect(
          clearance?.left,
          `${viewport.width}x${viewport.height} ${name} left`
        ).toBeGreaterThanOrEqual(-1);
        expect(
          clearance?.right,
          `${viewport.width}x${viewport.height} ${name} right`
        ).toBeGreaterThanOrEqual(-1);
      }

      await cancel.scrollIntoViewIfNeeded();
      await cancel.focus();
      const headingClearance = await composer
        .getByTestId("community-composer-heading")
        .evaluate((element) => {
          const root = document.querySelector("#app-scroll-root");
          if (!root) return null;
          const rootRect = root.getBoundingClientRect();
          const headingRect = element.getBoundingClientRect();
          return {
            top: headingRect.top - rootRect.top,
            bottom: rootRect.bottom - headingRect.bottom,
          };
        });
      expect(headingClearance?.top).toBeGreaterThanOrEqual(-1);
      expect(headingClearance?.bottom).toBeGreaterThanOrEqual(-1);
    }

    await page.setViewportSize({ width: 1440, height: 844 });
    await page.goto("/community-feed");
    await page.getByRole("button", { name: "Create post" }).click();
    const normalHeightComposer = page.getByTestId("community-post-composer");
    await expect(normalHeightComposer).toHaveCSS("position", "sticky");
    await expect(normalHeightComposer).toHaveCSS("top", "8px");

    const normalHeightScrollRoot = page.locator("#app-scroll-root");
    const stickySetup = await normalHeightComposer.evaluate((element) => {
      const root = document.querySelector<HTMLElement>("#app-scroll-root");
      if (!root) return null;
      const rootRect = root.getBoundingClientRect();
      const composerRect = element.getBoundingClientRect();
      return {
        composerTop: composerRect.top - rootRect.top,
        maxScrollTop: root.scrollHeight - root.clientHeight,
        rootScrollTop: root.scrollTop,
      };
    });
    expect(stickySetup).not.toBeNull();
    const stickyThreshold = Math.max(0, (stickySetup?.composerTop || 0) - 8);
    const stickyTarget = Math.min(
      stickySetup?.maxScrollTop || 0,
      (stickySetup?.rootScrollTop || 0) + stickyThreshold + 48
    );
    expect(stickyTarget - (stickySetup?.rootScrollTop || 0)).toBeGreaterThan(stickyThreshold);

    await normalHeightScrollRoot.evaluate((root, target) => {
      root.scrollTop = target;
    }, stickyTarget);
    await expect
      .poll(() => normalHeightScrollRoot.evaluate((root) => root.scrollTop))
      .toBeGreaterThan(stickySetup?.rootScrollTop || 0);

    const pinnedGeometry = await normalHeightComposer.evaluate((element) => {
      const root = document.querySelector<HTMLElement>("#app-scroll-root");
      if (!root) return null;
      const rootRect = root.getBoundingClientRect();
      const composerRect = element.getBoundingClientRect();
      return {
        rootScrollTop: root.scrollTop,
        top: composerRect.top - rootRect.top,
      };
    });
    expect(pinnedGeometry?.rootScrollTop).toBeGreaterThan(stickySetup?.rootScrollTop || 0);
    expect(pinnedGeometry?.top).toBeGreaterThanOrEqual(7);
    expect(pinnedGeometry?.top).toBeLessThanOrEqual(9);

    expect(communityCreateRequests).toEqual([]);
  });
});
