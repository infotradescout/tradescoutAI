import { test, expect } from "./fixtures/botArmy";

// If there is no dedicated test database configured, skip this suite.
// CI should set TEST_DATABASE_URL so that E2E runs against a disposable DB.
test.skip(!process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL not set for Direct Connect E2E");

// Basic Direct Connect smoke: requester can create and route a request,
// and see it reflected in the My Requests view.

test.describe("Direct Connect", () => {
  test("request can be created and routed from Direct Connect", async ({ page }) => {
    // Assumes global-setup logged in a test user via storageState.

    await page.goto("/direct-connect");

    const titleText = `Playwright DC request ${Date.now()}`;

    // Create a new Direct Connect request (current flow: Basics -> Details -> Review)
    await page.getByPlaceholder(/help moving a couch/i).fill(titleText);
    const uniqueDescription = `Playwright smoke test for Direct Connect loop (${titleText}).`;
    await page
      .getByPlaceholder(/what needs to be done, when, and any requirements/i)
      .fill(uniqueDescription);

    const nextButton = page.getByRole("button", { name: /^Next$/i });
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    // Step 2/3 (Details) doesn't include pay amount yet; advance to Review.
    await expect(page.getByText(/Step\s*2\/3/i)).toBeVisible();

    // Set a deterministic mapped category so posting still has a resolved trade
    // even if this environment has no explicit trade options loaded.
    const categoryBlock = page
      .getByText(/^Category$/i)
      .first()
      .locator("..");
    const categoryCombo = categoryBlock.getByRole("combobox").first();
    await categoryCombo.click();
    const basicRepairsCategory = page
      .locator('[role="option"]:visible')
      .filter({ hasText: /Basic Repairs & Maintenance/i })
      .first();
    if (await basicRepairsCategory.isVisible().catch(() => false)) {
      await basicRepairsCategory.click();
    } else {
      const fallbackCategoryOption = page.locator('[role="option"]:visible').nth(1);
      if (await fallbackCategoryOption.isVisible().catch(() => false)) {
        await fallbackCategoryOption.click();
      }
    }

    // Trade selection is required for routing; prefer the deterministic seed trade
    // (added by bootstrap-test-db) to keep routing gates stable.
    const tradeBlock = page
      .getByText(/Trade\s*\/\s*Service/i)
      .first()
      .locator("..");
    const tradeCombo = tradeBlock.getByRole("combobox").first();
    await tradeCombo.click();
    let preferredTradeName: string | null = null;
    try {
      const tradesRes = await page.request.get("/api/trades");
      if (tradesRes.ok()) {
        const trades = (await tradesRes.json()) as any[];
        const preferred =
          Array.isArray(trades) && trades.find((t) => String(t?.slug || "") === "moving-help");
        if (preferred?.name) {
          preferredTradeName = String(preferred.name);
        }
      }
    } catch {
      // fall back
    }

    if (preferredTradeName) {
      const seededTradeOption = page
        .locator('[role="option"]:visible')
        .filter({ hasText: preferredTradeName })
        .first();
      await expect(seededTradeOption).toBeVisible();
      await seededTradeOption.click();
    } else {
      const visibleTradeOptions = page.locator('[role="option"]:visible');
      const tradeOptionCount = await visibleTradeOptions.count();
      const fallbackTradeOption = visibleTradeOptions.nth(tradeOptionCount > 1 ? 1 : 0);
      await expect(fallbackTradeOption).toBeVisible();
      await fallbackTradeOption.click();
    }

    await expect(nextButton).toBeEnabled();
    await nextButton.click();
    await expect(page.getByText(/Step\s*3\/3/i)).toBeVisible();

    const payAmount = page.getByPlaceholder(/e\.g\., 150/i);
    await expect(payAmount).toBeVisible();
    await payAmount.fill("150");

    // County is required for posting (routing container).
    const setCountyButton = page.getByRole("button", { name: /^Set$/i }).first();
    if (await setCountyButton.isVisible().catch(() => false)) {
      let countyFips = "04013"; // fallback (Maricopa, AZ) - must exist in seeded data
      try {
        const countiesRes = await page.request.get("/api/counties");
        if (countiesRes.ok()) {
          const counties = (await countiesRes.json()) as any[];
          const list = Array.isArray(counties) ? counties : [];
          const preferred = list.find((c) => String(c?.fips || "") === "04013") ?? list[0];
          const candidate =
            preferred?.fips ||
            preferred?.countyFips ||
            preferred?.county_fips ||
            preferred?.county_fips_code;
          if (typeof candidate === "string" && candidate.trim().length === 5) {
            countyFips = candidate.trim();
          }
        }
      } catch {
        // fall back
      }

      await setCountyButton.click();
      const countyInput = page.getByPlaceholder(/Enter county FIPS code/i);
      await expect(countyInput).toBeVisible();
      await countyInput.fill(countyFips);
      await countyInput.press("Enter");
    }

    const postButton = page.getByRole("button", { name: /^Post request$/i });
    const createResponsePromise = page.waitForResponse((res) => {
      try {
        return (
          res.request().method() === "POST" &&
          res.url().includes("/api/direct-connect/requests") &&
          res.status() === 201
        );
      } catch {
        return false;
      }
    });

    await postButton.click();
    const createResponse = await createResponsePromise;
    const createdPayload = (await createResponse.json().catch(() => null)) as any;
    const createdId = createdPayload?.id ? String(createdPayload.id) : null;

    // Wait for the request to be persisted before switching views.
    await expect
      .poll(
        async () => {
          const listRes = await page.request.get("/api/direct-connect/requests");
          if (!listRes.ok()) return false;
          const requests = (await listRes.json()) as any[];
          return Boolean(
            requests.find((r) =>
              createdId ? String(r.id) === createdId : String(r.title || "") === titleText
            )
          );
        },
        { timeout: 20_000 }
      )
      .toBeTruthy();

    // Navigate to My requests and confirm the new request appears.
    const goToMyRequests = page.getByRole("button", { name: /Go to My Requests/i }).first();
    if (await goToMyRequests.isVisible().catch(() => false)) {
      await goToMyRequests.click();
    } else {
      await page.getByRole("button", { name: "My Requests", exact: true }).click();
    }

    if (createdId) {
      await expect(page.getByTestId(`dc-request-${createdId}`)).toBeVisible();
    } else {
      await expect(page.getByText("Playwright DC request").first()).toBeVisible();
    }

    const requestCardContainer = createdId
      ? page.getByTestId(`dc-request-${createdId}`)
      : page.locator('[data-testid^="dc-request-"]').first();

    // Messaging stays locked until a provider accepts.
    const messagesButton = requestCardContainer.getByRole("button", { name: /messages/i });
    await expect(messagesButton).toBeDisabled();

    // At least one "Why?" affordance should be present to explain gating.
    await expect(
      requestCardContainer.getByRole("button", { name: /why\?/i }).first()
    ).toBeVisible();

    // Best-effort: call the routing endpoint via the page's authenticated request context
    const listRes = await page.request.get("/api/direct-connect/requests");
    expect(listRes.ok()).toBeTruthy();
    const requests = (await listRes.json()) as any[];
    const created = requests.find((r) =>
      createdId ? String(r.id) === createdId : String(r.title || "") === titleText
    );
    expect(created).toBeTruthy();

    const firstRouteRes = await page.request.post(
      `/api/direct-connect/requests/${created.id}/route`
    );
    const firstRouteBody = (await firstRouteRes.json().catch(() => null)) as any;
    expect(
      firstRouteRes.ok(),
      `route failed: status=${firstRouteRes.status()} body=${JSON.stringify(firstRouteBody)}`
    ).toBeTruthy();
    expect(firstRouteBody.routed).toBeTruthy();

    // Idempotency guard: repeated routing without expand=true should succeed
    // but report routed: false and avoid creating duplicate events.
    const secondRouteRes = await page.request.post(
      `/api/direct-connect/requests/${created.id}/route`
    );
    expect(secondRouteRes.ok()).toBeTruthy();
    const secondRouteBody = (await secondRouteRes.json()) as any;
    expect(secondRouteBody.routed).toBeFalsy();

    // Refresh My requests and ensure it now shows routing context
    await page.reload();
    const goToMyRequestsAfter = page.getByRole("button", { name: /Go to My Requests/i }).first();
    if (await goToMyRequestsAfter.isVisible().catch(() => false)) {
      await goToMyRequestsAfter.click();
    } else {
      await page.getByRole("button", { name: "My Requests", exact: true }).click();
    }

    if (createdId) {
      await expect(page.getByTestId(`dc-request-${createdId}`)).toBeVisible();
    } else {
      await expect(page.getByText(titleText).first()).toBeVisible();
    }

    // Cancel and reopen safety valve: best-effort exercise of the new
    // defensive endpoints without changing the happy path.
    const cancelRes = await page.request.post(`/api/direct-connect/requests/${created.id}/cancel`);
    expect(cancelRes.ok()).toBeTruthy();
    const cancelBody = (await cancelRes.json()) as any;
    expect(cancelBody.status).toBe("cancelled");

    const reopenRes = await page.request.post(`/api/direct-connect/requests/${created.id}/reopen`);
    expect(reopenRes.ok()).toBeTruthy();
    const reopenBody = (await reopenRes.json()) as any;
    expect(reopenBody.status).toBe("open");

    // Provider inbox decline path (best-effort): if this test user has any
    // Direct Connect inbox items for the created request, decline one and
    // confirm it no longer appears in the inbox list.
    const inboxRes = await page.request.get("/api/direct-connect/inbox");
    expect(inboxRes.ok()).toBeTruthy();
    const inboxItems = (await inboxRes.json()) as any[];

    const target = inboxItems.find((item) => item?.assignment?.workRequestId === created.id);
    if (target) {
      const declineRes = await page.request.post(
        `/api/direct-connect/assignments/${target.assignment.id}/respond`,
        {
          data: { decision: "decline", reason: "Unavailable" },
        }
      );
      expect(declineRes.ok()).toBeTruthy();

      const inboxAfterRes = await page.request.get("/api/direct-connect/inbox");
      expect(inboxAfterRes.ok()).toBeTruthy();
      const inboxAfter = (await inboxAfterRes.json()) as any[];
      const stillThere = inboxAfter.find((item) => item?.assignment?.id === target.assignment.id);
      expect(stillThere).toBeFalsy();
    }
  });
});
