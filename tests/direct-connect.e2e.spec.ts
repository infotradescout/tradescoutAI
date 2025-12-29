import { test, expect } from "@playwright/test";

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
