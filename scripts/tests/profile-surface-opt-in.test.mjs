/** Run with Node 22.13+: node --experimental-vm-modules --test scripts/tests/profile-surface-opt-in.test.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

// Execute the actual source modules with their real dependencies. No auth,
// routing, verification, database, or provider result is replaced by a fixture.
const root = fileURLToPath(new URL("../../", import.meta.url));
const context = vm.createContext({ URL, URLSearchParams });
const modules = new Map();
async function load(relative) {
  if (modules.has(relative)) return modules.get(relative);
  const mod = new vm.SourceTextModule(
    stripTypeScriptTypes(fs.readFileSync(path.join(root, relative), "utf8")),
    { context, identifier: relative }
  );
  modules.set(relative, mod);
  await mod.link((specifier) => {
    const relative = specifier.startsWith("@shared/")
      ? `shared/${specifier.slice(8)}.ts`
      : specifier.startsWith("@/") ? `client/src/${specifier.slice(2)}.ts` : null;
    if (!relative) throw new Error(`Unexpected dependency: ${specifier}`);
    return load(relative);
  });
  return mod;
}
const frontend = await load("client/src/lib/preScoutAuthHandoff.ts");
const backend = await load("server/utils/oauthIdentityPolicy.ts");
await frontend.evaluate();
await backend.evaluate();
const { resolvePreScoutAuthenticatedRoute } = frontend.namespace;
const { oauthPostLoginPath, decideOAuthIdentity } = backend.namespace;
const { isProfileSurfaceContinuation, profileTradeScoutOptInPath } =
  modules.get("shared/profileSurfaceContinuation.ts").namespace;
const { isOnboardingExemptPath, userNeedsOnboarding, resolvePostOnboardingRoute } =
  modules.get("client/src/lib/postOnboardingRoute.ts").namespace;

const companyPaths = [
  "/u/jw-stone", "/u/jw-stone?profileAccount=1&profileAccountMode=signin",
  "/jw-stone?profileAccount=1", "/p/jw-stone/",
  "/u/another-company?request=collection#account",
  "/u/jw-stone/stones/honey-onyx?photo=2",
  "/u/jw-stone/materials/quartzite", "/jw-stone/stones/honey-onyx",
  "/check-email?next=%2Fu%2Fjw-stone%3FprofileAccount%3D1",
  "/verify-email?token=synthetic-only&next=%2Fu%2Fanother-company",
  "/reset-password?next=%2Fjw-stone%3FprofileAccount%3D1",
];
for (const next of companyPaths) {
  test(`company continuation stays company-scoped before and after onboarding: ${next}`, () => {
    assert.equal(isProfileSurfaceContinuation(next), true);
    assert.equal(isOnboardingExemptPath(next), true);
    for (const onboardingCompleted of [false, true]) {
      assert.equal(resolvePreScoutAuthenticatedRoute({ explicitNext: next, onboardingCompleted }), next);
      assert.equal(oauthPostLoginPath(next, onboardingCompleted), next);
    }
  });
}
const notCompanyPaths = [
  "", null, "https://evil.example/u/jw-stone", "//evil.example/u/jw-stone",
  "/\\evil.example/u/jw-stone", "/u/jw-stone\n", "/u/%2Fjw-stone",
  "/u/acme/../jw-stone", "/u/acme/%2e%2e/jw-stone", "/u/jw-stone/admin",
  "/scout?next=/u/jw-stone", "/direct-connect?profileAccount=1",
  "/api/u/jw-stone/account", "/admin?next=/u/jw-stone", "/",
  "/check-email?next=%2Fu%2Fjw-stone&next=%2Fscout",
  "/reset-password?next=%2Fscout", "/onboarding?next=%2Fu%2Fjw-stone",
];
for (const candidate of notCompanyPaths) {
  test(`an unrelated or malformed destination is not a company continuation: ${JSON.stringify(candidate)}`, () => {
    assert.equal(isProfileSurfaceContinuation(candidate), false);
  });
}
test("only the explicit full-experience destination starts full onboarding, then leads to Scout", () => {
  const href = new URL(profileTradeScoutOptInPath(), "https://www.thetradescout.com");
  assert.equal(href.pathname, "/pre-scout-setup");
  assert.equal(href.searchParams.get("mode"), "signin");
  const next = href.searchParams.get("next");
  assert.equal(next, "/scout");
  assert.equal(resolvePreScoutAuthenticatedRoute({ explicitNext: next, onboardingCompleted: false }), "/onboarding?next=%2Fscout");
  assert.equal(oauthPostLoginPath(next, false), "/onboarding/profile?next=%2Fscout");
  assert.equal(resolvePreScoutAuthenticatedRoute({ explicitNext: next, onboardingCompleted: true }), "/scout");
  assert.equal(oauthPostLoginPath(next, true), "/scout");
  assert.equal(resolvePostOnboardingRoute({ nextParam: next }), "/scout");
});
test("company continuity does not complete onboarding or confer additional authority", () => {
  const user = Object.freeze({ id: "same-identity", onboardingCompleted: false, emailVerified: false });
  assert.equal(userNeedsOnboarding(user), true);
  resolvePreScoutAuthenticatedRoute({ explicitNext: "/u/jw-stone", onboardingCompleted: user.onboardingCompleted });
  assert.equal(user.onboardingCompleted, false);
  assert.equal(user.emailVerified, false);
  assert.equal(userNeedsOnboarding(user), true);
});
test("general app journeys still require onboarding, not a company query-string bypass", () => {
  for (const next of ["/scout", "/projects/7", "/direct-connect?next=/u/jw-stone"]) {
    assert.equal(isOnboardingExemptPath(next), false);
    assert.equal(resolvePreScoutAuthenticatedRoute({ explicitNext: next, onboardingCompleted: false }), `/onboarding?next=${encodeURIComponent(next)}`);
    assert.equal(oauthPostLoginPath(next, false), `/onboarding/profile?next=${encodeURIComponent(next)}`);
  }
});
test("existing recommendation continuations and identity collision controls are preserved", () => {
  const next = "/verification?next=%2Fu%2Facme%3FtrustAction%3Drecommend";
  assert.equal(resolvePreScoutAuthenticatedRoute({ explicitNext: next, onboardingCompleted: false }), next);
  assert.equal(oauthPostLoginPath(next, false), next);
  assert.equal(decideOAuthIdentity({ providerUserId: "one", emailUserId: "two" }).kind, "identity_collision");
  assert.equal(decideOAuthIdentity({ emailUserId: "same-identity" }).kind, "link_required");
  assert.equal(decideOAuthIdentity({ providerUserId: "same-identity", emailUserId: "same-identity" }).userId, "same-identity");
});
