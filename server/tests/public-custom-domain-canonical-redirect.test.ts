import { describe, expect, it } from "vitest";
import {
  buildPublicCustomDomainCanonicalAliasMap,
  resolvePublicCustomDomainAliasDestination,
} from "../publicCustomDomainCanonicalRedirect";
import type { PublicCustomDomainCanonicalAuditTarget } from "../services/publicCustomDomainCanonicalAudit";

function target(
  overrides: Partial<PublicCustomDomainCanonicalAuditTarget> = {}
): PublicCustomDomainCanonicalAuditTarget {
  return {
    profileSlug: "jw-stone",
    businessSlug: "jw-stone",
    sourceKind: "vanity_root",
    sourceUrl: "https://www.thetradescout.com/jw-stone",
    expectedCanonicalUrl: "https://jwstonelogistics.com/",
    ...overrides,
  };
}

describe("public custom-domain canonical redirects", () => {
  it("builds a fail-closed alias map from TradeScout paths to external HTTPS canonicals", () => {
    const first = target();
    const aliases = buildPublicCustomDomainCanonicalAliasMap([
      first,
      target({ expectedCanonicalUrl: "https://different.example.com/" }),
      target({
        sourceUrl: "https://untrusted.example.com/jw-stone",
        expectedCanonicalUrl: "https://jwstonelogistics.com/",
      }),
      target({
        sourceUrl: "https://www.thetradescout.com/insecure",
        expectedCanonicalUrl: "http://jwstonelogistics.com/",
      }),
      target({
        sourceUrl: "https://www.thetradescout.com/internal",
        expectedCanonicalUrl: "https://www.thetradescout.com/u/jw-stone",
      }),
      target({
        sourceUrl: "https://www.thetradescout.com/credentialed",
        expectedCanonicalUrl: "https://user:pass@jwstonelogistics.com/",
      }),
    ]);

    expect([...aliases.keys()]).toEqual(["/jw-stone"]);
    expect(aliases.get("/jw-stone")).toBe(first);
  });

  it("redirects known roots and child pages directly to the owner domain", () => {
    const aliases = buildPublicCustomDomainCanonicalAliasMap([
      target(),
      target({
        sourceKind: "profile_child",
        sourceUrl: "https://www.thetradescout.com/u/jw-stone/stones/taj-mahal",
        expectedCanonicalUrl: "https://jwstonelogistics.com/stones/taj-mahal",
      }),
    ]);

    expect(
      resolvePublicCustomDomainAliasDestination({
        host: "WWW.THETRADESCOUT.COM:443",
        originalUrl: "/JW-STONE/",
        aliases,
      })
    ).toBe("https://jwstonelogistics.com/");
    expect(
      resolvePublicCustomDomainAliasDestination({
        host: "www.thetradescout.com",
        originalUrl: "/u/jw-stone/stones/taj-mahal",
        aliases,
      })
    ).toBe("https://jwstonelogistics.com/stones/taj-mahal");
  });

  it("preserves only approved attribution and request state", () => {
    const aliases = buildPublicCustomDomainCanonicalAliasMap([target()]);
    const destination = resolvePublicCustomDomainAliasDestination({
      host: "www.thetradescout.com",
      originalUrl:
        "/jw-stone?ref=partner-7&utm_source=directory&request=stone&request=unexpected&photo=2&profileAccount=1&profileAccountMode=signin&next=https%3A%2F%2Fevil.example.com",
      aliases,
    });

    expect(destination).not.toBeNull();
    const url = new URL(destination!);
    expect(url.origin).toBe("https://jwstonelogistics.com");
    expect(url.pathname).toBe("/");
    expect(Object.fromEntries(url.searchParams.entries())).toEqual({
      ref: "partner-7",
      utm_source: "directory",
      request: "stone",
      photo: "2",
      profileAccount: "1",
      profileAccountMode: "signin",
    });
  });

  it("drops invalid reserved values and arbitrary redirect parameters", () => {
    const aliases = buildPublicCustomDomainCanonicalAliasMap([target()]);
    const destination = resolvePublicCustomDomainAliasDestination({
      host: "www.thetradescout.com",
      originalUrl:
        "/jw-stone?request=unexpected&photo=0&profileAccount=0&profileAccountMode=admin&redirect=https%3A%2F%2Fevil.example.com&ref=kept",
      aliases,
    });

    expect(destination).not.toBeNull();
    const url = new URL(destination!);
    expect(Object.fromEntries(url.searchParams.entries())).toEqual({ ref: "kept" });
  });

  it("leaves legacy root selectors to the existing item and category canonicalizer", () => {
    const aliases = buildPublicCustomDomainCanonicalAliasMap([
      target(),
      target({
        sourceKind: "profile_root",
        sourceUrl: "https://www.thetradescout.com/u/jw-stone",
      }),
      target({
        sourceKind: "business_root",
        sourceUrl: "https://www.thetradescout.com/business/jw-stone",
      }),
    ]);

    expect(
      resolvePublicCustomDomainAliasDestination({
        host: "www.thetradescout.com",
        originalUrl: "/jw-stone?stone=blue-dunes&photo=2",
        aliases,
      })
    ).toBeNull();
    expect(
      resolvePublicCustomDomainAliasDestination({
        host: "www.thetradescout.com",
        originalUrl: "/u/jw-stone?gallery=finished-kitchens",
        aliases,
      })
    ).toBeNull();
    expect(
      resolvePublicCustomDomainAliasDestination({
        host: "www.thetradescout.com",
        originalUrl: "/business/jw-stone?category=quartzite",
        aliases,
      })
    ).toBeNull();
  });

  it("does not redirect unknown paths or requests already on another host", () => {
    const aliases = buildPublicCustomDomainCanonicalAliasMap([target()]);

    expect(
      resolvePublicCustomDomainAliasDestination({
        host: "jwstonelogistics.com",
        originalUrl: "/jw-stone",
        aliases,
      })
    ).toBeNull();
    expect(
      resolvePublicCustomDomainAliasDestination({
        host: "www.thetradescout.com",
        originalUrl: "/not-a-published-alias",
        aliases,
      })
    ).toBeNull();
  });
});
