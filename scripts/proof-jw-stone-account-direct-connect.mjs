import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import pg from "pg";

const { Pool } = pg;
const baseUrl = String(process.env.PROOF_BASE_URL || "").replace(/\/+$/, "");
const email = String(process.env.PROOF_EMAIL || "").trim().toLowerCase();
const password = String(process.env.PROOF_PASSWORD || "");
const businessName = String(process.env.PROOF_BUSINESS || "").trim();
const phone = String(process.env.PROOF_PHONE || "").trim();
const outputDir = path.resolve(
  process.env.PROOF_OUTPUT_DIR || "jw-stone-account-direct-connect-proof"
);

if (!baseUrl || !email || !password || !businessName || !phone || !process.env.DATABASE_URL) {
  throw new Error("JW Stone proof environment is incomplete.");
}

fs.mkdirSync(outputDir, { recursive: true });
const reportPath = path.join(outputDir, "report.json");
const report = {
  checkedAt: new Date().toISOString(),
  baseUrl,
  email,
  businessName,
  product: {},
  desktop: {},
  database: {},
  approval: {},
  returningBusiness: {},
  mobile: {},
  requests: [],
  passed: false,
};

function fail(message, details) {
  const error = new Error(message);
  if (details !== undefined) error.details = details;
  throw error;
}

function assert(condition, message, details) {
  if (!condition) fail(message, details);
}

