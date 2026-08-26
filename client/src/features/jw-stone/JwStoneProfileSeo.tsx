import { SEOHelmet } from "@/components/SEOHelmet";
import { useLocation } from "wouter";
import { JW_STONE_PUBLIC_IDENTITY } from "@shared/jwStonePresentation";
import { parseMarketplacePathname, toPublicMaterialSlug } from "./marketplaceRoutes";

const JW_STONE_SOCIAL_IMAGE_URL =
  "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png";
const JW_STONE_DISCOVERY_DESCRIPTION =
  "Natural stone slabs, granite, marble, quartzite, and engineered quartz from JW Stone Logistics in Pensacola, Florida. Browse named material photos and ask about current pricing or availability.";

function resolveMarketplaceCanonicalPath(location: string): string | null {
  const pathname = String(location || "/").trim().split(/[?#]/)[0] || "/";
  const parsed = parseMarketplacePathname(pathname);
  if (parsed.stone) return `/stones/${encodeURIComponent(parsed.stone)}`;
  if (parsed.material) {
    const publicSlug = toPublicMaterialSlug(parsed.material) || parsed.material;
    return `/materials/${encodeURIComponent(publicSlug)}`;
  }
  if (
    pathname === "/" ||
    pathname === "/jw-stone" ||
    pathname === "/u/jw-stone" ||
    pathname === "/p/jw-stone"
  ) {
    return "/";
  }
  return null;
}

function resolveCanonical(value: string, location: string): string {
  if (typeof window === "undefined") {
    return value.startsWith("http")
      ? value
      : `https://www.thetradescout.com${value.startsWith("/") ? value : `/${value}`}`;
  }
  try {
    const supplied = new URL(value || "/u/jw-stone", window.location.origin);
    const marketplacePath = resolveMarketplaceCanonicalPath(location);
    return marketplacePath ? new URL(marketplacePath, supplied.origin).toString() : supplied.toString();
  } catch {
    return `${window.location.origin}/u/jw-stone`;
  }
}

export function JwStoneProfileSeo({ canonical }: { canonical: string }) {
  const [location] = useLocation();
  const canonicalUrl = resolveCanonical(canonical, location);
  const businessIdentity = {
    "@type": "LocalBusiness",
    "@id": `${canonicalUrl}#identity`,
    name: JW_STONE_PUBLIC_IDENTITY.brandName,
    description: JW_STONE_DISCOVERY_DESCRIPTION,
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
      title="JW Stone Logistics | Natural stone slabs"
      socialTitle="JW Stone Logistics"
      description={JW_STONE_DISCOVERY_DESCRIPTION}
      canonical={canonicalUrl}
      ogType="profile"
      ogImage={JW_STONE_SOCIAL_IMAGE_URL}
      structuredData={{
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "@id": `${canonicalUrl}#profile-page`,
        name: "JW Stone Logistics",
        description: JW_STONE_DISCOVERY_DESCRIPTION,
        url: canonicalUrl,
        mainEntity: businessIdentity,
        hasPart: {
          "@type": "CollectionPage",
          name: "JW Stone full inventory",
          url: `${canonicalUrl}#material-library`,
        },
      }}
    />
  );
}
