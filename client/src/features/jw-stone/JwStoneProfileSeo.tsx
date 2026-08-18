import { SEOHelmet } from "@/components/SEOHelmet";
import { JW_STONE_PUBLIC_IDENTITY } from "@shared/jwStonePresentation";

const JW_STONE_SOCIAL_IMAGE_URL =
  "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png";

function resolveCanonical(value: string): string {
  if (typeof window === "undefined") {
    return value.startsWith("http")
      ? value
      : `https://www.thetradescout.com${value.startsWith("/") ? value : `/${value}`}`;
  }
  try {
    return new URL(value || "/u/jw-stone", window.location.origin).toString();
  } catch {
    return `${window.location.origin}/u/jw-stone`;
  }
}

export function JwStoneProfileSeo({ canonical }: { canonical: string }) {
  const canonicalUrl = resolveCanonical(canonical);
  const businessIdentity = {
    "@type": "LocalBusiness",
    "@id": `${canonicalUrl}#identity`,
    name: JW_STONE_PUBLIC_IDENTITY.brandName,
    description: JW_STONE_PUBLIC_IDENTITY.about,
    foundingDate: JW_STONE_PUBLIC_IDENTITY.foundingDate,
    url: canonicalUrl,
    hasMap: JW_STONE_PUBLIC_IDENTITY.address.mapUrl,
    address: {
      "@type": "PostalAddress",
      streetAddress: JW_STONE_PUBLIC_IDENTITY.address.streetAddress,
      addressLocality: JW_STONE_PUBLIC_IDENTITY.address.addressLocality,
      addressRegion: JW_STONE_PUBLIC_IDENTITY.address.addressRegion,
      postalCode: JW_STONE_PUBLIC_IDENTITY.address.postalCode,
      addressCountry: JW_STONE_PUBLIC_IDENTITY.address.addressCountry,
    },
    sameAs: JW_STONE_PUBLIC_IDENTITY.socials.map((social) => social.href),
  };

  return (
    <SEOHelmet
      title="JW Stone Logistics"
      socialTitle="JW Stone Logistics"
      description={JW_STONE_PUBLIC_IDENTITY.about}
      canonical={canonicalUrl}
      ogType="profile"
      ogImage={JW_STONE_SOCIAL_IMAGE_URL}
      structuredData={{
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "@id": `${canonicalUrl}#profile-page`,
        name: "JW Stone Logistics",
        description: JW_STONE_PUBLIC_IDENTITY.about,
        url: canonicalUrl,
        mainEntity: businessIdentity,
        hasPart: {
          "@type": "CollectionPage",
          name: "JW Stone current inventory",
          url: `${canonicalUrl}#current-inventory`,
        },
      }}
    />
  );
}
