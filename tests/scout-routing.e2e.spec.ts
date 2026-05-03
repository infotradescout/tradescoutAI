import { test, expect } from "./fixtures/botArmy";
import { request } from "@playwright/test";

const DIRECT_CONNECT_ENTRY_URL = "/direct-connect?entry=default";

test.describe("Scout routing explainer", () => {
  // This flow relies on the same test DB + server wiring
  // used by other DB-backed E2E suites.
  test.skip(!process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL not set for Scout routing E2E");

  test("Direct Connect default entry opens the request flow", async ({ page }) => {
    await page.request.put("/api/user/profile", {
      data: {
        firstName: "Playwright",
        lastName: "E2E",
        stateCode: "AZ",
        countyFips: "04013",
      },
    });
    await page.request.post("/api/user/complete-onboarding", { data: {} });

    await page.goto(DIRECT_CONNECT_ENTRY_URL);

    await expect(page.getByText(/Direct Connect/i).first()).toBeVisible();
    await expect(page.getByPlaceholder(/Need help with/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Send request/i })).toBeVisible();
  });

  test("guest action requests include account-gated next step", async ({ baseURL }) => {
    const api = await request.newContext({
      baseURL,
      extraHTTPHeaders: { "x-test-run": "true" },
      storageState: { cookies: [], origins: [] },
    });

    try {
      const response = await api.post("/api/scout", {
        data: {
          message: "Post this to my community feed and publish it for me now.",
          intent: "community_announcement",
          history: [],
          stateCode: "TX",
        },
      });

      expect(response.ok()).toBeTruthy();

      const body = (await response.json()) as any;
      const redirect = String(body?.metadata?.redirect || "");
      const hasRedirect = /pre-scout-setup\?mode=create/i.test(redirect);
      const hasAction = Array.isArray(body?.actions)
        ? body.actions.some((action: any) =>
            /pre-scout-setup\?mode=create/i.test(String(action?.to || action?.path || ""))
          )
        : false;
      const hasSuggestedCreateAccount = Array.isArray(body?.suggestedActions)
        ? body.suggestedActions.some((action: unknown) =>
            /create account|sign in/i.test(String(action))
          )
        : false;
      const hasMessageGate = /create account|sign in|register/i.test(String(body?.message || ""));

      expect(hasRedirect || hasAction || hasSuggestedCreateAccount || hasMessageGate).toBeTruthy();
    } finally {
      await api.dispose();
    }
  });
});
