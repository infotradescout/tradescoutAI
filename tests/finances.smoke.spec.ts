import { test, expect } from "./fixtures/botArmy";

test.describe("Finances smoke", () => {
  test("Finances dashboard loads", async ({ page }) => {
    await page.goto("/finances");
    await expect(page.getByRole("heading", { name: /finances|accounting/i })).toBeVisible();
  });

  test("Create invoice → send → record payment", async ({ page }) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const title = `E2E Invoice ${stamp}`;

    await page.goto("/finances/invoices");

    // If you hit this, your E2E creds aren't valid or session cookies aren't being set.
    if (await page.getByText(/Sign in to view and manage invoices/i).isVisible().catch(() => false)) {
      throw new Error("Not authenticated in E2E. Fix E2E_EMAIL/E2E_PASSWORD (or master admin creds).");
    }

    await page.getByPlaceholder("Project or job name").fill(title);
    await page.getByPlaceholder("Client name (optional)").fill("E2E Client");
    await page.getByPlaceholder("Total amount").fill("123.45");
    await page.getByRole("button", { name: "Create invoice record" }).click();

    const row = page.getByRole("row", { name: new RegExp(title) });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Send" }).click();
    await expect(row.getByText(/^sent$/i)).toBeVisible({ timeout: 20_000 });

    await row.getByRole("button", { name: /record payment/i }).click();
    await expect(row.getByText(/^paid$/i)).toBeVisible({ timeout: 20_000 });
  });
});
