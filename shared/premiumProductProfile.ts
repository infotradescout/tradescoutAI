export const PREMIUM_PRODUCT_PROFILE_VARIANT = "editorial-product" as const;

export type PremiumProductApplication = {
  title: string;
  body: string;
  imageIndex: number;
};

export type PremiumProductProfileData = {
  variant: typeof PREMIUM_PRODUCT_PROFILE_VARIANT;
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
  };
};

export function isPremiumProductProfileData(value: unknown): value is PremiumProductProfileData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<PremiumProductProfileData>;
  return (
    candidate.variant === PREMIUM_PRODUCT_PROFILE_VARIANT &&
    Boolean(candidate.contrast) &&
    Boolean(candidate.gallery) &&
    Boolean(candidate.applications) &&
    Boolean(candidate.brief) &&
    Boolean(candidate.closing)
  );
}
