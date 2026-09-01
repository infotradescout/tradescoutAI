import { SEOHelmet } from "@/components/SEOHelmet";
import { useLocation } from "wouter";
import { JW_STONE_PUBLIC_IDENTITY } from "@shared/jwStonePresentation";
import { getNamedCatalogItemByShareSlug } from "./catalog";
import { parseMarketplacePathname, toPublicMaterialSlug } from "./marketplaceRoutes";

const JW_STONE_SOCIAL_IMAGE_URL =
  "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png";
const JW_STONE_DISCOVERY_DESCRIPTION =
  "Natural stone slabs, granite, marble, quartzite, and engineered quartz from JW Stone Logistics in Pensacola, Florida. Browse named material photos and ask about current pricing or availability.";
const JW_STONE_STRUCTURED_DESCRIPTION =
  "Natural stone slabs, granite, marble, quartzite, and engineered quartz from JW Stone Logistics in Pensacola, Florida. Browse named material photos.";


function titleCaseSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type MarketplaceSeo = {
  title: string;
  description: string;
  structuredDescription: string;
  socialTitle: string;
};

function resolveMarketplaceSeo(location: string): MarketplaceSeo {
  const parsed = parseMarketplacePathname(location);
  if (parsed.stone) {
    const stone = getNamedCatalogItemByShareSlug(parsed.stone);
    const name = stone?.displayName || titleCaseSlug(parsed.stone);
    const material = stone?.materialLabel || "Natural Stone";
    return {
      title: name + " " + material + " Slabs | JW Stone Pensacola",
      description:
        "View " +
        name +
        " " +
        material +
        " slab photos from JW Stone Logistics in Pensacola, Florida. Ask whether it is currently available.",
      structuredDescription:
        "View " +
        name +
        " " +
        material +
        " slab photos from JW Stone Logistics in Pensacola, Florida.",
      socialTitle: name + " " + material + " slabs | JW Stone Logistics",
    };
  }
  if (parsed.material) {
    const publicSlug = toPublicMaterialSlug(parsed.material) || parsed.material;
    const materialName =
      publicSlug === "quartz" || publicSlug === "engineered-quartz"
        ? "Engineered Quartz"
        : titleCaseSlug(publicSlug);
    return {
      title: materialName + " Slabs in Pensacola, FL | JW Stone Logistics",
      description:
        "Browse " +
        materialName +
        " slab photos from JW Stone Logistics in Pensacola, Florida. Compare selections and ask what is currently available.",
      structuredDescription:
        "Browse " +
        materialName +
        " slab photos from JW Stone Logistics in Pensacola, Florida.",
      socialTitle: materialName + " slabs | JW Stone Logistics",
    };
  }
  return {
    title: "Natural Stone Slabs in Pensacola, FL | JW Stone Logistics",
    description: JW_STONE_DISCOVERY_DESCRIPTION,
    structuredDescription: JW_STONE_STRUCTURED_DESCRIPTION,
    socialTitle: "JW Stone Logistics | Natural stone slabs",
  };
}
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
  const marketplaceSeo = resolveMarketplaceSeo(location);
  const businessIdentity = {
    "@type": "LocalBusiness",
    "@id": `${canonicalUrl}#identity`,
    name: JW_STONE_PUBLIC_IDENTITY.brandName,
    description: marketplaceSeo.structuredDescription,
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
      title={marketplaceSeo.title}
      socialTitle={marketplaceSeo.socialTitle}
      description={marketplaceSeo.description}
      canonical={canonicalUrl}
      ogType="profile"
      ogImage={JW_STONE_SOCIAL_IMAGE_URL}
      structuredData={{
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "@id": `${canonicalUrl}#profile-page`,
        name: "JW Stone Logistics",
        description: marketplaceSeo.structuredDescription,
        url: canonicalUrl,
        mainEntity: businessIdentity,
        hasPart: {
          "@type": "CollectionPage",
          name: "JW Stone Material Library",
          url: `${canonicalUrl}#material-library`,
        },
      }}
    />
  );
}
