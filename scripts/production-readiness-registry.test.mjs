import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  PR_RECOVERY_DISPOSITIONS,
  resolveApiRoute,
  resolveClientRoute,
} from "../config/production-readiness-registry.mjs";
import {
  extractApiRegistrationsFromSource,
  extractCompatibilityRedirects,
  extractLiteralClientRoutes,
  extractServerRenderedClientRoutes,
  runProductionReadinessGuard,
  validateApiRouteOwnership,
  validatePrRecoveryRecords,
  validateRouteExposure,
  verifyRecoveryMergeCommit,
} from "./guard-production-readiness-registry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("the real registry snapshot passes its hardened guard", () => {
  const result = runProductionReadinessGuard(root);
  assert.deepEqual(result.failures, []);
  assert.equal(result.counts.openPrHolds, 0);
  assert.equal(result.counts.mergedPrRecoveries, 7);
  assert.equal(result.counts.compatibilityRedirects, 54);
  assert.equal(result.counts.serverRenderedClientRoutes, 3);
});

test("operational business and growth tools keep their exact role boundaries", () => {
  const routes = new Map(
    extractLiteralClientRoutes(read("client/src/AppRoutes.tsx")).map((entry) => [entry.path, entry])
  );
  assert.deepEqual(routes.get("/application-tracker"), {
    path: "/application-tracker",
    source: "client/src/AppRoutes.tsx",
    access: "protected",
    requiredRoles: ["business_owner", "business_employee"],
  });

  const growthRoles = [
    "business_owner",
    "business_employee",
    "marketing_specialist",
    "content_seo",
  ];
  for (const route of [
    "/ad-creator",
    "/api-integrations",
    "/event-management",
    "/referral-dashboard",
    "/social-integration",
    "/story-generator",
  ]) {
    assert.equal(routes.get(route)?.access, "protected", route);
    assert.deepEqual(routes.get(route)?.requiredRoles, growthRoles, route);
  }

  assert.equal(routes.get("/notes")?.access, "protected");
  assert.deepEqual(routes.get("/notes")?.requiredRoles, []);
});

test("landed Release 0 recoveries retain exact main ancestry and replacement linkage", () => {
  const expected = [545, 546, 547, 548, 549, 550, 551];
  const merged = PR_RECOVERY_DISPOSITIONS.filter((pr) => pr.mergedIntoMain === true);
  assert.deepEqual(merged.map((pr) => pr.number).sort((a, b) => a - b), expected);
  for (const pr of merged) {
    assert.equal(pr.status, "closed");
    assert.equal(pr.disposition, "close");
    assert.equal(verifyRecoveryMergeCommit(pr, root), true, `PR #${pr.number}`);
  }
  assert.deepEqual(validatePrRecoveryRecords(PR_RECOVERY_DISPOSITIONS, (pr) => verifyRecoveryMergeCommit(pr, root)), []);

  const actual = merged.find((pr) => pr.number === 545);
  const another = merged.find((pr) => pr.number === 546);
  assert.equal(verifyRecoveryMergeCommit({ ...actual, mergeCommit: another.mergeCommit }, root), false);
  assert.equal(verifyRecoveryMergeCommit({ ...actual, mergeCommit: "f".repeat(40) }, root), false);
});

test("merged recovery promotion rejects missing receipts, false ancestry and broken linkage", () => {
  const mutate = (number, patch) => PR_RECOVERY_DISPOSITIONS.map((pr) => pr.number === number ? { ...pr, ...patch } : pr);
  assert.ok(validatePrRecoveryRecords(mutate(545, { mergeCommit: undefined })).some((failure) => failure.includes("exact merge commit")));
  assert.ok(validatePrRecoveryRecords(PR_RECOVERY_DISPOSITIONS, () => false).some((failure) => failure.includes("evidence in origin/main")));
  assert.ok(validatePrRecoveryRecords(mutate(545, { status: "open", disposition: "hold" })).some((failure) => failure.includes("must be closed")));
  assert.ok(validatePrRecoveryRecords(mutate(545, { replaces: [999] })).some((failure) => failure.includes("reciprocal")));
  assert.ok(validatePrRecoveryRecords(mutate(545, { mergedIntoMain: false })).some((failure) => failure.includes("without mergedIntoMain")));
});

test("unmerged replacement fixtures remain holds and cannot claim current-main recovery", () => {
  const records = [
    { number: 900, status: "closed", disposition: "close", owner: "test", replacementPr: 901, reason: "Superseded by a bounded draft." },
    { number: 901, status: "open", disposition: "hold", owner: "test", headRef: "test/recovery", mergedIntoMain: false, replaces: [900], reason: "Pending review; no current-main claim." },
  ];
  assert.deepEqual(validatePrRecoveryRecords(records), []);
  assert.ok(validatePrRecoveryRecords(records.map((pr) => pr.number === 901 ? { ...pr, mergedIntoMain: true } : pr)).length > 0);

  const falseCurrentMainClaim = records.map((pr) =>
    pr.number === 900
      ? { ...pr, reason: "Superseded by current-main recovery in draft PR #901." }
      : pr
  );
  assert.ok(
    validatePrRecoveryRecords(falseCurrentMainClaim).some((failure) =>
      failure.includes("incorrectly describes a draft PR as current-main")
    )
  );
});

test("server-rendered JW Stone routes are discovered and owned", () => {
  const routes = extractServerRenderedClientRoutes(read("server/index.ts"));
  assert.deepEqual(
    routes.map((entry) => entry.path).sort(),
    ["/jw-stone", "/jw-stone/materials/:materialSlug", "/jw-stone/stones/:stoneSlug"]
  );
  for (const route of routes) {
    assert.equal(resolveClientRoute(route.path)?.id, "jw-stone-public");
    assert.equal(resolveClientRoute(route.path)?.readiness, "production");
  }

  const unowned = extractServerRenderedClientRoutes(
    'app.get("/new-server-surface", handler);',
    ["/new-server-surface"],
    "synthetic-server"
  );
  assert.ok(
    validateRouteExposure({ routeEntries: unowned, policies: [] }).some((failure) =>
      failure.includes("Unowned client route /new-server-surface")
    )
  );
});

