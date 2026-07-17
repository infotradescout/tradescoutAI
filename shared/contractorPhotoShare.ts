import {
  buildProfileGalleryShareSearch,
  listProfileGalleryItems,
  normalizeProfileGalleryItemSlug,
  type ResolvedProfileGalleryItem,
} from "./profileGalleryShare";

const MAX_SHARE_DESCRIPTION_LENGTH = 160;

export type ContractorProjectPhoto = ResolvedProfileGalleryItem;

export type ContractorPhotoShareMetadata = {
  itemType: "contractor-photo";
  itemTitle: string;
  itemSlug: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  canonical: string;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function capForShare(value: string, limit: number): string {
  if (value.length <= limit) return value;
  if (limit <= 1) return "";
  return `${value.slice(0, limit - 1).trimEnd()}…`;
}

function contractorPhotoBlocks(photos: unknown): unknown[] {
  if (!Array.isArray(photos)) return [];

  return [
    {
      id: "contractor-project-photos",
      type: "gallery",
      title: "Project photos",
      body: "Examples of work shared by this local provider.",
      data: {
        images: photos.map((photo) => ({
          imageUrl: photo,
          // A common title keeps the URL fingerprint tied to the image itself,
          // so reordering the portfolio does not invalidate an existing share.
          title: "Project photo",
          alt: "Local provider project photo",
        })),
      },
    },
  ];
}

export function listContractorProjectPhotos(photos: unknown): ContractorProjectPhoto[] {
  return listProfileGalleryItems(contractorPhotoBlocks(photos)).map((item, index) => ({
    ...item,
    title: `Project photo ${index + 1}`,
    imageAlt: `Project photo ${index + 1} from this local provider`,
  }));
}

export function resolveContractorProjectPhoto(
  photos: unknown,
  itemSlugValue: unknown
): ContractorProjectPhoto | null {
  const requestedSlug = normalizeProfileGalleryItemSlug(itemSlugValue);
  if (!requestedSlug) return null;
  return listContractorProjectPhotos(photos).find((item) => item.slug === requestedSlug) || null;
}

export function buildContractorPhotoShareSearch(itemSlug: string): string {
  return buildProfileGalleryShareSearch(itemSlug);
}

export function createContractorPhotoShareMetadata(args: {
  contractorName: string;
  contractorUrl: string;
  assetOrigin: string;
  photos: unknown;
  itemSlug: unknown;
}): ContractorPhotoShareMetadata | null {
  const contractorName = cleanString(args.contractorName);
  const item = resolveContractorProjectPhoto(args.photos, args.itemSlug);
  if (!contractorName || !item) return null;

  try {
    const imageUrl = new URL(item.imageUrl, args.assetOrigin).toString();
    const canonicalUrl = new URL(args.contractorUrl);
    canonicalUrl.search = buildContractorPhotoShareSearch(item.slug);
    canonicalUrl.hash = "";

    const protection = "Contact stays protected through TradeScout Direct Connect.";
    const lead = capForShare(
      `View ${item.title} from ${contractorName}.`,
      MAX_SHARE_DESCRIPTION_LENGTH - protection.length - 1
    );
    const description = `${lead} ${protection}`;

    return {
      itemType: "contractor-photo",
      itemTitle: item.title,
      itemSlug: item.slug,
      title: `${item.title} by ${contractorName}`,
      description,
      imageUrl,
      imageAlt: item.imageAlt,
      canonical: canonicalUrl.toString(),
    };
  } catch {
    return null;
  }
}
