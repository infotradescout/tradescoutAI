import { sanitizePublicListingText } from "./publicListingSafety";

const CONTRACTOR_PROMO_SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;
const MAX_PROFILE_PROMOS = 6;
const MAX_PROMO_IMAGES = 8;

type ContractorPromoSource = {
  id?: unknown;
  slug?: unknown;
  title?: unknown;
  description?: unknown;
  offerDetails?: unknown;
  discountType?: unknown;
  discountValue?: unknown;
  minimumJobValue?: unknown;
  promoCode?: unknown;
  isActive?: unknown;
  maxUses?: unknown;
  currentUses?: unknown;
  startsAt?: unknown;
  expiresAt?: unknown;
  imageUrl?: unknown;
};

type ContractorPromoProviderSource = {
  id?: unknown;
  companyName?: unknown;
  slug?: unknown;
  photos?: unknown;
  verifiedLicensed?: unknown;
  verifiedInsured?: unknown;
};

export type PublicContractorPromoCard = {
  slug: string;
  title: string;
  description: string;
  offerDetails: string;
  discountLabel: string;
  promoCode: string | null;
  expiresAt: string | null;
  imageUrl: string | null;
  imageSource: "promotion" | "provider" | "none";
  detailPath: string;
};

export type PublicContractorPromoDetail = PublicContractorPromoCard & {
  id: string;
  discountType: string;
  discountValue: string | null;
  minimumJobValue: string | null;
  provider: {
    id: string;
    companyName: string;
    slug: string;
    profilePath: string;
    verifiedLicensed: boolean;
    verifiedInsured: boolean;
  };
  contactAccess: {
    mode: "direct_connect_required";
    ctaLabel: "Continue with Direct Connect";
  };
};

