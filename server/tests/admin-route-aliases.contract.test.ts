import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

const LEGACY_ALIAS_REDIRECTS: Array<{ legacy: string; canonical: string }> = [
  { legacy: "/admin-panel", canonical: "/admin/panel" },
  { legacy: "/admin-dashboard", canonical: "/admin" },
  { legacy: "/admin/dashboard", canonical: "/admin" },
  { legacy: "/admin-users", canonical: "/admin/users" },
  { legacy: "/admin-observability", canonical: "/admin/live-stream" },
  { legacy: "/staff/hardrock-directory", canonical: "/admin/commercial-directory" },
  { legacy: "/staff/share-links", canonical: "/admin/share-links" },
  { legacy: "/staff/inspection-intelligence", canonical: "/admin/inspection-intelligence" },
  { legacy: "/contractor-verification", canonical: "/admin/professional-verification" },
  { legacy: "/content-moderation", canonical: "/admin/moderation" },
  { legacy: "/system-settings", canonical: "/admin/site-settings" },
  { legacy: "/support-tickets", canonical: "/admin/errors" },
  { legacy: "/platform-analytics", canonical: "/admin/platform-analytics" },
  { legacy: "/manage-users", canonical: "/admin/users" },
  { legacy: "/payment-processing", canonical: "/admin/payment-model" },
  { legacy: "/file-management", canonical: "/admin/attachments" },
];

describe("admin route alias contracts", () => {
  it("keeps legacy route redirects wired in AppRoutes", () => {
    const source = read("client/src/AppRoutes.tsx");

    for (const entry of LEGACY_ALIAS_REDIRECTS) {
      expect(source).toContain(`<Route path="${entry.legacy}">`);
      expect(source).toContain(`<RedirectTo to="${entry.canonical}" />`);
    }
  });

  it("keeps centralized ROUTES.ALIASES mappings aligned with canonical admin paths", () => {
    const source = read("client/src/lib/routes.ts");

    const aliasPairs = [
      ...LEGACY_ALIAS_REDIRECTS,
      { legacy: "/admin/dashboard", canonical: "/admin" },
    ];

    for (const entry of aliasPairs) {
      expect(source).toContain(`"${entry.legacy}": "${entry.canonical}"`);
    }
    expect(source).toContain('"/admin/contractors": "/admin/business-provider-settings"');
    expect(source).toContain('"/admin/contractor-settings": "/admin/business-provider-settings"');
  });

  it("allows onboarding deep-links for approved legacy admin aliases", () => {
    const source = read("client/src/lib/postOnboardingRoute.ts");

    const requiredSafePrefixes = [
      "/admin/professional-verification",
      "/admin/business-provider-settings",
      "/admin/contractors",
      "/admin/contractor-settings",
      "/contractor-verification",
      "/content-moderation",
      "/admin/dashboard",
      "/admin-panel",
      "/admin-dashboard",
      "/admin-users",
      "/admin/workspace",
      "/staff/hardrock-directory",
      "/staff/share-links",
      "/staff/inspection-intelligence",
      "/system-settings",
      "/support-tickets",
      "/platform-analytics",
      "/manage-users",
      "/payment-processing",
      "/file-management",
      "/admin-observability",
    ];

    for (const prefix of requiredSafePrefixes) {
      expect(source).toContain(`"${prefix}"`);
    }
  });

  it("enforces route-alias drift guard coverage for the same legacy alias set", () => {
    const source = read("scripts/guard-admin-route-aliases.mjs");

    for (const entry of LEGACY_ALIAS_REDIRECTS) {
      expect(source).toContain(`"${entry.legacy}"`);
    }
    expect(source).toContain('"/admin/contractors"');
    expect(source).toContain('"/admin/contractor-settings"');
    expect(source).toContain('"client/src/AppRoutes.tsx"');
    expect(source).toContain('"client/src/admin/adminTools.tsx"');
    expect(source).toContain('"client/src/lib/postOnboardingRoute.ts"');
    expect(source).toContain('"client/src/lib/routes.ts"');
  });
});

describe("support routing contracts", () => {
  it("routes support navigation intent to the public help center", () => {
    const source = read("server/scout/scoutDecisionPipeline.ts");
    expect(source).toContain(
      '{ route: "/help", label: "Open Help Center", pattern: /support tickets?/i }'
    );
    expect(source).not.toContain(
      '{ route: "/support-tickets", label: "Open Support Tickets", pattern: /support tickets?/i }'
    );
    expect(source).not.toContain(
      '{ route: "/admin/errors", label: "Open Admin Error Reports", pattern: /support tickets?/i }'
    );
  });

  it("keeps support behavior handler actions on /help", () => {
    const source = read("server/scout/scoutBehaviorHandlers.ts");
    expect(source).toContain('to: "/help"');
    expect(source).toContain('path: "/help"');
    expect(source).toContain('label: "Open help center"');
    expect(source).not.toContain('to: "/support-tickets"');
    expect(source).not.toContain('to: "/admin/errors"');
  });
});
