import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/botArmy";

test.skip(!process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL not set for account settings E2E");

async function bestEffortCompleteOnboarding(page: Page) {
  try {
    await page.request.post("/api/user/complete-onboarding", { data: {} });
  } catch {
    // Ignore in case this account is already complete or endpoint is unavailable in a test env.
  }
}

async function toggleRowSwitch(page: Page, rowTestId: string, switchTestId: string) {
  const row = page.getByTestId(rowTestId);
  const toggle = page.getByTestId(switchTestId);

  await expect(row).toBeVisible();
  await expect(toggle).toBeVisible();

  const startChecked = (await toggle.getAttribute("aria-checked")) === "true";
  const flipped = startChecked ? "false" : "true";
  const restored = startChecked ? "true" : "false";

  await row.click();
  await expect(toggle).toHaveAttribute("aria-checked", flipped);

  await row.click();
  await expect(toggle).toHaveAttribute("aria-checked", restored);
}

async function toggleSwitchControl(toggle: ReturnType<Page["locator"]>) {
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeEnabled();
  const startChecked = (await toggle.getAttribute("aria-checked")) === "true";
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", startChecked ? "false" : "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", startChecked ? "true" : "false");
}

async function chooseSelectOption(
  page: Page,
  trigger: ReturnType<Page["locator"]>,
  optionText: string
) {
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.getByRole("option", { name: optionText }).click();
}

async function chooseFirstSelectOption(page: Page, trigger: ReturnType<Page["locator"]>) {
  await expect(trigger).toBeVisible();
  await trigger.click();
  const options = page.getByRole("option");
  const count = await options.count();
  expect(count).toBeGreaterThan(0);
  await options.first().click();
}

async function clickTwice(locator: ReturnType<Page["locator"]>) {
  await expect(locator).toBeVisible();
  await locator.click();
  await locator.click();
}

async function openFirstProfileEditor(page: Page) {
  const response = await page.request.get("/api/profiles");
  if (!response.ok()) {
    return null;
  }
  const profiles = (await response.json()) as Array<{ slug?: string }>;
  const slug = profiles.find(
    (entry) => typeof entry?.slug === "string" && entry.slug.length > 0
  )?.slug;
  if (!slug) {
    return null;
  }
  await page.goto(`/u/${slug}/edit`);
  return slug;
}

test.describe("Account settings interactions", () => {
  test("all settings tabs expose interactive options", async ({ page }) => {
    await bestEffortCompleteOnboarding(page);
    await page.goto("/settings?tab=profile");

    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    await page.getByTestId("settings-tab-profile").click();
    await expect(page.getByTestId("settings-profile-first-name")).toBeVisible();
    await page.getByTestId("settings-profile-first-name").fill("Playwright");
    await page.getByTestId("settings-profile-last-name").fill("Settings");
    await page.getByTestId("settings-profile-bio").fill("E2E profile bio coverage.");
    await expect(page.getByTestId("settings-profile-upload-photo")).toBeVisible();
    await page.getByTestId("settings-profile-cancel").click();
    await expect(page.getByTestId("settings-profile-open-home-vault")).toBeVisible();
    await expect(page.getByTestId("settings-profile-open-vehicle-vault")).toBeVisible();

    const stateTrigger = page.getByTestId("settings-profile-location-state");
    if (await stateTrigger.isVisible()) {
      await chooseFirstSelectOption(page, stateTrigger);
      const countyTrigger = page.getByTestId("settings-profile-location-county");
      if (await countyTrigger.isEnabled()) {
        await chooseFirstSelectOption(page, countyTrigger);
      }
    }

    await page.getByTestId("settings-tab-roles").click();
    const roleOptions = page.locator('[data-testid^="role-option-"]');
    await expect(roleOptions.first()).toBeVisible();
    await roleOptions.first().click();
    await roleOptions.first().click();
    await expect(page.getByTestId("settings-roles-save-account-types")).toBeVisible();

    await page.getByTestId("settings-tab-navigation").click();
    await expect(page.getByText("Navigation Preferences")).toBeVisible();
    const swipeNavigationToggle = page.getByTestId("nav-prefs-swipe-toggle");
    if (await swipeNavigationToggle.isVisible()) {
      await toggleSwitchControl(swipeNavigationToggle);
    }
    const navVisibilityToggles = page.locator('[data-testid^="nav-prefs-visibility-"]');
    if ((await navVisibilityToggles.count()) > 0) {
      await clickTwice(navVisibilityToggles.first());
    }
    await expect(page.getByTestId("nav-prefs-reset")).toBeVisible();

    await page.getByTestId("settings-tab-appearance").click();
    await page.getByTestId("settings-appearance-handedness-left").click();
    await page.getByTestId("settings-appearance-handedness-right").click();
    await expect(page.getByTestId("settings-appearance-reset-default")).toBeVisible();
    await expect(page.getByTestId("settings-appearance-repair-reload")).toBeVisible();
    await expect(page.getByTestId("settings-appearance-normal-reload")).toBeVisible();

    await page.getByTestId("settings-tab-notifications").click();
    await toggleRowSwitch(
      page,
      "settings-notification-row-email",
      "settings-notification-switch-email"
    );
    await toggleRowSwitch(
      page,
      "settings-notification-row-sms",
      "settings-notification-switch-sms"
    );
    await toggleRowSwitch(
      page,
      "settings-notification-row-marketing",
      "settings-notification-switch-marketing"
    );
    const pushSwitch = page.getByTestId("settings-notification-switch-push");
    if ((await pushSwitch.getAttribute("aria-disabled")) !== "true") {
      await toggleRowSwitch(
        page,
        "settings-notification-row-push",
        "settings-notification-switch-push"
      );
    }
    await page.getByTestId("settings-notifications-open-advanced").click();
    await expect(page.getByRole("heading", { name: "Notification Preferences" })).toBeVisible();
    await toggleSwitchControl(page.getByTestId("notification-pref-enable-notifications"));
    await toggleSwitchControl(page.getByTestId("notification-pref-enable-email"));
    await page.getByTestId("notification-pref-quiet-start").fill("21:30");
    await page.getByTestId("notification-pref-quiet-end").fill("06:30");
    await toggleSwitchControl(page.getByTestId("notification-pref-type-enabled-new_message"));
    await page.getByTestId("notification-pref-type-new_message-method-in_app").click();
    await page.getByTestId("notification-pref-type-new_message-method-in_app").click();
    await toggleSwitchControl(page.getByTestId("notification-pref-daily-digest"));
    await page.getByTestId("notification-pref-digest-time").fill("08:45");
    await page.getByTestId("notification-pref-cancel").click();
    await expect(page.getByTestId("settings-notifications-save")).toBeVisible();

    await page.getByTestId("settings-tab-privacy").click();
    await expect(page.getByTestId("settings-privacy-open-profile-settings")).toBeVisible();
    await toggleRowSwitch(
      page,
      "settings-privacy-row-show-in-search",
      "settings-privacy-switch-show-in-search"
    );
    const contactPolicy = page.getByTestId("settings-privacy-contact-policy");
    await chooseSelectOption(page, contactPolicy, "No one");
    await expect(contactPolicy).toContainText("No one");
    await chooseSelectOption(page, contactPolicy, "Verified users only");
    await expect(contactPolicy).toContainText("Verified users only");
    await chooseSelectOption(page, contactPolicy, "Contractors only");
    await expect(contactPolicy).toContainText("Contractors only");
    await expect(page.getByTestId("settings-privacy-save")).toBeVisible();

    await page.getByTestId("settings-tab-security").click();
    await page.getByTestId("settings-security-current-password").fill("CurrentPassword123!");
    await page.getByTestId("settings-security-new-password").fill("NewPassword123!");
    await page.getByTestId("settings-security-confirm-password").fill("NewPassword123!");
    await page.getByTestId("settings-security-toggle-2fa").click();

    await page.getByTestId("settings-tab-tools").click();
    await expect(page.getByTestId("settings-tools-open-invoices")).toBeVisible();
    await expect(page.getByTestId("settings-tools-open-quote-calculator")).toBeVisible();
    await expect(page.getByTestId("settings-tools-open-expenses")).toBeVisible();
  });

  test("profile settings tabs keep all key options interactive", async ({ page }) => {
    await bestEffortCompleteOnboarding(page);
    await page.goto("/profile-settings");

    await expect(page.getByRole("heading", { name: "Profile Settings" })).toBeVisible();

    await page.getByTestId("profile-settings-tab-identity").click();
    await page.getByTestId("profile-settings-identity-first-name").fill("Play");
    await page.getByTestId("profile-settings-identity-last-name").fill("Wright");
    await expect(page.getByTestId("profile-settings-identity-save-basics")).toBeVisible();
    await expect(page.getByTestId("profile-settings-identity-open-profile-editor")).toBeVisible();
    await expect(
      page.getByTestId("profile-settings-identity-open-editor-to-manage-publishing")
    ).toBeVisible();

    await page.getByTestId("profile-settings-tab-routing").click();
    const defaultHome = page.getByTestId("profile-settings-routing-default-home");
    await chooseSelectOption(page, defaultHome, "Community");
    await expect(defaultHome).toContainText("Community");
    await page
      .getByTestId("profile-settings-routing-services-description")
      .fill("Playwright routing services description");
    await expect(page.getByTestId("profile-settings-routing-save-services")).toBeVisible();

    const sectionSwitches = page.locator('[data-testid^="profile-settings-switch-section-"]');
    await expect(sectionSwitches.first()).toBeVisible();
    const sectionCount = await sectionSwitches.count();
    for (let index = 0; index < Math.min(sectionCount, 4); index += 1) {
      await toggleSwitchControl(sectionSwitches.nth(index));
    }

    await page.getByTestId("profile-settings-tab-appearance").click();
    const presetSelect = page.getByTestId("profile-settings-appearance-color-preset");
    await chooseSelectOption(page, presetSelect, "Custom");
    await expect(presetSelect).toContainText("Custom");
    await chooseSelectOption(page, presetSelect, "default");
    await expect(page.getByTestId("profile-settings-appearance-save-palette")).toBeVisible();
    await expect(page.getByTestId("profile-settings-appearance-save-custom-colors")).toBeVisible();

    await page.getByTestId("profile-settings-tab-booking").click();
    await toggleRowSwitch(
      page,
      "profile-settings-row-booking-enabled",
      "profile-settings-switch-booking-enabled"
    );
    await toggleRowSwitch(
      page,
      "profile-settings-row-booking-paid",
      "profile-settings-switch-booking-paid"
    );
    await toggleRowSwitch(
      page,
      "profile-settings-row-pricing-table",
      "profile-settings-switch-pricing-table"
    );
    const bookingVisibility = page.getByTestId("profile-settings-booking-calendar-visibility");
    await chooseSelectOption(page, bookingVisibility, "Private (hide availability)");
    await expect(bookingVisibility).toContainText("Private");
    await page.getByTestId("profile-settings-booking-timezone").fill("America/Chicago");

    await page.getByTestId("profile-settings-booking-add-slot").click();
    const slotStartInputs = page.locator('[data-testid^="profile-settings-booking-slot-start-"]');
    await expect(slotStartInputs.first()).toBeVisible();
    await slotStartInputs.first().fill("10:00");
    const slotEndInputs = page.locator('[data-testid^="profile-settings-booking-slot-end-"]');
    await slotEndInputs.first().fill("13:00");
    const slotLabels = page.locator('[data-testid^="profile-settings-booking-slot-label-"]');
    await slotLabels.first().fill("Midday");
    const slotRemoves = page.locator('[data-testid^="profile-settings-booking-slot-remove-"]');
    await slotRemoves.first().click();

    const pricingToggle = page.getByTestId("profile-settings-switch-pricing-table");
    if ((await pricingToggle.getAttribute("aria-checked")) !== "true") {
      await pricingToggle.click();
    }
    await page.getByTestId("profile-settings-pricing-add-row").click();
    const pricingNameInputs = page.locator('[data-testid^="profile-settings-pricing-name-"]');
    await expect(pricingNameInputs.first()).toBeVisible();
    await pricingNameInputs.first().fill("Inspection");
    const pricingPriceInputs = page.locator('[data-testid^="profile-settings-pricing-price-"]');
    await pricingPriceInputs.first().fill("$125");
    const pricingDescriptionInputs = page.locator(
      '[data-testid^="profile-settings-pricing-description-"]'
    );
    await pricingDescriptionInputs.first().fill("Base service");
    const pricingRemoveButtons = page.locator('[data-testid^="profile-settings-pricing-remove-"]');
    await pricingRemoveButtons.first().click();
    await expect(page.getByTestId("profile-settings-booking-save")).toBeVisible();
  });

  test("dashboard settings widgets remain fully clickable", async ({ page }) => {
    await bestEffortCompleteOnboarding(page);
    await page.goto("/dashboard-settings");

    await expect(page.getByRole("heading", { name: "Dashboard Settings" })).toBeVisible();

    const toggles = page.locator('[data-testid^="switch-"]');
    const toggleCount = await toggles.count();
    expect(toggleCount).toBeGreaterThan(0);

    for (let index = 0; index < toggleCount; index += 1) {
      await toggleSwitchControl(toggles.nth(index));
    }
  });

  test("notifications center filter options remain usable", async ({ page }) => {
    await bestEffortCompleteOnboarding(page);
    await page.goto("/notifications");

    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();

    await page.getByTestId("notifications-filter-unread").click();
    await expect(page.getByRole("tab", { name: "Unread", selected: true })).toBeVisible();
    await page.getByTestId("notifications-filter-all").click();
    await expect(page.getByRole("tab", { name: "All", selected: true })).toBeVisible();
  });

  test("public profile editor centralizes profile-facing settings", async ({ page }) => {
    await bestEffortCompleteOnboarding(page);
    const slug = await openFirstProfileEditor(page);
    test.skip(!slug, "No owned profile exists for this account");

    await expect(page.getByRole("heading", { name: "Edit Profile Site" })).toBeVisible();
    await expect(page.getByTestId("profile-editor-public-settings")).toBeVisible();

    await page.getByTestId("profile-editor-user-address").fill("123 Demo St");
    await page.getByTestId("profile-editor-user-city").fill("Demo City");
    await page.getByTestId("profile-editor-user-zip").fill("70433");
    const userStateTrigger = page.getByTestId("profile-editor-user-state");
    if (await userStateTrigger.isVisible()) {
      await chooseFirstSelectOption(page, userStateTrigger);
      const userCountyTrigger = page.getByTestId("profile-editor-user-county");
      if (await userCountyTrigger.isEnabled()) {
        await chooseFirstSelectOption(page, userCountyTrigger);
      }
    }
    await expect(page.getByTestId("profile-editor-user-location-save")).toBeVisible();

    await page
      .getByTestId("profile-editor-services-description")
      .fill("Profile editor services coverage.");
    await expect(page.getByTestId("profile-editor-services-save")).toBeVisible();

    const businessSave = page.getByTestId("profile-editor-business-location-save");
    if (await businessSave.isVisible()) {
      await page.getByTestId("profile-editor-business-address").fill("456 Business Ave");
      await page.getByTestId("profile-editor-business-city").fill("Biz City");
      await page.getByTestId("profile-editor-business-zip").fill("70434");
      const businessStateTrigger = page.getByTestId("profile-editor-business-state");
      if (await businessStateTrigger.isVisible()) {
        await chooseFirstSelectOption(page, businessStateTrigger);
        const businessCountyTrigger = page.getByTestId("profile-editor-business-county");
        if (await businessCountyTrigger.isEnabled()) {
          await chooseFirstSelectOption(page, businessCountyTrigger);
        }
      }
      await expect(businessSave).toBeVisible();
    }

    const sectionSwitches = page.locator('[data-testid^="profile-editor-section-"]');
    if ((await sectionSwitches.count()) > 0) {
      await toggleSwitchControl(sectionSwitches.first());
    }

    const presetTrigger = page.getByTestId("profile-editor-color-preset");
    await chooseSelectOption(page, presetTrigger, "default");
    await expect(page.getByTestId("profile-editor-color-save")).toBeVisible();

    await toggleSwitchControl(page.getByTestId("profile-editor-booking-enabled"));
    await page.getByTestId("profile-editor-booking-timezone").fill("America/Chicago");
    await page.getByTestId("profile-editor-booking-add-slot").click();
    const slotStarts = page.locator('[data-testid^="profile-editor-booking-slot-start-"]');
    if ((await slotStarts.count()) > 0) {
      await slotStarts.first().fill("10:30");
    }
    const pricingToggle = page.getByTestId("profile-editor-pricing-enabled");
    if ((await pricingToggle.getAttribute("aria-checked")) !== "true") {
      await pricingToggle.click();
    }
    await page.getByTestId("profile-editor-pricing-add-row").click();
    const pricingNames = page.locator('[data-testid^="profile-editor-pricing-name-"]');
    if ((await pricingNames.count()) > 0) {
      await pricingNames.first().fill("Consultation");
    }
    await expect(page.getByTestId("profile-editor-booking-save")).toBeVisible();
  });

  test("privacy request controls remain interactive", async ({ page }) => {
    await bestEffortCompleteOnboarding(page);
    await page.goto("/privacy-request");

    await expect(page.getByRole("heading", { name: "Privacy Request Form" })).toBeVisible();
    await expect(page.getByTestId("privacy-request-download-zip")).toBeVisible();
    await page.getByTestId("privacy-request-reason").fill("Coverage validation");
    await page.getByTestId("privacy-request-confirm-delete").click();
    const deleteButton = page.getByTestId("privacy-request-submit-delete");
    await expect(deleteButton).toBeEnabled();
  });
});
