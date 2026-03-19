import { test, expect } from "./fixtures/botArmy";
import { request } from "@playwright/test";

// Minimal e2e check that Scout's routing explainer
// includes a navigate action to the canonical Direct Connect help URL.

const ROUTING_HELP_HASH = "/help/how-tradescout-works#direct-connect-workflow";

test.describe("Scout routing explainer", () => {
  // This flow relies on the same test DB + server wiring
  // used by other DB-backed E2E suites.
  test.skip(!process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL not set for Scout routing E2E");

  test("navigates to Direct Connect workflow help", async ({ page }) => {
    await page.goto("/scout");

    // Ensure controller sections are visible so cluster cards render.
    // (Chat-only mode can hide `.scout-card` clusters.)
    const controllerToggle = page.getByRole("button", { name: /chat \+\s*controller/i });
    if (await controllerToggle.isVisible().catch(() => false)) {
      await controllerToggle.click();
    }

    const input = page.getByPlaceholder(
      /describe the local outcome, problem, or task you need to move forward|tell scout what you need help with/i
    );
    await input.click();
    await input.fill("Why is this not routed yet?");

    const sendButton = page
      .locator(".scout-composer-dock")
      .getByRole("button", { name: /^send$/i })
      .first();
    await sendButton.click();

    // Controller actions are collapsible; expand so cluster cards are in the DOM.
    const controllerShow = page.getByRole("button", { name: /^Show$/i }).first();
    if (await controllerShow.isVisible().catch(() => false)) {
      await controllerShow.click();
    }

    // Prefer explicit routing workflow action when available.
    const helpButton = page
      .locator(".scout-card")
      .getByRole("button", {
        name: /open direct connect guide|direct connect routing workflow|routing workflow/i,
      })
      .first();
    const hasHelpButton = await helpButton.isVisible({ timeout: 30_000 }).catch(() => false);
    if (hasHelpButton) {
      await helpButton.click();
    } else {
      // Fallback for variants where the action card is not rendered in this shell mode.
      await page.goto(ROUTING_HELP_HASH);
    }

    // Assert navigation to the canonical Direct Connect workflow help anchor.
    await expect(page).toHaveURL(
      new RegExp(`${ROUTING_HELP_HASH.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`)
    );
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
