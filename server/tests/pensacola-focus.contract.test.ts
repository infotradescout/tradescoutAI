import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("pensacola focus contracts", () => {
  it("pensacola launch hub page exists with escambia-first conversion CTAs", () => {
    const source = read("client/src/pages/pensacola.tsx");
    expect(source).toContain("Pensacola first. Built local.");
    expect(source).toContain("PENSACOLA_CLUSTERS, PENSACOLA_COUNTY_CODE");
    expect(source).toContain("county=${PENSACOLA_COUNTY_CODE}");
    expect(source).toContain("/create-account?source=pensacola-launch");
    expect(source).toContain("without lead reselling or pay-to-play");
    expect(source).toContain("/pensacola/${cluster.slug}");
  });

  it("find local businesses page contains pensacola launch focus and query cluster", () => {
    const source = read("client/src/pages/find-local-businesses.tsx");
    expect(source).toContain("Ground Zero Market");
    expect(source).toContain("Pensacola, FL first");
    expect(source).toContain("county=12033");
    expect(source).toContain("HOMEOWNER_POPULAR_QUERIES");
    expect(source).toContain("/pensacola");
    expect(source).toContain("/pensacola/hvac-repair");
  });

  it("for businesses page contains pensacola onboarding focus and query cluster", () => {
    const source = read("client/src/pages/for-businesses.tsx");
    expect(source).toContain("Launch Focus");
    expect(source).toContain("Pensacola, FL business launch");
    expect(source).toContain("county=12033");
    expect(source).toContain("BUSINESS_POPULAR_QUERIES");
    expect(source).toContain("/pensacola");
    expect(source).toContain("/pensacola/electrical-contractors");
  });

  it("route and public pages link to the pensacola hub", () => {
    const routes = read("client/src/AppRoutes.tsx");
    const landing = read("client/src/pages/landing.tsx");
    const howItWorks = read("client/src/pages/how-it-works.tsx");
    const trustModel = read("client/src/pages/trust-model.tsx");

    expect(routes).toContain('const PensacolaPage = React.lazy(() => import("./pages/pensacola"))');
    expect(routes).toContain(
      'const PensacolaClusterPage = React.lazy(() => import("./pages/pensacola-cluster"))'
    );
    expect(routes).toContain('<Route path="/pensacola">');
    expect(routes).toContain('<Route path="/pensacola/:clusterSlug">');
    expect(landing).toContain("Pensacola launch hub");
    expect(howItWorks).toContain("Pensacola launch hub →");
    expect(trustModel).toContain("Pensacola launch hub →");
  });

  it("pensacola cluster page enforces canonical service routes and noindex fallback", () => {
    const source = read("client/src/pages/pensacola-cluster.tsx");
    expect(source).toContain('useRoute("/pensacola/:clusterSlug")');
    expect(source).toContain(
      "const canonicalUrl = `https://www.thetradescout.com/pensacola/${cluster.slug}`"
    );
    expect(source).toContain("noIndex");
    expect(source).toContain("Other Pensacola service clusters");
  });
});
