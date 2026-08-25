import { describe, expect, it } from "vitest";
import { attachPublicProfileServiceJourneyScript } from "../publicSeoHtml";

const serviceHtml = `<!doctype html>
<html>
  <head>
    <meta name="tradescout-business-slug" content="property-blessings" />
    <meta name="tradescout-business-entity-type" content="business_profile" />
    <meta name="tradescout-discovery-attribution" content="payload.signature" />
    <link rel="canonical" href="https://www.thetradescout.com/u/property-blessings/services/land-clearing-site-preparation" />
  </head>
  <body>
    <main data-public-profile-service-page="true">
      <a href="https://www.thetradescout.com/direct-connect?profile=property-blessings&source=profile_service_page">Start a Request</a>
    </main>
  </body>
</html>`;

describe("public profile service discovery journey", () => {
  it("records a signed landing and a versioned Direct Connect intent with one tab session", () => {
    const html = attachPublicProfileServiceJourneyScript(serviceHtml);

    expect(html).toContain('data-ts-profile-service-journey="true"');
    expect(html).toContain('tradescout:discovery-session:v1');
    expect(html).toContain('type: "discovery_landing"');
    expect(html).toContain('discoveryAttributionToken: token');
    expect(html).toContain('"X-Anonymous-Session-Id": sessionId');
    expect(html).toContain('type: "public_profile_direct_connect_opened"');
    expect(html).toContain('surface: "profile_service_page_cta"');
    expect(html).toContain('linkageVersion: 1');
    expect(html).toContain('destination.searchParams.get("source") !== "profile_service_page"');
  });

  it("emits browser-parseable JavaScript", () => {
    const html = attachPublicProfileServiceJourneyScript(serviceHtml);
    const script = html.match(
      /<script data-ts-profile-service-journey="true">([\s\S]*?)<\/script>/i
    )?.[1];

    expect(script).toBeTruthy();
    expect(() => new Function(script || "")).not.toThrow();
  });

  it("does not double-install the journey bridge", () => {
    const once = attachPublicProfileServiceJourneyScript(serviceHtml);
    const twice = attachPublicProfileServiceJourneyScript(once);

    expect(twice).toBe(once);
    expect(twice.match(/data-ts-profile-service-journey=/g)).toHaveLength(1);
  });

  it("leaves ordinary public profile HTML unchanged", () => {
    const ordinary = '<html><body><main data-seo-profile="true">Profile</main></body></html>';
    expect(attachPublicProfileServiceJourneyScript(ordinary)).toBe(ordinary);
  });

  it("does not add contact, account, request-text, or fingerprint fields", () => {
    const html = attachPublicProfileServiceJourneyScript(serviceHtml);

    expect(html).not.toContain('email:');
    expect(html).not.toContain('phone:');
    expect(html).not.toContain('address:');
    expect(html).not.toContain('userId:');
    expect(html).not.toContain('fingerprint');
    expect(html).not.toContain('requestText');
  });
});
