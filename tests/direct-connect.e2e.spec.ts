import { test, expect } from "./fixtures/botArmy";
import { request } from "@playwright/test";

// If there is no dedicated test database configured, skip this suite.
// CI should set TEST_DATABASE_URL so that E2E runs against a disposable DB.
test.skip(!process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL not set for Direct Connect E2E");

// Basic Direct Connect smoke: requester can create and route a request,
// and see it reflected in the My Requests view.

test.describe("Direct Connect", () => {
  test.describe.configure({ timeout: 120_000 });
  test("anonymous visitor can draft intent but cannot post/share without authentication", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    const anonSessionId = `e2e-anon-${Date.now()}`;
    const otherSessionId = `e2e-anon-other-${Date.now()}`;
    const baseURL = process.env.BASE_URL || process.env.E2E_BASE_URL || "http://localhost:5002";

    const anonApi = await request.newContext({
      baseURL,
      extraHTTPHeaders: { "x-anonymous-session-id": anonSessionId },
      storageState: { cookies: [], origins: [] },
    });

    const createRes = await anonApi.post(
      `/api/direct-connect/requests?anonymousSessionId=${encodeURIComponent(anonSessionId)}`,
      {
        data: {
          title: `Requester faucet help ${Date.now()}`,
          description: "Requester needs help with a leaking faucet.",
          category: "service_request",
        },
      }
    );
    expect(createRes.status()).toBe(401);
    const createBody = (await createRes.json().catch(() => null)) as any;
    const createMessage = String(createBody?.message || "").toLowerCase();
    expect(
      createMessage.includes("sign in") || createMessage.includes("authentication required")
    ).toBeTruthy();

    const otherApi = await request.newContext({
      baseURL,
      extraHTTPHeaders: { "x-anonymous-session-id": otherSessionId },
      storageState: { cookies: [], origins: [] },
    });

    const releaseAsOtherRes = await otherApi.post(
      `/api/direct-connect/requests/anon-placeholder/contact-gate?anonymousSessionId=${encodeURIComponent(otherSessionId)}`,
      {
        data: { nextState: "released" },
      }
    );
    expect([401, 404]).toContain(releaseAsOtherRes.status());

    await anonApi.dispose();
    await otherApi.dispose();
  });

  test("authenticated requester can create and route through direct-connect APIs", async ({
    page,
  }) => {
    const createResponse = await page.request.post("/api/direct-connect/requests", {
      data: {
        title: `Kitchen faucet repair request ${Date.now()}`,
        description: "Need a local pro to inspect and repair a leaking kitchen faucet this week.",
        category: "service_request",
        autoRoute: false,
      },
    });
    expect(createResponse.ok(), `create failed: ${createResponse.status()}`).toBeTruthy();
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
  });
});
