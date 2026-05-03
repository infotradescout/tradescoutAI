import { test, expect } from "./fixtures/botArmy";

// If there is no dedicated test database configured, skip this suite.
// CI should set TEST_DATABASE_URL so that E2E runs against a disposable DB.
test.skip(!process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL not set for Direct Connect E2E");

// Basic Direct Connect smoke: requester can create and route a request,
// and see it reflected in the My Requests view.

test.describe("Direct Connect", () => {
  test("request can be created and routed from Direct Connect", async ({ page }) => {
    // Assumes global-setup logged in a test user via storageState.
    let countyFips = "04013";
    let stateCode = "AZ";
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

        const candidateState =
          preferred?.stateCode || preferred?.state_code || preferred?.state || preferred?.stateAbbr;
        if (typeof candidateState === "string" && candidateState.trim().length === 2) {
          stateCode = candidateState.trim().toUpperCase();
        }
      }
    } catch {
      // Keep fallback county.
    }

    // Stabilize onboarding preconditions for this user so Direct Connect opens immediately.
    // Some test accounts can still hit the "Quick profile check" gate if profile metadata drifts.
    const profileRes = await page.request.put("/api/user/profile", {
      data: {
        firstName: "Playwright",
        lastName: "E2E",
        stateCode,
        countyFips,
      },
    });
    expect(profileRes.ok(), `profile update failed: ${profileRes.status()}`).toBeTruthy();

    const onboardingRes = await page.request.post("/api/user/complete-onboarding", {
      data: {},
    });
    expect(
      onboardingRes.ok(),
      `onboarding completion failed: ${onboardingRes.status()}`
    ).toBeTruthy();

    await page.goto(`/direct-connect?county=${encodeURIComponent(countyFips)}`);

    const titleText = `Kitchen faucet repair request ${Date.now()}`;
    const descriptionText = `Need a local pro to inspect and repair a leaking kitchen faucet this week.`;

    await page.getByPlaceholder(/Need help with|I need help with/i).fill(titleText);
    await page
      .getByPlaceholder(/Describe what needs to be done|What needs to be done, when you need it/i)
      .fill(descriptionText);

    const sendButton = page.getByRole("button", { name: /Send request/i });
    await expect(sendButton).toBeEnabled();

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

    await sendButton.click();
    await expect(page.getByText(/Choose who gets this request/i)).toBeVisible();

    await page.getByRole("button", { name: /Let Scout decide/i }).click();
    const createResponse = await createResponsePromise;
    const createdPayload = (await createResponse.json().catch(() => null)) as any;
    const createdId = createdPayload?.id ? String(createdPayload.id) : null;
    expect(createdId).toBeTruthy();
    expect(String(createdPayload?.status || "")).not.toBe("draft");

    const requestId = String(createdId || "");
    expect(requestId.length).toBeGreaterThan(0);

    const firstRouteRes = await page.request.post(
      `/api/direct-connect/requests/${requestId}/route`
    );
    const firstRouteBody = (await firstRouteRes.json().catch(() => null)) as any;
    expect(
      firstRouteRes.ok(),
      `route failed: status=${firstRouteRes.status()} body=${JSON.stringify(firstRouteBody)}`
    ).toBeTruthy();
    expect(typeof firstRouteBody.routed).toBe("boolean");

    // Idempotency guard: repeated routing without expand=true should succeed
    // but report routed: false and avoid creating duplicate events.
    const secondRouteRes = await page.request.post(
      `/api/direct-connect/requests/${requestId}/route`
    );
    expect(secondRouteRes.ok()).toBeTruthy();
    const secondRouteBody = (await secondRouteRes.json()) as any;
    expect(secondRouteBody.routed).toBeFalsy();

    // Cancel and reopen safety valve: best-effort exercise of the new
    // defensive endpoints without changing the happy path.
    const cancelRes = await page.request.post(`/api/direct-connect/requests/${requestId}/cancel`);
    expect(cancelRes.ok()).toBeTruthy();
    const cancelBody = (await cancelRes.json()) as any;
    expect(cancelBody.status).toBe("cancelled");

    const reopenRes = await page.request.post(`/api/direct-connect/requests/${requestId}/reopen`);
    expect(reopenRes.ok()).toBeTruthy();
    const reopenBody = (await reopenRes.json()) as any;
    expect(reopenBody.status).toBe("open");

    // Provider inbox decline path (best-effort): if this test user has any
    // Direct Connect inbox items for the created request, decline one and
    // confirm it no longer appears in the inbox list.
    const inboxRes = await page.request.get("/api/direct-connect/inbox");
    expect(inboxRes.ok()).toBeTruthy();
    const inboxItems = (await inboxRes.json()) as any[];

    const target = inboxItems.find((item) => item?.assignment?.workRequestId === requestId);
    if (target) {
      const declineRes = await page.request.post(
        `/api/direct-connect/assignments/${target.assignment.id}/respond`,
        {
          data: { decision: "decline", reason: "Unavailable" },
        }
      );
      const declineStatus = declineRes.status();
      const declineSucceeded = declineRes.ok();
      if (!declineSucceeded) {
        // Non-fatal: requester sessions can be forbidden here, and assignments may
        // already be terminal by the time this branch executes.
        expect([403, 404, 409]).toContain(declineStatus);
      }

      const inboxAfterRes = await page.request.get("/api/direct-connect/inbox");
      expect(inboxAfterRes.ok()).toBeTruthy();
      const inboxAfter = (await inboxAfterRes.json()) as any[];
      const stillThere = inboxAfter.find((item) => item?.assignment?.id === target.assignment.id);
      if (declineSucceeded) {
        expect(stillThere).toBeFalsy();
      }
    }
  });
});
