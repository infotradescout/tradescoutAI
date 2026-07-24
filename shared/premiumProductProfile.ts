export const PREMIUM_PRODUCT_PROFILE_VARIANT = "editorial-product" as const;

export type PremiumProductPresentation = "horizontal-luxury-showcase" | "luxury-material-house";

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

/** Reusable luxury-material-house editorial model (not a catalog/browser). */
export type LuxuryMaterialHouseChapter = {
  slug: string;
  name: string;
  eyebrow: string;
  body: string;
  /** Installed-interior / application image (first). */
  applicationImage: string;
  /** Close material detail (second). */
  detailImage: string;
};

export type LuxuryMaterialHouseCapability = {
  title: string;
  body: string;
};

export type LuxuryMaterialHouseData = {
  designedWithLight: {
    eyebrow: string;
    title: string;
    body: string;
    image: string;
  };
  materialChapters: LuxuryMaterialHouseChapter[];
  capabilities: {
    eyebrow: string;
    title: string;
    body: string;
    items: LuxuryMaterialHouseCapability[];
  };
  showcase: {
    eyebrow: string;
    title: string;
    body: string;
    images: string[];
  };
  consultation: {
    eyebrow: string;
    title: string;
    body: string;
    prompt: string;
    fields: string[];
    note: string;
  };
};

export type PremiumProductProfileData = {
  variant: typeof PREMIUM_PRODUCT_PROFILE_VARIANT;
  presentation?: PremiumProductPresentation;
  /** Selects the product used by the editorial gallery when a catalog has multiple offerings. */
  featuredProductSlug?: string;
  /** Optional reusable collection overview for profiles with multiple distinct offerings. */
  offerings?: {
    eyebrow: string;
    title: string;
    body: string;
    items: PremiumProductOffering[];
  };
  /** Present when presentation === "luxury-material-house". */
  luxuryHouse?: LuxuryMaterialHouseData;
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

function isLuxuryMaterialHouseData(value: unknown): value is LuxuryMaterialHouseData {
  if (!isRecord(value)) return false;
  const designed = value.designedWithLight;
  const chapters = value.materialChapters;
  const capabilities = value.capabilities;
  const showcase = value.showcase;
  const consultation = value.consultation;
  return (
    isRecord(designed) &&
    isString(designed.eyebrow) &&
    isString(designed.title) &&
    isString(designed.body) &&
    isString(designed.image) &&
    Array.isArray(chapters) &&
    chapters.length >= 1 &&
    chapters.every(
      (chapter) =>
        isRecord(chapter) &&
        isString(chapter.slug) &&
        isString(chapter.name) &&
        isString(chapter.eyebrow) &&
        isString(chapter.body) &&
        isString(chapter.applicationImage) &&
        isString(chapter.detailImage)
    ) &&
    isRecord(capabilities) &&
    isString(capabilities.eyebrow) &&
    isString(capabilities.title) &&
    isString(capabilities.body) &&
    Array.isArray(capabilities.items) &&
    capabilities.items.every(
      (item) => isRecord(item) && isString(item.title) && isString(item.body)
    ) &&
    isRecord(showcase) &&
    isString(showcase.eyebrow) &&
    isString(showcase.title) &&
    isString(showcase.body) &&
    Array.isArray(showcase.images) &&
    showcase.images.every(isString) &&
    isRecord(consultation) &&
    isString(consultation.eyebrow) &&
    isString(consultation.title) &&
    isString(consultation.body) &&
    isString(consultation.prompt) &&
    Array.isArray(consultation.fields) &&
    consultation.fields.every(isString) &&
    isString(consultation.note)
  );
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
  const presentation = candidate.presentation;

  const validPresentation =
    presentation === undefined ||
    presentation === "horizontal-luxury-showcase" ||
    presentation === "luxury-material-house";

  const validLuxuryHouse =
    presentation !== "luxury-material-house" || isLuxuryMaterialHouseData(candidate.luxuryHouse);

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
    validPresentation &&
    validLuxuryHouse &&
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
