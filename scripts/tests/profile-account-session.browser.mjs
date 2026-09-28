/** Controlled HTTPS browser proof: real company dialog, useAuth, TanStack cache and cookies;
 * synthetic API records only. Not live OAuth, database, email-delivery or cross-domain SSO proof.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { chromium } from "playwright";

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "profile-session-browser-"));
const output = path.join(root, "test-results/profile-account-session");
fs.mkdirSync(output, { recursive: true });
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", path.join(temp, "key.pem"), "-out", path.join(temp, "cert.pem"), "-days", "1", "-subj", "/CN=proof.company.test"], { stdio: "ignore" });
const bundled = await build({
  stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
      import {PublicProfileAccountDialog} from './client/src/components/profile/PublicProfileAccountDialog';
      import {MarketplaceFooter} from './client/src/features/jw-stone/MarketplaceFooter';
      const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
      window.readProofIdentity=()=>client.getQueryData(['/api/auth/user']) || null;
      const mode=new URL(location.href).searchParams.get('mode') === 'create' ? 'create' : 'signin';
      createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}>
        <PublicProfileAccountDialog open onOpenChange={()=>{}} profileSlug="jw-stone" profileName="JW Stone" initialMode={mode}/>
        <MarketplaceFooter/>
      </QueryClientProvider>);`,
    resolveDir: root, loader: "tsx", sourcefile: "profile-session-proof.tsx",
  },
  alias: { "@": path.join(root, "client/src"), "@shared": path.join(root, "shared") },
  bundle: true, write: false, format: "esm", platform: "browser", jsx: "automatic",
  define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
});
const script = bundled.outputFiles.find(file => !file.path.endsWith(".css"))?.text;
assert.ok(script);
const user = { id: "synthetic-company-member", email: "person@example.invalid", onboardingCompleted: false, emailVerified: false };
let scenario = {};
let counts;
let accepted = false;
let failedProbe = false;
const policy = { enabled: true, profileSlug: "jw-stone", requiredIdentity: "business", includesBidRock: true, priorityKey: "stone_business_access", label: "Account", heading: "Create an account", description: "Continue with JW Stone." };
const accountState = signedIn => ({
  policy, requiresBusinessSetup: !signedIn,
  viewerBusiness: signedIn ? { id: "synthetic-business", name: "Synthetic Company", verificationStatus: "pending" } : null,
  account: signedIn ? { id: "synthetic-membership", profileSlug: "jw-stone", identityKind: "business", businessProfileId: "synthetic-business", status: "active", businessName: "Synthetic Company", verificationStatus: "pending", resumePath: "/u/jw-stone?profileAccount=1" } : null,
  entitlements: [],
});
const server = https.createServer({ key: fs.readFileSync(path.join(temp, "key.pem")), cert: fs.readFileSync(path.join(temp, "cert.pem")) }, async (req, res) => {
  const pathname = new URL(req.url, "https://proof.company.test").pathname;
  const signedIn = accepted && String(req.headers.cookie || "").includes("proof.sid=synthetic");
  res.setHeader("Cache-Control", "no-store");
  const json = (body, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  if (pathname === "/proof.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end(script); }
  if (pathname === "/api/auth/user") {
    counts.probes++;
    if (scenario.initialProbeFailure && !failedProbe) return json({ message: "synthetic unavailable" }, 404);
    if (scenario.registrationProbeFailure && accepted && !failedProbe) return json({ message: "synthetic unavailable" }, 404);
    if (scenario.wrongIdentity && accepted) return json({ authenticated: true, user: { ...user, id: "different-synthetic-member" } });
    return json(signedIn ? { authenticated: true, user } : { authenticated: false, user: null });
  }
  if (pathname === "/api/auth/login" && req.method === "POST") {
    counts.logins++; for await (const _ of req) { /* Do not log credentials. */ }
    if (scenario.html) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end("<html>not an auth response</html>"); }
    if (scenario.denied) return json({ message: "Incorrect password", code: "AUTH_INCORRECT_PASSWORD" }, 401);
    accepted = true;
    if (!scenario.dropCookie) res.setHeader("Set-Cookie", "proof.sid=synthetic; HttpOnly; Secure; SameSite=Lax; Path=/");
    return json({ user, message: "Login successful" });
  }
  if (pathname === "/api/profile-accounts/register" && req.method === "POST") {
    counts.registrations++; for await (const _ of req) { /* Synthetic registration only. */ }
    accepted = true;
    if (!scenario.registrationMissingCookie) res.setHeader("Set-Cookie", "proof.sid=synthetic; HttpOnly; Secure; SameSite=Lax; Path=/");
    return json({ ...accountState(true), emailVerificationRequired: true, emailVerificationSent: false }, 201);
  }
  if (pathname === "/api/u/jw-stone/account" && req.method === "GET") {
    if (scenario.accountHtml) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end("<html>not an account response</html>"); }
    return json(accountState(signedIn));
  }
  if (pathname.startsWith("/api/")) { counts.unexpected.push(`${req.method} ${pathname}`); return json({ message: "Unexpected proof request" }, 404); }
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script>window.__TS_CUSTOM_DOMAIN_PROFILE_SLUG__="jw-stone";</script><script type="module" src="/proof.js"></script></body></html>');
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const port = server.address().port;
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server", "--host-resolver-rules=MAP proof.company.test 127.0.0.1,MAP proof.platform.test 127.0.0.1"] });
const results = [];
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    for (const [name, config] of Object.entries({ success: {}, html: { html: true }, denied: { denied: true }, missingCookie: { dropCookie: true }, wrongIdentity: { wrongIdentity: true }, initialProbeRecovery: { initialProbeFailure: true }, registrationRecovery: { registrationProbeFailure: true }, accountHtml: { accountHtml: true }, registrationMissingCookie: { registrationMissingCookie: true } })) {
      scenario = { ...config }; accepted = false; failedProbe = false;
      counts = { probes: 0, logins: 0, registrations: 0, unexpected: [] };
      const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
      await context.route("**/*", route => {
        const url = new URL(route.request().url());
        return ["proof.company.test", "proof.platform.test"].includes(url.hostname) && url.port === String(port) ? route.continue() : route.abort();
      });
      const page = await context.newPage(); const pageErrors = [];
      page.on("pageerror", error => pageErrors.push(error.message));
      try {
        const mode = name.startsWith("registration") ? "create" : "signin";
        const origin = `https://proof.company.test:${port}`;
        await page.goto(`${origin}/?mode=${mode}`);
        if (name === "accountHtml") {
          await page.getByTestId("profile-account-load-error").waitFor();
          assert.equal(await page.getByTestId("profile-account-submit").count(), 0);
          scenario.accountHtml = false;
          await page.getByRole("button", { name: "Try again", exact: true }).click();
          await page.getByTestId("profile-account-email").waitFor();
          assert.equal(counts.logins, 0); assert.equal(counts.registrations, 0);
        } else if (name === "initialProbeRecovery") {
          await page.getByTestId("profile-account-session-error").waitFor();
          assert.equal(await page.getByTestId("profile-account-submit").count(), 0);
          failedProbe = true; await page.getByRole("button", { name: "Check sign-in again" }).click();
          await page.getByTestId("profile-account-email").waitFor();
          assert.equal(counts.logins, 0); assert.equal(counts.registrations, 0);
        } else {
          await page.getByTestId("profile-account-email").fill("person@example.invalid");
          await page.getByTestId("profile-account-password").fill("SyntheticPassword1");
          if (mode === "create") {
            await page.getByTestId("profile-account-business-name").fill("Synthetic Company");
            await page.getByTestId("profile-account-first-name").fill("Synthetic");
            await page.getByTestId("profile-account-last-name").fill("Customer");
            await page.getByTestId("profile-account-phone").fill("2025550100");
            await page.getByTestId("profile-account-confirm-password").fill("SyntheticPassword1");
            await page.getByTestId("profile-account-terms").check();
          }
          await page.getByTestId("profile-account-submit").click();
          if (name === "registrationRecovery") {
            await page.getByTestId("profile-account-session-error").waitFor();
            assert.equal(counts.registrations, 1);
            failedProbe = true; await page.getByRole("button", { name: "Check sign-in again" }).click();
          } else if (name === "registrationMissingCookie") {
            await page.getByTestId("profile-account-error").waitFor();
            assert.equal(counts.registrations, 1); assert.equal(counts.logins, 0);
            await page.getByRole("button", { name: "Already have an account? Sign in", exact: true }).click();
            await page.getByTestId("profile-account-submit").click();
          }
          if (name === "success" || name.startsWith("registration")) {
            await page.getByTestId("profile-account-dialog-connected").waitFor();
            assert.equal(await page.evaluate(() => window.readProofIdentity().id), user.id);
            assert.equal(await page.evaluate(() => window.readProofIdentity().onboardingCompleted), false);
            const cookies = await context.cookies(); const cookie = cookies.find(c => c.name === "proof.sid");
            assert.equal(cookie?.httpOnly, true); assert.equal(cookie?.secure, true);
            await page.reload(); await page.getByTestId("profile-account-dialog-connected").waitFor();
            assert.equal(new URL(page.url()).hostname, "proof.company.test");
            if (name.startsWith("registration")) assert.equal(counts.registrations, 1);
            if (name !== "registrationRecovery") assert.equal(counts.logins, 1);
          } else {
            await page.getByTestId("profile-account-error").waitFor();
            assert.equal(await page.getByTestId("profile-account-dialog-connected").count(), 0);
            assert.equal(await page.evaluate(() => window.readProofIdentity()), null);
            assert.equal(counts.logins, 1);
          }
        }
        const footer = page.getByTestId("jw-marketplace-tradescout-link");
        assert.equal(await footer.textContent(), "Powered by TradeScout");
        assert.equal(await footer.getAttribute("href"), "https://www.thetradescout.com/");
        assert.equal(await page.getByText("Explore TradeScout", { exact: true }).count(), 0);
        assert.deepEqual(counts.unexpected, []); assert.deepEqual(pageErrors, []);
        results.push({ name, width: viewport.width, passed: true, counts });
        console.log(`COMPANY_BROWSER ${name} ${viewport.width} PASS`);
      } finally { await context.close(); }
    }
  }
} finally {
  await browser.close(); await new Promise(done => { server.close(done); server.closeAllConnections(); });
  fs.rmSync(temp, { recursive: true, force: true });
  fs.writeFileSync(path.join(output, "receipt.json"), JSON.stringify({ source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), passed: results.length === 18, results, syntheticApi: true, productionWrites: false, providerAcceptance: false, crossDomainSsoAcceptance: false }, null, 2));
}