async function waitForApp() {
  let last = "";
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/jw-stone`, { redirect: "manual" });
      last = `${response.status} ${response.headers.get("location") || ""}`;
      if (response.status === 200) return;
    } catch (error) {
      last = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  fail(`JW Stone preview did not become ready: ${last}`);
}

async function removePreviousProof(pool) {
  const result = await pool.query(`SELECT id FROM users WHERE lower(email) = lower($1)`, [email]);
  for (const row of result.rows) {
    await pool.query(`DELETE FROM users WHERE id = $1`, [row.id]);
  }
}

async function visibleText(page) {
  return page.locator("body").innerText();
}

async function proveNoPublicContactBypass(page) {
  const text = await visibleText(page);
  const forbidden = [
    "TradeScout managed contact",
    "JW Stone inquiries",
    "Calls and messages from this profile are handled through TradeScout",
    "(850) 543-0748",
    "contact@thetradescout.com",
  ];
  for (const phrase of forbidden) {
    assert(!text.includes(phrase), `Public JW Stone still exposes forbidden contact copy: ${phrase}`);
  }
  assert((await page.locator('a[href^="tel:"]').count()) === 0, "Public JW Stone still exposes a tel link.");
  assert(
    (await page.locator('a[href^="mailto:"]').count()) === 0,
    "Public JW Stone still exposes a mailto link."
  );
  return forbidden;
}

async function proveHeaderAccountPlacement(page) {
  const header = page.locator('[data-testid="jw-marketplace-header"]');
  const account = page.locator('[data-testid="jw-marketplace-account-button"]');
  await header.waitFor({ state: "visible" });
  await account.waitFor({ state: "visible" });
  assert((await account.count()) === 1, "JW Stone must expose exactly one header Account control.");
  assert(
    (await page.locator('[data-testid="public-profile-account-card"]').count()) === 0,
    "A duplicate lower account card is still mounted on JW Stone."
  );
  const placement = await header.evaluate((element) => ({
    position: getComputedStyle(element).position,
    top: element.getBoundingClientRect().top,
  }));
  const accountBox = await account.boundingBox();
  assert(placement.position === "sticky", "JW Stone account control is not in a sticky header.", placement);
  assert(Boolean(accountBox) && accountBox.y < 100, "JW Stone account control is not at the top of the page.", accountBox);
  return { placement, accountBox, label: (await account.innerText()).trim() };
}

async function openAndProveDirectConnect(page) {
  const candidates = page.getByRole("button", { name: "Start a Request", exact: true });
  const count = await candidates.count();
  assert(count > 0, "JW Stone has no Start a Request control.");
  await candidates.nth(count - 1).click();
  const dialog = page.getByRole("dialog", { name: "JW Stone Logistics" });
  await dialog.waitFor({ state: "visible" });
  await dialog.getByText("Direct Connect", { exact: true }).waitFor({ state: "visible" });
  await dialog.getByRole("button", { name: "Call", exact: true }).waitFor({ state: "visible" });
  await dialog.getByRole("button", { name: "Fill out the form", exact: true }).waitFor({
    state: "visible",
  });
  assert(
    (await dialog.locator('a[href^="tel:"]').count()) === 0,
    "Direct Connect exposed a phone link before the customer chose Call."
  );
  await dialog.getByRole("button", { name: "Close Direct Connect" }).click();
  await dialog.waitFor({ state: "hidden" });
  return { opened: true, protectedCallChoiceVisible: true, requestChoiceVisible: true };
}

async function openAccount(page) {
  await page.locator('[data-testid="jw-marketplace-account-button"]').click();
  const dialog = page.locator('[data-testid="profile-account-dialog"]');
  await dialog.waitFor({ state: "visible" });
  return dialog;
}

async function databaseSnapshot(pool) {
  const result = await pool.query(
    `SELECT
       u.id AS user_id,
       u.role::text AS user_role,
       u.onboarding_completed,
       u.profile_visibility::text AS user_visibility,
       up.id AS business_profile_id,
       up.user_intent::text AS business_intent,
       up.profile_visibility::text AS business_visibility,
       up.verification_status::text AS business_verification,
       pa.id AS profile_account_id,
       pa.identity_kind,
       pa.status AS profile_account_status,
       pa.verification_status AS profile_account_verification,
       pa.source_path,
       pa.resume_path,
       p.slug AS target_profile_slug,
       entitlement.id AS entitlement_id,
       entitlement.product_key,
       entitlement.status AS entitlement_status,
       (SELECT count(*)::int FROM businesses b WHERE lower(b.name) = lower($2)) AS public_business_count,
       (SELECT count(*)::int FROM profiles public_profile WHERE lower(public_profile.display_name) = lower($2)) AS public_profile_count
     FROM users u
     LEFT JOIN user_profiles up
       ON up.user_id = u.id AND up.user_intent = 'business'
     LEFT JOIN profile_accounts pa
       ON pa.owner_user_id = u.id
     LEFT JOIN profiles p
       ON p.id = pa.target_profile_id
     LEFT JOIN profile_account_entitlements entitlement
       ON entitlement.profile_account_id = pa.id
     WHERE lower(u.email) = lower($1)
     ORDER BY up.created_at ASC
     LIMIT 1`,
    [email, businessName]
  );
  return result.rows[0] || null;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let browser;
try {
  await removePreviousProof(pool);
  await waitForApp();
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const desktop = await desktopContext.newPage();
  const desktopErrors = [];
  desktop.on("pageerror", (error) => desktopErrors.push(error.message));
  desktop.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (
      pathname === "/api/profile-accounts/register" ||
      pathname === "/api/u/jw-stone/account" ||
      pathname === "/api/auth/login"
    ) {
      report.requests.push({
        method: response.request().method(),
        pathname,
        status: response.status(),
      });
    }
  });

  const initialResponse = await desktop.goto(`${baseUrl}/jw-stone`, {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  assert(initialResponse?.status() === 200, "JW Stone did not return HTTP 200.", {
    status: initialResponse?.status(),
    url: desktop.url(),
  });
  assert(new URL(desktop.url()).pathname === "/jw-stone", "JW Stone routed away from its profile.");

  const forbidden = await proveNoPublicContactBypass(desktop);
  const placement = await proveHeaderAccountPlacement(desktop);
  const directConnect = await openAndProveDirectConnect(desktop);
  report.product = {
    publicContactBypassAbsent: true,
    forbiddenCopyChecked: forbidden,
    expressDirectConnectIsContactAuthority: true,
    ...directConnect,
  };

  const accountDialog = await openAccount(desktop);
  const accountText = await accountDialog.innerText();
  assert(
    accountText.includes("Create an account with JW Stone"),
    "Account dialog does not identify JW Stone."
  );
  assert(
    accountText.includes("Any business can create an account directly with JW Stone"),
    "Account dialog does not allow any business to create a JW Stone account."
  );
  for (const forbiddenPhrase of [
    "Create a fabricator account",
    "Builder or contractor",
    "Stone yard or dealer",
    "How do you plan to use TradeScout",
  ]) {
    assert(!accountText.includes(forbiddenPhrase), `Role/onboarding language leaked into signup: ${forbiddenPhrase}`);
  }
  assert(new URL(desktop.url()).pathname === "/jw-stone", "Opening Account left JW Stone.");

  await accountDialog.locator('[data-testid="profile-account-business-name"]').fill(businessName);
  await accountDialog.locator('[data-testid="profile-account-first-name"]').fill("Profile");
  await accountDialog.locator('[data-testid="profile-account-last-name"]').fill("Proof");
  await accountDialog.locator('[data-testid="profile-account-email"]').fill(email);
  await accountDialog.locator('[data-testid="profile-account-phone"]').fill(phone);
  await accountDialog.locator('[data-testid="profile-account-password"]').fill(password);
  await accountDialog.locator('[data-testid="profile-account-confirm-password"]').fill(password);
  await accountDialog.locator('[data-testid="profile-account-terms"]').check();
  const registrationResponsePromise = desktop.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/profile-accounts/register" &&
      response.request().method() === "POST"
  );
  await accountDialog.locator('[data-testid="profile-account-submit"]').click();
  const registrationResponse = await registrationResponsePromise;
  const registrationBody = await registrationResponse.text();
  assert(registrationResponse.status() === 201, "Profile-native registration did not return 201.", {
    status: registrationResponse.status(),
    body: registrationBody,
  });

  const connected = desktop.locator('[data-testid="profile-account-dialog-connected"]');
  await connected.waitFor({ state: "visible", timeout: 60000 });
  const connectedText = await connected.innerText();
  assert(
    connectedText.includes(`${businessName} is connected to JW Stone`),
    "Connected state does not identify the new JW Stone business account.",
    connectedText
  );
  assert(new URL(desktop.url()).pathname === "/jw-stone", "Signup routed to general TradeScout.");
  assert(!desktop.url().includes("pre-scout-setup"), "Signup routed to TradeScout setup.");
  assert(!desktop.url().includes("onboarding"), "Signup routed to TradeScout onboarding.");
  await desktop.screenshot({ path: path.join(outputDir, "desktop-created.png"), fullPage: true });

  await desktop.getByRole("button", { name: "Continue browsing", exact: true }).click();
  await desktop.reload({ waitUntil: "networkidle" });
  const reusedDialog = await openAccount(desktop);
  await reusedDialog.locator('[data-testid="profile-account-dialog-connected"]').waitFor({
    state: "visible",
  });
  const reusedText = await reusedDialog.innerText();
  assert(reusedText.includes(`${businessName} is connected to JW Stone`), "Reload lost the JW Stone account.");
  await desktop.getByRole("button", { name: "Continue browsing", exact: true }).click();

  report.desktop = {
    httpStatus: initialResponse.status(),
    canonicalRoute: true,
    headerAccountPlacement: placement,
    accountCreated: true,
    reusedAfterReload: true,
    routedToTradeScoutSetup: false,
    pageErrors: desktopErrors,
  };
  assert(desktopErrors.length === 0, "Desktop page errors occurred.", desktopErrors);
  await desktopContext.close();

  const pendingSnapshot = await databaseSnapshot(pool);
  assert(pendingSnapshot, "No durable database record was created for the proof account.");
  assert(pendingSnapshot.user_role === "homeowner", "Profile account granted a platform-wide business role.", pendingSnapshot);
  assert(pendingSnapshot.onboarding_completed === false, "Profile account falsely completed TradeScout onboarding.");
  assert(pendingSnapshot.user_visibility === "private", "Shared identity is not private.");
  assert(pendingSnapshot.business_intent === "business", "Private business identity is missing.");
  assert(pendingSnapshot.business_visibility === "private", "Business identity was published.");
  assert(pendingSnapshot.target_profile_slug === "jw-stone", "Account relationship targets the wrong profile.");
  assert(pendingSnapshot.identity_kind === "business", "JW Stone relationship is not business-scoped.");
  assert(pendingSnapshot.source_path === "/jw-stone", "JW Stone source path was not preserved.", pendingSnapshot);
  assert(pendingSnapshot.resume_path === "/jw-stone?profileAccount=1", "JW Stone return path is not canonical.", pendingSnapshot);
  assert(pendingSnapshot.product_key === "bidrock", "BidRock entitlement was not attached.");
  assert(pendingSnapshot.entitlement_status === "pending_verification", "BidRock unlocked before verification.");
  assert(pendingSnapshot.public_business_count === 0, "Registration created a public business listing.");
  assert(pendingSnapshot.public_profile_count === 0, "Registration created a public profile.");
  report.database = pendingSnapshot;

  await pool.query(
    `UPDATE user_profiles SET verification_status = 'approved', updated_at = NOW() WHERE id = $1`,
    [pendingSnapshot.business_profile_id]
  );
  const approvedSnapshot = await databaseSnapshot(pool);
  assert(approvedSnapshot.profile_account_verification === "approved", "Approval did not update the JW Stone relationship.");
  assert(approvedSnapshot.entitlement_status === "active", "Approval did not activate BidRock access.");
  report.approval = approvedSnapshot;

  const returningContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const returning = await returningContext.newPage();
  const returningErrors = [];
  returning.on("pageerror", (error) => returningErrors.push(error.message));
  await returning.goto(`${baseUrl}/jw-stone`, { waitUntil: "networkidle", timeout: 120000 });
  await proveNoPublicContactBypass(returning);
  const returningDialog = await openAccount(returning);
  await returningDialog.getByRole("button", { name: "Already have an account? Sign in" }).click();
  await returningDialog.locator('[data-testid="profile-account-email"]').fill(email);
  await returningDialog.locator('[data-testid="profile-account-password"]').fill(password);
  const loginResponsePromise = returning.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/login" &&
      response.request().method() === "POST"
  );
  await returningDialog.locator('[data-testid="profile-account-submit"]').click();
  const loginResponse = await loginResponsePromise;
  assert(loginResponse.status() === 200, "Returning business could not sign in through JW Stone.", {
    status: loginResponse.status(),
    body: await loginResponse.text(),
  });
  const returningConnected = returning.locator('[data-testid="profile-account-dialog-connected"]');
  await returningConnected.waitFor({ state: "visible", timeout: 60000 });
  const returningText = await returningConnected.innerText();
  assert(returningText.includes(`${businessName} is connected to JW Stone`), "Sign-in did not reopen the JW Stone account.");
  assert(!returningText.includes("verification is pending"), "Approved business still appears pending.");
  assert(new URL(returning.url()).pathname === "/jw-stone", "Returning sign-in left JW Stone.");
  const signedInStorage = await returningContext.storageState();
  report.returningBusiness = {
    signedInInsideJwStone: true,
    approvedRelationshipVisible: true,
    canonicalRoute: true,
    pageErrors: returningErrors,
  };
  assert(returningErrors.length === 0, "Returning-business page errors occurred.", returningErrors);
  await returningContext.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: signedInStorage,
  });
  const mobile = await mobileContext.newPage();
  const mobileErrors = [];
  mobile.on("pageerror", (error) => mobileErrors.push(error.message));
  await mobile.goto(`${baseUrl}/jw-stone`, { waitUntil: "networkidle", timeout: 120000 });
  await proveNoPublicContactBypass(mobile);
  const mobilePlacement = await proveHeaderAccountPlacement(mobile);
  const mobileDialog = await openAccount(mobile);
  await mobileDialog.locator('[data-testid="profile-account-dialog-connected"]').waitFor({
    state: "visible",
  });
  const mobileText = await mobileDialog.innerText();
  assert(mobileText.includes(`${businessName} is connected to JW Stone`), "Mobile did not reopen the same account.");
  const overflow = await mobile.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  assert(
    overflow.documentWidth <= overflow.viewportWidth + 2 &&
      overflow.bodyWidth <= overflow.viewportWidth + 2,
    "JW Stone has horizontal mobile overflow.",
    overflow
  );
  await mobile.screenshot({ path: path.join(outputDir, "mobile-connected.png"), fullPage: true });
  report.mobile = {
    canonicalRoute: new URL(mobile.url()).pathname === "/jw-stone",
    headerAccountPlacement: mobilePlacement,
    existingAccountOpened: true,
    noHorizontalOverflow: true,
    overflow,
    pageErrors: mobileErrors,
  };
  assert(mobileErrors.length === 0, "Mobile page errors occurred.", mobileErrors);
  await mobileContext.close();

  report.passed = true;
} catch (error) {
  report.error = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    details: error?.details,
  };
  throw error;
} finally {
  if (browser) await browser.close();
  await pool.end();
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`JW_STONE_ACCOUNT_DIRECT_CONNECT_PROOF:${JSON.stringify(report)}`);
}
