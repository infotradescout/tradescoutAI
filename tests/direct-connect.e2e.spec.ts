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

    const titleText = `Playwright DC request ${Date.now()}`;
    const descriptionText = `Playwright smoke test for Direct Connect loop (${titleText}).`;

    await page.getByPlaceholder(/I need help with/i).fill(titleText);
    await page.getByPlaceholder(/What needs to be done, when you need it/i).fill(descriptionText);

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
    const createResponse = await createResponsePromise;
    const createdPayload = (await createResponse.json().catch(() => null)) as any;
    const createdId = createdPayload?.id ? String(createdPayload.id) : null;
    expect(createdId).toBeTruthy();
    expect(String(createdPayload?.status || "")).not.toBe("draft");

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

    // Best-effort: call the routing endpoint via the page's authenticated request context.
    const listRes = await page.request.get("/api/direct-connect/requests");
    expect(listRes.ok()).toBeTruthy();
    const requests = (await listRes.json()) as any[];
    const created = requests.find((r) =>
      createdId ? String(r.id) === createdId : String(r.title || "") === titleText
    );
    expect(created).toBeTruthy();
    expect(String(created.status || "")).not.toBe("draft");

    const firstRouteRes = await page.request.post(
      `/api/direct-connect/requests/${created.id}/route`
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
      `/api/direct-connect/requests/${created.id}/route`
    );
    expect(secondRouteRes.ok()).toBeTruthy();
    const secondRouteBody = (await secondRouteRes.json()) as any;
    expect(secondRouteBody.routed).toBeFalsy();

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
