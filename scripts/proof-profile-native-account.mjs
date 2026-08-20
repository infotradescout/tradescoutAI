import fs from "node:fs";
import { chromium } from "@playwright/test";

const base = process.env.PROOF_BASE_URL;
const proofEmail = process.env.PROOF_EMAIL;
const proofPassword = process.env.PROOF_PASSWORD;
const proofBusiness = process.env.PROOF_BUSINESS;
const proofPhone = process.env.PROOF_PHONE;

if (!base || !proofEmail || !proofPassword || !proofBusiness || !proofPhone) {
  throw new Error("Proof environment is incomplete.");
}

async function waitForPreview() {
  let last = "";
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await fetch(`${base}/jw-stone`, { redirect: "manual" });
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
  proofEmail,
  proofBusiness,
  desktop: {},
  mobile: {},
  requests: [],
  passed: false,
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  await waitForPreview();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.includes("/api/auth/") || pathname === "/api/u/jw-stone/account") {
      report.requests.push({
        method: response.request().method(),
        pathname,
        status: response.status(),
      });
    }
  });

  const response = await page.goto(`${base}/jw-stone`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  if (response?.status() !== 200) throw new Error(`JW Stone returned ${response?.status()}`);

  const accountButton = page.locator('[data-testid="jw-marketplace-account-button"]');
  await accountButton.waitFor({ state: "visible" });
  if (new URL(page.url()).pathname !== "/jw-stone") {
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
    if (dialogText.includes(phrase)) throw new Error(`Forbidden signup language present: ${phrase}`);
  }
  if (!dialogText.includes("Create an account with JW Stone")) {
    throw new Error(`JW account heading missing: ${dialogText.slice(0, 500)}`);
  }
  if (!dialogText.includes("Any business can create an account directly with JW Stone")) {
    throw new Error("Any-business copy is missing.");
  }
  if (new URL(page.url()).pathname !== "/jw-stone") {
    throw new Error("Dialog navigated away from JW Stone.");
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
  if (new URL(page.url()).pathname !== "/jw-stone") throw new Error("Signup left JW Stone.");
  await page.screenshot({
    path: "profile-account-browser-proof/desktop-created.png",
    fullPage: true,
  });

  const storageState = await context.storageState();
  await page.getByRole("button", { name: "Continue browsing", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-testid="jw-marketplace-account-button"]').click();
  await page.locator('[data-testid="profile-account-dialog-connected"]').waitFor({ state: "visible" });
  const reusedText = await page
    .locator('[data-testid="profile-account-dialog-connected"]')
    .innerText();
  if (!reusedText.includes(`${proofBusiness} is connected to JW Stone`)) {
    throw new Error("Reload did not reuse the JW Stone account.");
  }

  report.desktop = {
    httpStatus: response.status(),
    stayedOnJwStone: true,
    anyBusinessCopy: true,
    forbiddenRoleCopyAbsent: true,
    accountCreated: true,
    accountReusedAfterReload: true,
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
  await mobile.goto(`${base}/jw-stone`, { waitUntil: "networkidle", timeout: 120000 });
  await mobile.locator('[data-testid="jw-marketplace-account-button"]').click();
  await mobile.locator('[data-testid="profile-account-dialog-connected"]').waitFor({ state: "visible" });
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
  if (overflow.documentWidth > overflow.viewport + 2 || overflow.bodyWidth > overflow.viewport + 2) {
    throw new Error(`Mobile overflow: ${JSON.stringify(overflow)}`);
  }
  await mobile.screenshot({
    path: "profile-account-browser-proof/mobile-connected.png",
    fullPage: true,
  });
  report.mobile = {
    stayedOnJwStone: new URL(mobile.url()).pathname === "/jw-stone",
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
