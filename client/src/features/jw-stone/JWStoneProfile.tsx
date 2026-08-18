import { SEOHelmet } from "@/components/SEOHelmet";
import {
  JW_STONE_PROFILE_SLUG,
  JW_STONE_PUBLIC_IDENTITY,
} from "@shared/jwStonePresentation";
import JWStoneProfileExperience from "./JWStoneMarketplace";
import { getNamedCatalogItemByShareSlug } from "./catalog";
import {
  isJwStoneProfileDomainSurface,
  parseMarketplacePathname,
  toPublicMaterialSlug,
} from "./marketplaceRoutes";

const PLATFORM_PROFILE_URL = `https://www.thetradescout.com/u/${JW_STONE_PROFILE_SLUG}`;
const PROFILE_SHARE_IMAGE =
  "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png";

function routeState() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : `/u/${JW_STONE_PROFILE_SLUG}`;
  return parseMarketplacePathname(pathname);
}

function profileRootUrl(): string {
  if (typeof window !== "undefined" && isJwStoneProfileDomainSurface()) {
    return `${window.location.origin}/`;
  }
  return PLATFORM_PROFILE_URL;
}

function canonicalProfileUrl(): string {
  const state = routeState();
  const root = profileRootUrl().replace(/\/+$/, "");

  if (state.stone) {
    return `${root}/stones/${encodeURIComponent(state.stone)}`;
  }
  if (state.material) {
    const publicMaterial = toPublicMaterialSlug(state.material) || state.material;
    return `${root}/materials/${encodeURIComponent(publicMaterial)}`;
  }
  return `${root}/`;
}

function absoluteAssetUrl(asset: string): string {
  const origin =
    typeof window !== "undefined" && isJwStoneProfileDomainSurface()
      ? window.location.origin
      : "https://www.thetradescout.com";
  try {
    return new URL(asset, `${origin}/`).toString();
  } catch {
    return asset;
  }
}

/**
 * JW Stone 2.0 is a branded TradeScout profile, not the legacy wholesaler
 * presentation and not a separate marketplace product. The existing visual
 * experience stays intact while this wrapper owns profile routing and SEO.
 */
export default function JWStoneProfile() {
  const state = routeState();
  const selectedStone = state.stone ? getNamedCatalogItemByShareSlug(state.stone) : null;
  const canonical = canonicalProfileUrl();
  const rootUrl = profileRootUrl();
  const title = selectedStone?.displayName
    ? `${selectedStone.displayName} | JW Stone Logistics`
    : "JW Stone Logistics | Natural Stone Profile";
  const description = selectedStone?.displayName
    ? `View ${selectedStone.displayName} photos from JW Stone Logistics, save the selection, or connect directly about current availability and project needs.`
    : "Explore JW Stone Logistics, browse current natural stone selections, save materials, view the original founder story, and connect directly from the JW Stone TradeScout profile.";
  const image = selectedStone?.images?.[0]
    ? absoluteAssetUrl(selectedStone.images[0])
    : PROFILE_SHARE_IMAGE;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": canonical,
    name: title,
    description,
    url: canonical,
    image,
    mainEntity: {
      "@type": "LocalBusiness",
      "@id": `${rootUrl}#business`,
      name: JW_STONE_PUBLIC_IDENTITY.brandName,
      description: JW_STONE_PUBLIC_IDENTITY.about,
      foundingDate: JW_STONE_PUBLIC_IDENTITY.foundingDate,
      url: rootUrl,
      image: PROFILE_SHARE_IMAGE,
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
    },
    isPartOf: {
      "@type": "WebSite",
      name: "TradeScout",
      url: "https://www.thetradescout.com/",
    },
  };

  return (
    <>
      <JWStoneProfileExperience />
      <SEOHelmet
        title={title}
        socialTitle={title}
        description={description}
        canonical={canonical}
        ogType="profile"
        ogImage={image}
        structuredData={structuredData}
      />
    </>
  );
}
