import fs from "node:fs";
import { chromium } from "@playwright/test";

const base = process.env.PROOF_BASE_URL;
const proofEmail = process.env.PROOF_EMAIL;
const proofPassword = process.env.PROOF_PASSWORD;
const proofBusiness = process.env.PROOF_BUSINESS;
const proofPhone = process.env.PROOF_PHONE;
const profilePath = "/jw-stone";

if (!base || !proofEmail || !proofPassword || !proofBusiness || !proofPhone) {
  throw new Error("Proof environment is incomplete.");
}

async function waitForPreview() {
  let last = "";
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await fetch(`${base}${profilePath}`, { redirect: "manual" });
      last = `${response.status} ${response.headers.get("location") || ""}`;
      if (response.status === 200) return;
    } catch (error) {
      last = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Preview did not become ready: ${last}`);
}

fs.mkdirSync("profile-account-browser-proof", { recursive: true });
const report = {
  checkedAt: new Date().toISOString(),
  base,
  profilePath,
  proofEmail,
  proofBusiness,
  resume: {},
  desktop: {},
  mobile: {},
  requests: [],
  passed: false,
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  await waitForPreview();

  const resumeContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const resumePage = await resumeContext.newPage();
  await resumePage.goto(
    `${base}${profilePath}?profileAccount=1&profileAccountMode=signin`,
    { waitUntil: "networkidle", timeout: 120000 }
  );
  const resumedDialog = resumePage.locator('[data-testid="profile-account-dialog"]');
  await resumedDialog.waitFor({ state: "visible" });
  const resumedText = await resumedDialog.innerText();
  if (!resumedText.includes("Sign in to JW Stone")) {
    throw new Error(`JW Stone resume did not reopen sign-in mode: ${resumedText.slice(0, 500)}`);
  }
  if (new URL(resumePage.url()).pathname !== profilePath) {
    throw new Error(`Resume route is not canonical: ${resumePage.url()}`);
  }
  report.resume = {
    canonicalMarketplaceRoute: true,
    accountDialogAutoOpened: true,
    signInModeRestored: true,
  };
  await resumeContext.close();

  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (
      pathname.includes("/api/auth/") ||
      pathname === "/api/u/jw-stone/account" ||
      pathname === "/api/profile-accounts/register"
    ) {
      report.requests.push({
        method: response.request().method(),
        pathname,
        status: response.status(),
      });
    }
  });

  const response = await page.goto(`${base}${profilePath}`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  if (response?.status() !== 200) throw new Error(`JW Stone returned ${response?.status()}`);

  const accountButton = page.locator('[data-testid="jw-marketplace-account-button"]');
  await accountButton.waitFor({ state: "visible" });
  if ((await accountButton.innerText()).trim() !== "Create account") {
    throw new Error(`JW Stone header account CTA is wrong: ${await accountButton.innerText()}`);
  }
  const header = page.locator('[data-testid="jw-marketplace-header"]');
  const headerPosition = await header.evaluate((element) => getComputedStyle(element).position);
  const accountBox = await accountButton.boundingBox();
  if (headerPosition !== "sticky" || !accountBox || accountBox.y > 100) {
    throw new Error(
      `JW Stone account action is not in the sticky top header: ${JSON.stringify({
        headerPosition,
        accountBox,
      })}`
    );
  }
  if (await page.locator('[data-testid="public-profile-account-card"]').count()) {
    throw new Error("A buried JW Stone account card is still rendered below the marketplace.");
  }
  if (new URL(page.url()).pathname !== profilePath) {
    throw new Error(`Unexpected initial route: ${page.url()}`);
  }
  await accountButton.click();

  const dialog = page.locator('[data-testid="profile-account-dialog"]');
  await dialog.waitFor({ state: "visible" });
  const dialogText = await dialog.innerText();
  for (const phrase of [
    "Create a fabricator account",
    "Builder or contractor",
    "Stone yard or dealer",
    "How do you plan to use TradeScout",
  ]) {
    if (dialogText.includes(phrase)) {
      throw new Error(`Forbidden signup language present: ${phrase}`);
    }
  }
  if (!dialogText.includes("Create an account with JW Stone")) {
    throw new Error(`JW account heading missing: ${dialogText.slice(0, 500)}`);
  }
  if (!dialogText.includes("Any business can create an account directly with JW Stone")) {
    throw new Error("Any-business copy is missing.");
  }
  if (new URL(page.url()).pathname !== profilePath) {
    throw new Error("Dialog navigated away from the JW Stone marketplace.");
  }

  await page.locator('[data-testid="profile-account-business-name"]').fill(proofBusiness);
  await page.locator('[data-testid="profile-account-first-name"]').fill("Profile");
  await page.locator('[data-testid="profile-account-last-name"]').fill("Proof");
  await page.locator('[data-testid="profile-account-email"]').fill(proofEmail);
  await page.locator('[data-testid="profile-account-phone"]').fill(proofPhone);
  await page.locator('[data-testid="profile-account-password"]').fill(proofPassword);
  await page.locator('[data-testid="profile-account-confirm-password"]').fill(proofPassword);
  await page.locator('[data-testid="profile-account-terms"]').check();
  await page.locator('[data-testid="profile-account-submit"]').click();

  const connected = page.locator('[data-testid="profile-account-dialog-connected"]');
  await connected.waitFor({ state: "visible", timeout: 60000 });
  const connectedText = await connected.innerText();
  if (!connectedText.includes(`${proofBusiness} is connected to JW Stone`)) {
    throw new Error(`Connected state is wrong: ${connectedText}`);
  }
  if (!connectedText.includes("business review is queued")) {
    throw new Error(`Pending verification is not explained honestly: ${connectedText}`);
  }
  if (new URL(page.url()).pathname !== profilePath) {
    throw new Error("Signup left the JW Stone marketplace.");
  }
  await page.screenshot({
    path: "profile-account-browser-proof/desktop-created.png",
    fullPage: true,
  });

  const storageState = await context.storageState();
  await page.getByRole("button", { name: "Continue browsing", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-testid="jw-marketplace-account-button"]').click();
  await page
    .locator('[data-testid="profile-account-dialog-connected"]')
    .waitFor({ state: "visible" });
  const reusedText = await page
    .locator('[data-testid="profile-account-dialog-connected"]')
    .innerText();
  if (!reusedText.includes(`${proofBusiness} is connected to JW Stone`)) {
    throw new Error("Reload did not reuse the JW Stone account.");
  }

  const registrationRequest = report.requests.find(
    (request) =>
      request.method === "POST" && request.pathname === "/api/profile-accounts/register"
  );
  if (!registrationRequest || registrationRequest.status !== 201) {
    throw new Error(`Atomic profile registration did not return 201: ${JSON.stringify(report.requests)}`);
  }

  report.desktop = {
    httpStatus: response.status(),
    canonicalMarketplaceRoute: true,
    stickyHeaderAccountVisible: true,
    buriedAccountCardAbsent: true,
    anyBusinessCopy: true,
    forbiddenRoleCopyAbsent: true,
    accountCreated: true,
    accountReusedAfterReload: true,
    atomicRegistrationStatus: registrationRequest.status,
    pageErrors,
  };
  if (pageErrors.length) throw new Error(`Desktop page errors: ${pageErrors.join(" | ")}`);
  await context.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState,
  });
  const mobile = await mobileContext.newPage();
  const mobileErrors = [];
  mobile.on("pageerror", (error) => mobileErrors.push(error.message));
  await mobile.goto(`${base}${profilePath}`, { waitUntil: "networkidle", timeout: 120000 });
  const mobileAccountButton = mobile.locator('[data-testid="jw-marketplace-account-button"]');
  await mobileAccountButton.waitFor({ state: "visible" });
  const mobileBox = await mobileAccountButton.boundingBox();
  if (!mobileBox || mobileBox.y > 100) {
    throw new Error(`Mobile account action is not in the top header: ${JSON.stringify(mobileBox)}`);
  }
  await mobileAccountButton.click();
  await mobile.locator('[data-testid="profile-account-dialog-connected"]').waitFor({
    state: "visible",
  });
  const mobileText = await mobile
    .locator('[data-testid="profile-account-dialog-connected"]')
    .innerText();
  if (!mobileText.includes(`${proofBusiness} is connected to JW Stone`)) {
    throw new Error("Mobile did not reopen the same account.");
  }
  const overflow = await mobile.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  if (
    overflow.documentWidth > overflow.viewport + 2 ||
    overflow.bodyWidth > overflow.viewport + 2
  ) {
    throw new Error(`Mobile overflow: ${JSON.stringify(overflow)}`);
  }
  await mobile.screenshot({
    path: "profile-account-browser-proof/mobile-connected.png",
    fullPage: true,
  });
  report.mobile = {
    canonicalMarketplaceRoute: new URL(mobile.url()).pathname === profilePath,
    stickyHeaderAccountVisible: true,
    existingAccountOpened: true,
    noHorizontalOverflow: true,
    pageErrors: mobileErrors,
  };
  if (mobileErrors.length) throw new Error(`Mobile page errors: ${mobileErrors.join(" | ")}`);
  await mobileContext.close();

  report.passed = true;
  fs.writeFileSync("profile-account-browser-proof/report.json", JSON.stringify(report, null, 2));
  console.log(`PROFILE_NATIVE_ACCOUNT_BROWSER_PROOF:${JSON.stringify(report)}`);
} finally {
  await browser.close();
  if (!fs.existsSync("profile-account-browser-proof/report.json")) {
    fs.writeFileSync("profile-account-browser-proof/report.json", JSON.stringify(report, null, 2));
  }
}

if (!report.passed) process.exit(1);
