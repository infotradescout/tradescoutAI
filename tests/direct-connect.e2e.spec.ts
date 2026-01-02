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

    // Create a new Direct Connect request from the Post tab
    await page.getByRole("tab", { name: /start a direct connect request/i }).click();

    const titleText = `Playwright DC request ${Date.now()}`;

    await page.getByPlaceholder(/help moving a couch/i).fill(titleText);
    await page
      .getByPlaceholder(/what needs to be done, when, and any requirements/i)
      .fill("Playwright smoke test for Direct Connect loop.");
    await page.getByPlaceholder(/e\.g\., 150/i).fill("150");

    await page.getByRole("button", { name: /post direct connect request/i }).click();

    // Navigate to My requests and confirm the new request appears
    await page.getByRole("button", { name: /my requests/i }).click();

    const requestCard = page.getByText(titleText).first();
    await expect(requestCard).toBeVisible();

    // Inline "Why?" affordances on an open, not-routed request.
    const routingLine = page.locator("span").filter({ hasText: "Not routed yet" }).first();
    await expect(routingLine.getByRole("button", { name: /why\?/i })).toBeVisible();

    // Messaging stays locked until a provider accepts; in this state we expect
    // a second "Why?" affordance explaining the messaging rule.
    const whyButtons = page.getByRole("button", { name: /why\?/i });
    await expect(whyButtons).toHaveCount(2);

    // Best-effort: call the routing endpoint via the page's authenticated request context
    const listRes = await page.request.get("/api/direct-connect/requests");
    expect(listRes.ok()).toBeTruthy();
    const requests = (await listRes.json()) as any[];
    const created = requests.find((r) => r.title === titleText);
    expect(created).toBeTruthy();

    const firstRouteRes = await page.request.post(`/api/direct-connect/requests/${created.id}/route`);
    expect(firstRouteRes.ok()).toBeTruthy();
    const firstRouteBody = (await firstRouteRes.json()) as any;
    expect(firstRouteBody.routed).toBeTruthy();

    // Idempotency guard: repeated routing without expand=true should succeed
    // but report routed: false and avoid creating duplicate events.
    const secondRouteRes = await page.request.post(`/api/direct-connect/requests/${created.id}/route`);
    expect(secondRouteRes.ok()).toBeTruthy();
    const secondRouteBody = (await secondRouteRes.json()) as any;
    expect(secondRouteBody.routed).toBeFalsy();

    // Refresh My requests and ensure it now shows routing context
    await page.reload();
    await page.getByRole("button", { name: /my requests/i }).click();

    const routedRow = page.getByText(titleText).first();
    await expect(routedRow).toBeVisible();

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
        },
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
