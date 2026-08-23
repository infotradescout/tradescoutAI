import { describe, expect, it } from "vitest";
import {
  projectPublicProfileApiPayload,
  projectPublicProfileSearchResult,
} from "../services/publicProfileApiProjection";

const DIRECT_CONTACT_PATTERN =
  /(?:\b(?:mailto|tel|sms):|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b(?:https?:\/\/|www\.)|\b(?:[a-z0-9](?:[a-z0-9-]{0,62})\.)+[a-z]{2,63}\b|\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b|\bP\.?\s*O\.?\s+Box\s+\d+|\b\d{1,6}\s+(?:[A-Z0-9.'-]+\s+){0,6}(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way|Highway|Hwy|Trail|Trl|Parkway|Pkwy)\b)/i;

describe("public profile API projection", () => {
  it("sanitizes owner-authored text recursively without mutating the current API shape", () => {
    const input = {
      profile: {
        id: "profile-1",
        slug: "acme-plumbing",
        displayName: "Acme Plumbing (423) 555-0102",
        headline: "Email dispatch@acme.example or visit acme.example/services",
        preferences: { publicProfileIds: ["profile-1"] },
        seoMeta: {
          customDomain: "profile.acme.example",
          imageUrl: "https://cdn.example.test/profile/acme-social.jpg",
        },
        contentBlocks: [
          {
            type: "localServiceProfile",
            data: {
              presentation: {
                heroTitle: "Emergency help at https://acme.example or (423) 555-0102",
                heroDescription:
                  "Visit 123 N Main St Suite 4 or mail P.O. Box 77; dispatch@acme.example.",
                heroImage: "/images/businesses/acme/hero.jpg",
                logoImage: "https://cdn.example.test/acme/logo.png",
                heroImageAlt: "Acme crew at 123 N Main Street",
                locationLabel: "Chattanooga, Tennessee",
                addressLabel: "123 N Main St Suite 4, Chattanooga, TN 37402",
                websiteUrl: "https://acme.example",
                directionsUrl: "https://maps.example.test/?q=123+N+Main",
                websiteActionLabel: "Company website",
                credentials: [
                  {
                    label: "License source",
                    verificationUrl: "https://licenses.example.gov/verify/acme",
                  },
                ],
                socials: [
                  {
                    id: "instagram",
                    label: "Instagram",
                    href: "https://instagram.com/acme",
                  },
                ],
                contactLinks: [
                  { label: "Email dispatch", href: "mailto:dispatch@acme.example" },
                  { label: "Call dispatch", href: "tel:+14235550102" },
                  { label: "Contact page", href: "/contact/acme" },
                ],
                learnMoreUrl: "https://partner.example/acme",
                highlights: ["https://acme.example"],
              },
            },
          },
          {
            type: "quarryEvidence",
            data: {
              title: "Official material source",
              imageUrl: "/images/businesses/acme/material.svg",
              sourceUrl: "https://source.example.org/material/acme",
              attribution: {
                label: "Manufacturer source",
                url: "https://manufacturer.example.org/catalog/acme",
              },
            },
          },
        ],
      },
      business: {
        id: "business-1",
        categories: ["Plumber"],
        expressContactCapabilities: { call: true, request: true },
      },
    };
    const before = structuredClone(input);

    const projected = projectPublicProfileApiPayload(input);
    const presentation = projected.profile.contentBlocks[0].data.presentation;
    const evidence = projected.profile.contentBlocks[1].data;

    expect(input).toEqual(before);
    expect(projected).not.toBe(input);
    expect(projected.profile).not.toBe(input.profile);
    expect(projected.profile.contentBlocks).not.toBe(input.profile.contentBlocks);
    expect(projected.profile.id).toBe("profile-1");
    expect(projected.profile.slug).toBe("acme-plumbing");
    expect(projected.profile.preferences.publicProfileIds).toEqual(["profile-1"]);
    expect(projected.business.expressContactCapabilities).toEqual({ call: true, request: true });

    expect(projected.profile.displayName).not.toMatch(DIRECT_CONTACT_PATTERN);
    expect(projected.profile.headline).not.toMatch(DIRECT_CONTACT_PATTERN);
    expect(presentation.heroTitle).not.toMatch(DIRECT_CONTACT_PATTERN);
    expect(presentation.heroDescription).not.toMatch(DIRECT_CONTACT_PATTERN);
    expect(presentation.heroImageAlt).not.toMatch(DIRECT_CONTACT_PATTERN);
    expect(presentation.locationLabel).toBe("Chattanooga, Tennessee");

    // Publication is not contact or exact-location consent.
    expect(presentation.addressLabel).toBeNull();
    expect(presentation.websiteUrl).toBeNull();
    expect(presentation.directionsUrl).toBeNull();
    expect(presentation.socials[0]).toMatchObject({ id: "instagram", href: null });
    expect(presentation.contactLinks).toEqual([
      { label: "Email dispatch", href: null },
      { label: "Call dispatch", href: null },
      { label: "Contact page", href: null },
    ]);
    expect(presentation.learnMoreUrl).toBeNull();
    expect(presentation.highlights).toEqual(["Continue through TradeScout"]);

    // Media, routing metadata, and source-attribution evidence keep the exact
    // URL values current renderers require.
    expect(projected.profile.seoMeta.customDomain).toBe("profile.acme.example");
    expect(projected.profile.seoMeta.imageUrl).toBe(
      "https://cdn.example.test/profile/acme-social.jpg"
    );
    expect(presentation.heroImage).toBe("/images/businesses/acme/hero.jpg");
    expect(presentation.logoImage).toBe("https://cdn.example.test/acme/logo.png");
    expect(presentation.credentials[0].verificationUrl).toBe(
      "https://licenses.example.gov/verify/acme"
    );
    expect(evidence.imageUrl).toBe("/images/businesses/acme/material.svg");
    expect(evidence.sourceUrl).toBe("https://source.example.org/material/acme");
    expect(evidence.attribution.url).toBe("https://manufacturer.example.org/catalog/acme");
  });

  it("requires exact per-field consent and never derives it from publicProfileIds", () => {
    const input = {
      preferences: { publicProfileIds: ["profile-1"] },
      websiteUrl: "https://acme.example",
      directionsUrl: "https://maps.example.test/acme",
      addressLabel: "123 Main St, Chattanooga, TN",
      email: "dispatch@acme.example",
      phone: "(423) 555-0102",
      socials: [{ href: "https://instagram.com/acme", label: "Instagram" }],
      outboundLinks: [{ href: "https://partner.example/acme", label: "Partner" }],
      contactLinks: [{ href: "mailto:dispatch@acme.example", label: "Email" }],
    };

    const defaultProjection = projectPublicProfileApiPayload(input);
    expect(defaultProjection).toMatchObject({
      websiteUrl: null,
      directionsUrl: null,
      addressLabel: null,
      email: null,
      phone: null,
    });
    expect(defaultProjection.socials[0].href).toBeNull();
    expect(defaultProjection.outboundLinks[0].href).toBeNull();
    expect(defaultProjection.contactLinks[0].href).toBeNull();

    const consented = projectPublicProfileApiPayload(input, {
      fieldConsent: {
        websiteUrl: true,
        directionsUrl: true,
        addressLabel: true,
        email: true,
        phone: true,
        socialLinks: true,
        outboundLinks: true,
        contactLinks: true,
      },
    });
    expect(consented).toEqual(input);
    expect(consented).not.toBe(input);
  });

  it("drops raw link-array entries while preserving object adapters with null action fields", () => {
    const projected = projectPublicProfileApiPayload({
      socialLinks: [
        "https://instagram.com/acme",
        { label: "Facebook", href: "https://facebook.com/acme" },
      ],
      sourceUrls: ["https://registry.example.gov/acme"],
      imageUrls: ["https://cdn.example.test/acme-1.jpg", "/images/acme-2.jpg"],
      internalPaths: ["/u/acme", "/direct-connect?target=profile-1"],
    });

    expect(projected.socialLinks).toEqual([{ label: "Facebook", href: null }]);
    expect(projected.sourceUrls).toEqual(["https://registry.example.gov/acme"]);
    expect(projected.imageUrls).toEqual([
      "https://cdn.example.test/acme-1.jpg",
      "/images/acme-2.jpg",
    ]);
    expect(projected.internalPaths).toEqual(["/u/acme", "/direct-connect?target=profile-1"]);
  });

  it("sanitizes the compact public-search result without changing its adapter fields", () => {
    const result = projectPublicProfileSearchResult({
      id: "profile-1",
      slug: "acme-plumbing",
      displayName: "Acme Plumbing — call 423.555.0102",
      headline: "dispatch@acme.example · acme.example · 123 Main Street",
      roleContext: "contractor",
    });

    expect(Object.keys(result)).toEqual(["id", "slug", "displayName", "headline", "roleContext"]);
    expect(result.displayName).not.toMatch(DIRECT_CONTACT_PATTERN);
    expect(result.headline).not.toMatch(DIRECT_CONTACT_PATTERN);
    expect(result.id).toBe("profile-1");
    expect(result.slug).toBe("acme-plumbing");
    expect(result.roleContext).toBe("contractor");
  });

  it("keeps text fields string-shaped when their whole value is a contact vector", () => {
    const result = projectPublicProfileSearchResult({
      displayName: "dispatch@acme.example",
      headline: "(423) 555-0102",
      description: "https://acme.example",
      protocolRelativeText: "//acme.example/contact",
      sameSiteText: "https://www.thetradescout.com/u/acme",
      sameSiteHref: "https://www.thetradescout.com/u/acme",
    });

    expect(result.displayName).toBe("Continue through TradeScout");
    expect(result.headline).toBe("Continue through TradeScout");
    expect(result.description).toBe("Continue through TradeScout");
    expect(result.protocolRelativeText).not.toContain("acme.example");
    expect(result.sameSiteText).toBe("Continue through TradeScout");
    expect(result.sameSiteHref).toBe("https://www.thetradescout.com/u/acme");
  });
});
