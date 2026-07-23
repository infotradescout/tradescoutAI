export const PREMIUM_PRODUCT_PROFILE_VARIANT = "editorial-product" as const;

export type PremiumProductApplication = {
  title: string;
  body: string;
  imageIndex: number;
};

export type PremiumProductGalleryPhoto = {
  label: string;
  title: string;
  body?: string;
};

export type PremiumProductOffering = {
  slug: string;
  title: string;
  eyebrow?: string;
  body: string;
  highlights?: string[];
};

export type PremiumProductProfileData = {
  variant: typeof PREMIUM_PRODUCT_PROFILE_VARIANT;
  /** Selects the product used by the editorial gallery when a catalog has multiple offerings. */
  featuredProductSlug?: string;
  /** Optional reusable collection overview for profiles with multiple distinct offerings. */
  offerings?: {
    eyebrow: string;
    title: string;
    body: string;
    items: PremiumProductOffering[];
  };
  contrast: {
    eyebrow: string;
    title: string;
    body: string;
    daylightLabel: string;
    backlitLabel: string;
    daylightImageIndex: number;
    backlitImageIndex: number;
  };
  gallery: {
    eyebrow: string;
    title: string;
    body: string;
    photos?: PremiumProductGalleryPhoto[];
    portraitPhotoIndexes?: number[];
  };
  applications: {
    eyebrow: string;
    title: string;
    body: string;
    items: PremiumProductApplication[];
  };
  brief: {
    eyebrow: string;
    title: string;
    body: string;
    steps: string[];
    note: string;
  };
  closing: {
    eyebrow: string;
    title: string;
    body: string;
    imageIndex: number;
    imageFit?: "contain" | "cover";
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isImageIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function isPremiumProductProfileData(value: unknown): value is PremiumProductProfileData {
  if (!isRecord(value)) return false;
  const candidate = value as Record<string, unknown>;
  const contrast = candidate.contrast;
  const gallery = candidate.gallery;
  const applications = candidate.applications;
  const brief = candidate.brief;
  const closing = candidate.closing;
  const offerings = candidate.offerings;

  const validOfferings =
    offerings === undefined ||
    (isRecord(offerings) &&
      isString(offerings.eyebrow) &&
      isString(offerings.title) &&
      isString(offerings.body) &&
      Array.isArray(offerings.items) &&
      offerings.items.every(
        (item) =>
          isRecord(item) &&
          isString(item.slug) &&
          isString(item.title) &&
          isString(item.body) &&
          (item.eyebrow === undefined || isString(item.eyebrow)) &&
          (item.highlights === undefined ||
            (Array.isArray(item.highlights) && item.highlights.every(isString)))
      ));

  return (
    candidate.variant === PREMIUM_PRODUCT_PROFILE_VARIANT &&
    (candidate.featuredProductSlug === undefined || isString(candidate.featuredProductSlug)) &&
    validOfferings &&
    isRecord(contrast) &&
    isString(contrast.eyebrow) &&
    isString(contrast.title) &&
    isString(contrast.body) &&
    isString(contrast.daylightLabel) &&
    isString(contrast.backlitLabel) &&
    isImageIndex(contrast.daylightImageIndex) &&
    isImageIndex(contrast.backlitImageIndex) &&
    isRecord(gallery) &&
    isString(gallery.eyebrow) &&
    isString(gallery.title) &&
    isString(gallery.body) &&
    (gallery.photos === undefined ||
      (Array.isArray(gallery.photos) &&
        gallery.photos.every(
          (photo) =>
            isRecord(photo) &&
            isString(photo.label) &&
            isString(photo.title) &&
            (photo.body === undefined || isString(photo.body))
        ))) &&
    (gallery.portraitPhotoIndexes === undefined ||
      (Array.isArray(gallery.portraitPhotoIndexes) &&
        gallery.portraitPhotoIndexes.every(isImageIndex))) &&
    isRecord(applications) &&
    isString(applications.eyebrow) &&
    isString(applications.title) &&
    isString(applications.body) &&
    Array.isArray(applications.items) &&
    applications.items.every(
      (item) =>
        isRecord(item) &&
        isString(item.title) &&
        isString(item.body) &&
        isImageIndex(item.imageIndex)
    ) &&
    isRecord(brief) &&
    isString(brief.eyebrow) &&
    isString(brief.title) &&
    isString(brief.body) &&
    Array.isArray(brief.steps) &&
    brief.steps.every(isString) &&
    isString(brief.note) &&
    isRecord(closing) &&
    isString(closing.eyebrow) &&
    isString(closing.title) &&
    isString(closing.body) &&
    isImageIndex(closing.imageIndex) &&
    (closing.imageFit === undefined ||
      closing.imageFit === "contain" ||
      closing.imageFit === "cover")
  );
}
