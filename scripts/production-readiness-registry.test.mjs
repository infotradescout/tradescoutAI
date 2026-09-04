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
} from "./guard-production-readiness-registry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("the real registry snapshot passes its hardened guard", () => {
  const result = runProductionReadinessGuard(root);
  assert.deepEqual(result.failures, []);
  assert.equal(result.counts.openPrHolds, 7);
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

test("open Release 0 recovery drafts remain explicit unmerged holds", () => {
  const expected = [545, 546, 547, 548, 549, 550, 551];
  const held = PR_RECOVERY_DISPOSITIONS.filter((pr) => pr.disposition === "hold");
  assert.deepEqual(held.map((pr) => pr.number).sort((a, b) => a - b), expected);
  for (const pr of held) {
    assert.equal(pr.status, "open");
    assert.equal(pr.mergedIntoMain, false);
    assert.match(pr.reason, /not current-main production evidence/);
  }
  assert.deepEqual(validatePrRecoveryRecords(), []);

  const falseCurrentMainClaim = PR_RECOVERY_DISPOSITIONS.map((pr) =>
    pr.number === 409
      ? { ...pr, reason: "Superseded by current-main recovery in draft PR #546." }
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