test("generated compatibility redirects are inventoried and boundary-owned", () => {
  const routes = extractCompatibilityRedirects(
    read("client/src/routing/compatibilityRedirects.ts")
  );
  assert.equal(routes.length, 54);
  assert.equal(routes.find((entry) => entry.path === "/contractors/apply")?.access, "public");
  assert.ok(routes.every((entry) => resolveClientRoute(entry.path)));
  assert.equal(resolveClientRoute("/contractors/apply")?.id, "business-operations");
  assert.equal(resolveClientRoute("/contractors/actual-profile")?.id, "public-profiles");
  assert.equal(resolveClientRoute("/contractors/apply-extra")?.id, "public-profiles");
  assert.equal(resolveClientRoute("/legal/privacy-policy")?.id, "public-information");

  const unowned = extractCompatibilityRedirects(
    'const redirects = [{ from: "/new-compatibility-alias", to: "/", access: "public" }];',
    "synthetic-redirects"
  );
  assert.ok(
    validateRouteExposure({ routeEntries: unowned, policies: [] }).some((failure) =>
      failure.includes("Unowned client route /new-compatibility-alias")
    )
  );
});

test("API extraction covers literal, constant, and array registrations", () => {
  const synthetic = `
    const WEBHOOK = "/api/payments/stripe/webhook";
    const ROUTES = ["/api/one", "/api/two"];
    app.post(WEBHOOK, handler);
    app.get(ROUTES, handler);
    app.patch(["/api/three", "/not-api"], handler);
    app.get("/api/literal", handler);
  `;
  assert.deepEqual(
    [...new Set(extractApiRegistrationsFromSource(synthetic))].sort(),
    [
      "/api/literal",
      "/api/one",
      "/api/payments/stripe/webhook",
      "/api/three",
      "/api/two",
    ]
  );

  const paymentRoutes = extractApiRegistrationsFromSource(read("server/paymentWebhookRoutes.ts"));
  assert.ok(paymentRoutes.includes("/api/payments/webhook"));
  assert.ok(paymentRoutes.includes("/api/payments/stripe/webhook"));
  assert.equal(resolveApiRoute("/api/payments/stripe/webhook")?.id, "business-operations-api");
  assert.deepEqual(validateApiRouteOwnership(paymentRoutes), []);
  assert.ok(
    validateApiRouteOwnership(
      extractApiRegistrationsFromSource(
        'const UNKNOWN = ["/api/unregistered-contract"]; app.post(UNKNOWN, handler);'
      )
    ).includes("Unowned API route /api/unregistered-contract")
  );
});

test("public datasets, compliance, and training are no longer internal-only", () => {
  assert.equal(resolveClientRoute("/datasets")?.id, "public-data");
  assert.equal(resolveClientRoute("/datasets/counties")?.readiness, "production");
  assert.equal(resolveClientRoute("/compliance")?.id, "public-information");
  assert.equal(resolveClientRoute("/training-center")?.readiness, "production");

  const incorrectlyInternal = [{
    id: "synthetic-internal-data",
    match: /^\/datasets(?:\/|$)/,
    owner: "synthetic",
    readiness: "internal_only",
  }];
  const failures = validateRouteExposure({
    routeEntries: [{ path: "/datasets", source: "synthetic", access: "public" }],
    sitemapRoutes: ["/datasets"],
    families: incorrectlyInternal,
    policies: [],
  });
  assert.ok(failures.some((failure) => failure.includes("internal_only route /datasets is exposed")));
  assert.ok(failures.some((failure) => failure.includes("exposed in the sitemap")));
});

test("readiness rules reject disabled, internal, and closed-beta exposure regressions", () => {
  const disabledFailures = validateRouteExposure({
    routeEntries: [{ path: "/membership-portal", source: "synthetic", access: "public" }],
    policies: [],
  });
  assert.ok(disabledFailures.some((failure) => failure.includes("is not fail-closed")));

  const internalFailures = validateRouteExposure({
    routeEntries: [{ path: "/admin", source: "synthetic", access: "public" }],
    sitemapRoutes: ["/admin"],
    policies: [],
  });
  assert.ok(internalFailures.some((failure) => failure.includes("internal_only route /admin is exposed")));
  assert.ok(internalFailures.some((failure) => failure.includes("exposed in the sitemap")));

  const betaFailures = validateRouteExposure({
    routeEntries: [{ path: "/realtor-secret-tool", source: "synthetic", access: "public" }],
    policies: [],
  });
  assert.ok(betaFailures.some((failure) => failure.includes("public without an exposure policy")));

  const betaIndexFailures = validateRouteExposure({
    routeEntries: [{ path: "/realtor-clients", source: "synthetic", access: "public" }],
    sitemapRoutes: ["/realtor-clients"],
  });
  assert.ok(betaIndexFailures.some((failure) => failure.includes("indexed without an indexable")));
});

test("the canonical minimum release contract runs the guard before typecheck", () => {
  const source = read("scripts/run-minimum-release-contract.mjs");
  const guard = source.indexOf('"guard:production-readiness-registry"');
  const contracts = source.indexOf('"test:production-readiness-registry"');
  const typecheck = source.indexOf('label: "npm run check"');
  assert.ok(guard >= 0);
  assert.ok(contracts > guard);
  assert.ok(typecheck > contracts);
});