export type ContractorPromoShareMetadata = {
  slug: string;
  title: string;
  description: string;
  canonical: string;
  imageUrl: string | null;
  imageAlt: string;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalDecimal(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(value) : null;
}

function normalizeDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  const candidate = cleanString(value);
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function normalizePublicImageReference(value: unknown): string | null {
  const candidate = cleanString(value);
  if (!candidate || /[\r\n\\]/.test(candidate)) return null;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function normalizeContractorPromoSlug(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const slug = cleanString(raw).toLowerCase();
  return CONTRACTOR_PROMO_SLUG_PATTERN.test(slug) ? slug : null;
}

export function buildContractorPromoPath(value: unknown): string | null {
  const slug = normalizeContractorPromoSlug(value);
  return slug ? `/promo/${encodeURIComponent(slug)}` : null;
}

export function isContractorPromoPubliclyAvailable(
  promo: ContractorPromoSource,
  now = new Date()
): boolean {
  if (!promo || promo.isActive !== true) return false;

  const expiresAt = normalizeDate(promo.expiresAt);
  if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) return false;

  const maxUses = Number(promo.maxUses);
  const currentUses = Number(promo.currentUses || 0);
  if (Number.isFinite(maxUses) && maxUses > 0 && currentUses >= maxUses) return false;

  return true;
}

export function listContractorPromoImageUrls(args: {
  promoImageUrl?: unknown;
  providerPhotos?: unknown;
}): string[] {
  const candidates = [
    args.promoImageUrl,
    ...(Array.isArray(args.providerPhotos) ? args.providerPhotos : []),
  ];
  const images: string[] = [];

  for (const candidate of candidates) {
    const imageUrl = normalizePublicImageReference(candidate);
    if (!imageUrl || images.includes(imageUrl)) continue;
    images.push(imageUrl);
    if (images.length >= MAX_PROMO_IMAGES) break;
  }
  return images;
}

export function formatContractorPromoDiscount(promo: ContractorPromoSource): string {
  const type = cleanString(promo.discountType).toLowerCase();
  const value = Number(promo.discountValue);
  if (type === "percentage" && Number.isFinite(value)) return `${value}% off`;
  if (type === "fixed_amount" && Number.isFinite(value)) return `${formatMoney(value)} off`;
  if (type === "free_service") return "Free service";
  if (type === "bundle_deal") return "Bundle offer";
  return "Special offer";
}

function buildCard(
  promo: ContractorPromoSource,
  providerPhotos: unknown
): PublicContractorPromoCard | null {
  const slug = normalizeContractorPromoSlug(promo.slug);
  const detailPath = buildContractorPromoPath(slug);
  const title = sanitizePublicListingText(promo.title, 100);
  if (!slug || !detailPath || !title || !isContractorPromoPubliclyAvailable(promo)) return null;

  const promoImageUrl = normalizePublicImageReference(promo.imageUrl);
  const imageUrl =
    listContractorPromoImageUrls({
      promoImageUrl,
      providerPhotos,
    })[0] || null;

  return {
    slug,
    title,
    description: sanitizePublicListingText(promo.description, 500),
    offerDetails: sanitizePublicListingText(promo.offerDetails, 800),
    discountLabel: formatContractorPromoDiscount(promo),
    promoCode: sanitizePublicListingText(promo.promoCode, 20) || null,
    expiresAt: normalizeDate(promo.expiresAt),
    imageUrl,
    imageSource: promoImageUrl ? "promotion" : imageUrl ? "provider" : "none",
    detailPath,
  };
}

export function buildPublicContractorPromoCards(args: {
  promos: unknown;
  providerPhotos?: unknown;
}): PublicContractorPromoCard[] {
  if (!Array.isArray(args.promos)) return [];
  const cards: PublicContractorPromoCard[] = [];

  for (const promo of args.promos as ContractorPromoSource[]) {
    if (!promo || typeof promo !== "object") continue;
    const card = buildCard(promo, args.providerPhotos);
    if (!card) continue;
    cards.push(card);
    if (cards.length >= MAX_PROFILE_PROMOS) break;
  }
  return cards;
}

export function buildPublicContractorPromoDetail(args: {
  promo: ContractorPromoSource;
  provider: ContractorPromoProviderSource;
}): PublicContractorPromoDetail | null {
  const card = buildCard(args.promo, args.provider.photos);
  const promoId = cleanString(args.promo.id);
  const providerId = cleanString(args.provider.id);
  const companyName = sanitizePublicListingText(args.provider.companyName, 160);
  const providerSlug = cleanString(args.provider.slug);
  if (!card || !promoId || !providerId || !companyName || !providerSlug) return null;

  return {
    ...card,
    id: promoId,
    discountType: cleanString(args.promo.discountType).slice(0, 40),
    discountValue: normalizeOptionalDecimal(args.promo.discountValue),
    minimumJobValue: normalizeOptionalDecimal(args.promo.minimumJobValue),
    provider: {
      id: providerId,
      companyName,
      slug: providerSlug,
      profilePath: `/contractors/${encodeURIComponent(providerSlug)}`,
      verifiedLicensed: args.provider.verifiedLicensed === true,
      verifiedInsured: args.provider.verifiedInsured === true,
    },
    contactAccess: {
      mode: "direct_connect_required",
      ctaLabel: "Continue with Direct Connect",
    },
  };
}

export function createContractorPromoShareMetadata(args: {
  promo: ContractorPromoSource;
  provider: ContractorPromoProviderSource;
  origin: string;
}): ContractorPromoShareMetadata | null {
  const publicPromo = args.promo as ContractorPromoSource & {
    detailPath?: unknown;
    discountLabel?: unknown;
    imageSource?: unknown;
    provider?: ContractorPromoProviderSource;
  };
  if ("isActive" in publicPromo && !isContractorPromoPubliclyAvailable(publicPromo)) return null;

  const slug = normalizeContractorPromoSlug(publicPromo.slug);
  const detailPath = buildContractorPromoPath(slug);
  const title = sanitizePublicListingText(publicPromo.title, 100);
  const provider = publicPromo.provider || args.provider;
  const providerName = sanitizePublicListingText(provider.companyName, 160);
  if (!slug || !detailPath || !title || !providerName) return null;

  try {
    const protection = "Your contact details stay private until you choose to connect.";
    const description = sanitizePublicListingText(publicPromo.description, 500);
    const offerDetails = sanitizePublicListingText(publicPromo.offerDetails, 800);
    const discountLabel = sanitizePublicListingText(publicPromo.discountLabel, 80);
    const lead = (
      description ||
      offerDetails ||
      `${discountLabel || "Special offer"} from ${providerName}.`
    )
      .slice(0, Math.max(0, 220 - protection.length - 1))
      .trim();
    const imageReference =
      normalizePublicImageReference(publicPromo.imageUrl) ||
      listContractorPromoImageUrls({
        promoImageUrl: publicPromo.imageUrl,
        providerPhotos: provider.photos,
      })[0] ||
      null;
    const imageUrl = imageReference ? new URL(imageReference, args.origin).toString() : null;
    const imageSource =
      cleanString(publicPromo.imageSource) ||
      (normalizePublicImageReference(publicPromo.imageUrl)
        ? "promotion"
        : imageReference
          ? "provider"
          : "none");

    return {
      slug,
      title,
      description: `${lead} ${protection}`.trim(),
      canonical: new URL(detailPath, args.origin).toString(),
      imageUrl,
      imageAlt:
        imageSource === "provider"
          ? `${providerName} project photo for ${title}`
          : `${title} promotion image`,
    };
  } catch {
    return null;
  }
}
