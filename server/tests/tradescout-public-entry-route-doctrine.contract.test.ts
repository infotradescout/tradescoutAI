import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("TradeScout public entry route doctrine contracts", () => {
  const appRoutes = read("client/src/AppRoutes.tsx");
  const landing = read("client/src/pages/TradeScoutLandingPage.tsx");
  const landingVariants = read("client/src/pages/landingVariants.ts");

  it("keeps public landing entry routes wired through LandingAccessGate", () => {
    expect(appRoutes).toContain("isLandingRoute || isPublicRootLanding");

    expect(appRoutes).toContain('<Route path="/">');
    expect(appRoutes).toContain('<Route path="/landing">');
    expect(appRoutes).toContain('<Route path="/landing/:variant">');
    expect(appRoutes).toContain('<Route path="/lp">');
    expect(appRoutes).toContain('<Route path="/lp/:variant">');

    expect(appRoutes).toContain("<LandingAccessGate>");
    expect(appRoutes).toContain("<LazyPage Component={Landing} />");
  });

  it("preserves authenticated root handoff away from public landing", () => {
    expect(appRoutes).toContain("const LandingAccessGate");
    expect(appRoutes).toContain("if (!isAuthenticated) return <>{children}</>;");
    expect(appRoutes).toContain("const target = getPostLandingRoute(user);");
    expect(appRoutes).toContain("return <RedirectTo to={target} />;");

    expect(appRoutes).toContain("const RootLanding");
    expect(appRoutes).toContain("if (isAuthenticated)");
    expect(appRoutes).toContain("navigate(getPostLandingRoute(user));");
    expect(appRoutes).toContain(
      "if (!isAuthenticated) return <LazyPage Component={PublicLandingPage} />;"
    );
  });

  it("keeps canonical public landing doctrine copy bound to entry surfaces", () => {
    expect(landing).toContain("Connection Without Compromise");
    expect(landing).toContain("Start a Request");
    expect(landing).toContain("Claim Provider Profile");
    expect(landing).toContain("Direct Connect");
  });

  it("keeps CTA routing stable for request, claim, and community exploration", () => {
    expect(landing).toContain(
      "const LANDING_PRIMARY_REQUEST_HREF = `/direct-connect?source=${LANDING_PRIMARY_REQUEST_SOURCE}`;"
    );
    expect(landing).toContain('href="/register?role=provider"');
    expect(landing).toContain('href="/community"');
    expect(landing).toContain("Browse Local Activity");
  });

  it("blocks forbidden public-entry framing regressions", () => {
    const publicEntryCorpus = `${appRoutes}\n\n${landing}\n\n${landingVariants}`.toLowerCase();
    const normalizedLanding = landing.toLowerCase();

    expect(publicEntryCorpus).not.toContain("ask scout");
    expect(publicEntryCorpus).not.toContain("scout chatbot");
    expect(publicEntryCorpus).not.toContain("lead marketplace");
    expect(publicEntryCorpus).not.toContain("lead-selling");
    expect(publicEntryCorpus).not.toContain("tool catalog");
    expect(publicEntryCorpus).not.toContain("standalone tools");

    // Direct Connect is the product surface; internal architecture framing stays out.
    expect(normalizedLanding).not.toContain("routing algorithm");
    expect(normalizedLanding).not.toContain("authority layer");
    expect(normalizedLanding).not.toContain("handoff doctrine");
    expect(normalizedLanding).not.toContain("backend routing system");
    expect(normalizedLanding).not.toContain("operating system architecture");
  });
});
