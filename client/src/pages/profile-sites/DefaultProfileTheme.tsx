import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Instagram, MapPin, MessageCircle, Play } from "lucide-react";
import { SafeProfileImg } from "@/pages/profile-sites/safeProfileImage";

type BrandColors = {
  primary?: string;
  primaryDark?: string;
  accent?: string;
  secondary?: string;
  background?: string;
  surface?: string;
};

type GalleryItem = {
  slug: string;
  title: string;
  description?: string;
  imageUrl: string;
  imageAlt: string;
};

type Recommendation = {
  id: string;
  recommendationType: "positive" | "negative";
  comment: string;
  projectType: string | null;
  customerName: string;
  subjectName?: string;
  subjectHref?: string;
};

type SocialLink = {
  label: string;
  handle?: string;
  href: string;
  kind?: "instagram" | "tiktok" | "other";
};

type DefaultProfileThemeProps = {
  businessName: string;
  operatorName?: string;
  presentationVariant?: "classic" | "first-deliverable";
  profileKind?: "business" | "community";
  categoryLabel?: string;
  locationLabel?: string;
  headline?: string;
  heroTitle?: string;
  heroText?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  heroImageAlt?: string;
  featuredWorkUrl?: string;
  brandColors?: BrandColors;
  services: string[];
  serviceAreas: string[];
  aboutText?: string;
  galleryItems: GalleryItem[];
  sharedGallerySlug?: string | null;
  socials?: SocialLink[];
  customBlocks?: Array<{ title: string; body: string }>;
  badges?: string[];
  stats?: Array<{ label: string; value: string }>;
  recommendations?: Recommendation[];
  recommendationMode?: "received" | "authored";
  showAbout?: boolean;
  showBadges?: boolean;
  showStats?: boolean;
  showServices?: boolean;
  showServiceAreas?: boolean;
  showRecommendations?: boolean;
  showContact?: boolean;
  deliveryCustody?: "business" | "tradescout_pending_owner";
  onDirectConnect: (serviceName?: string) => void;
  shareAction?: ReactNode;
  renderGalleryShare?: (item: GalleryItem) => ReactNode;
  bookingSection?: ReactNode;
  profileItems?: ReactNode;
  trustActions: ReactNode;
  lightTrustActions?: ReactNode;
  tradeScoutHandoff: ReactNode;
};

const FALLBACK_COLORS = {
  primary: "#f97316",
  primaryDark: "#c2410c",
  accent: "#fb923c",
  secondary: "#a3a3a3",
  background: "#07090b",
  surface: "#111418",
};

function safeHex(value: string | undefined, fallback: string): string {
  const normalized = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

function hexRgb(value: string): [number, number, number] {
  const hex = value.slice(1);
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function rgba(value: string, alpha: number): string {
  const [red, green, blue] = hexRgb(value);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function relativeLuminance(color: string): number {
  const [red, green, blue] = hexRgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function readableText(background: string): string {
  const light = "#ffffff";
  const dark = "#111418";
  return contrastRatio(light, background) >= contrastRatio(dark, background) ? light : dark;
}

function readableAccent(accent: string, background: string, fallback: string): string {
  return contrastRatio(accent, background) >= 4.5 ? accent : fallback;
}

function businessInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function samePublicCopy(first: string | undefined, second: string | undefined): boolean {
  const normalize = (value: string | undefined) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const normalizedFirst = normalize(first);
  return normalizedFirst.length > 0 && normalizedFirst === normalize(second);
}

function safePublicUrl(value: string | undefined, allowRelative = false): string | undefined {
  const candidate = String(value || "").trim();
  if (!candidate || /[\r\n\\]/.test(candidate)) return undefined;
  if (allowRelative && candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export default function DefaultProfileTheme({
  businessName,
  operatorName,
  presentationVariant = "classic",
  profileKind = "business",
  categoryLabel,
  locationLabel,
  headline,
  heroTitle,
  heroText,
  logoUrl,
  heroImageUrl,
  heroImageAlt,
  featuredWorkUrl,
  brandColors,
  services,
  serviceAreas,
  aboutText,
  galleryItems,
  sharedGallerySlug,
  socials = [],
  customBlocks = [],
  badges = [],
  stats = [],
  recommendations = [],
  recommendationMode = "received",
  showAbout = true,
  showBadges = true,
  showStats = true,
  showServices = true,
  showServiceAreas = true,
  showRecommendations = true,
  showContact = true,
  onDirectConnect,
  shareAction,
  renderGalleryShare,
  bookingSection,
  profileItems,
  trustActions,
  lightTrustActions,
  tradeScoutHandoff,
}: DefaultProfileThemeProps) {
  const primary = safeHex(brandColors?.primary, FALLBACK_COLORS.primary);
  const colors = {
    primary,
    primaryDark: safeHex(brandColors?.primaryDark, FALLBACK_COLORS.primaryDark),
    accent: safeHex(brandColors?.accent, primary),
    secondary: safeHex(brandColors?.secondary, FALLBACK_COLORS.secondary),
    background: safeHex(brandColors?.background, FALLBACK_COLORS.background),
    surface: safeHex(brandColors?.surface, FALLBACK_COLORS.surface),
  };
  const foreground = readableText(colors.background);
  const surfaceForeground = readableText(colors.surface);
  const accentOnBackground = readableAccent(colors.primary, colors.background, foreground);
  const accentOnSurface = readableAccent(colors.primary, colors.surface, surfaceForeground);
  const variables = {
    "--profile-primary": colors.primary,
    "--profile-primary-dark": colors.primaryDark,
    "--profile-accent": colors.accent,
    "--profile-secondary": colors.secondary,
    "--profile-bg": colors.background,
    "--profile-surface": colors.surface,
    "--profile-fg": foreground,
    "--profile-surface-fg": surfaceForeground,
    "--profile-muted": rgba(foreground === "#ffffff" ? "#ffffff" : "#111418", 0.7),
    "--profile-line": rgba(foreground === "#ffffff" ? "#ffffff" : "#111418", 0.13),
    "--profile-primary-soft": rgba(colors.primary, 0.16),
    "--profile-accent-on-bg": accentOnBackground,
    "--profile-accent-on-surface": accentOnSurface,
  } as CSSProperties;

  const title = heroTitle || headline || businessName;
  const supportingText = heroText || (heroTitle ? headline : "") || "";
  const safeLogoUrl = safePublicUrl(logoUrl, true);
  const safeHeroImageUrl = safePublicUrl(heroImageUrl, true);
  const safeFeaturedWorkUrl = safePublicUrl(featuredWorkUrl);
  const safeSocials = socials
    .map((social) => ({ ...social, href: safePublicUrl(social.href) }))
    .filter((social): social is SocialLink => Boolean(social.href));
  const safeGallery = galleryItems.filter((item) => safePublicUrl(item.imageUrl, true));
  const remainingGallery = safeGallery.filter(
    (item) => safePublicUrl(item.imageUrl, true) !== safeHeroImageUrl
  );
  const firstDeliverable = presentationVariant === "first-deliverable";
  const visibleGallery = firstDeliverable
    ? remainingGallery
    : remainingGallery.length > 0
      ? remainingGallery
      : safeGallery.length > 1
        ? safeGallery
        : [];
  const instagram = safeSocials.find((social) => social.kind === "instagram");
  const [logoFailed, setLogoFailed] = useState(false);
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  useEffect(() => setLogoFailed(false), [safeLogoUrl]);
  useEffect(() => setHeroImageFailed(false), [safeHeroImageUrl]);
  const showLogo = Boolean(safeLogoUrl) && !logoFailed;
  const showHeroImage = Boolean(safeHeroImageUrl) && !heroImageFailed;
  const heroForeground = showHeroImage ? "#ffffff" : foreground;
  const heroMuted = rgba(heroForeground === "#ffffff" ? "#ffffff" : "#111418", 0.7);
  const themeVariables = {
    ...variables,
    "--profile-hero-fg": heroForeground,
    "--profile-hero-muted": heroMuted,
  } as CSSProperties;
  const visibleRecommendations = recommendations.filter((recommendation) =>
    recommendationMode === "received"
      ? recommendation.recommendationType === "positive"
      : Boolean(recommendation.subjectName)
  );
  const resolvedTrustActions =
    foreground === "#ffffff" ? trustActions : lightTrustActions || trustActions;

  return (
    <main
      className="overflow-hidden bg-[var(--profile-bg)] text-[var(--profile-fg)]"
      style={firstDeliverable ? themeVariables : variables}
      data-testid="default-profile-theme"
    >
      {firstDeliverable ? (
        <>
          <header
            className="relative z-30 border-b border-[var(--profile-line)] bg-[var(--profile-bg)]/95 backdrop-blur-xl"
            data-testid="default-profile-header"
          >
            <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center gap-3 px-3 py-2.5 sm:min-h-24 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                {showLogo && safeLogoUrl ? (
                  <SafeProfileImg
                    src={safeLogoUrl}
                    alt={`${businessName} logo`}
                    className="h-12 w-12 shrink-0 rounded-full border border-[var(--profile-line)] object-cover shadow-lg shadow-black/25 sm:h-16 sm:w-16"
                    onExhausted={() => setLogoFailed(true)}
                  />
                ) : (
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-xs font-black shadow-lg shadow-black/20 sm:h-16 sm:w-16 sm:text-sm"
                    style={{
                      color: readableText(colors.primary),
                      background: colors.primary,
                    }}
                    aria-hidden
                  >
                    {businessInitials(businessName)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-black leading-tight tracking-[-0.02em] sm:text-lg">
                    {businessName}
                  </p>
                  {operatorName || locationLabel ? (
                    <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--profile-muted)] sm:text-sm">
                      {operatorName ? <span className="truncate">{operatorName}</span> : null}
                      {operatorName && locationLabel ? <span aria-hidden>·</span> : null}
                      {locationLabel ? (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                          <span className="truncate">{locationLabel}</span>
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <div className="hidden sm:block">{shareAction}</div>
                {showContact ? (
                  <button
                    type="button"
                    onClick={() => onDirectConnect()}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ts-orange px-4 text-sm font-black text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-ts-orange-dark sm:min-h-12 sm:px-5"
                  >
                    <span className="sm:hidden">Connect</span>
                    <span className="hidden sm:inline">Direct Connect</span>
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
            </div>
          </header>

          <section
            className="relative isolate overflow-hidden bg-[var(--profile-bg)]"
            data-testid="default-profile-hero"
          >
            <div
              className="relative mx-auto flex min-h-[540px] w-full max-w-[1600px] items-end overflow-hidden bg-[var(--profile-surface)] sm:min-h-[620px] lg:min-h-[720px]"
              style={
                showHeroImage
                  ? undefined
                  : {
                      background: `radial-gradient(circle at 82% 18%, ${rgba(
                        colors.primary,
                        0.36
                      )}, transparent 34%), linear-gradient(145deg, ${colors.surface}, ${
                        colors.background
                      })`,
                    }
              }
            >
              {showHeroImage && safeHeroImageUrl ? (
                <SafeProfileImg
                  src={safeHeroImageUrl}
                  alt={heroImageAlt || `${businessName} featured image`}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                  loading="eager"
                  onExhausted={() => setHeroImageFailed(true)}
                />
              ) : (
                <div
                  className="absolute inset-0 grid place-items-center"
                  data-testid="default-profile-brand-hero"
                >
                  {showLogo && safeLogoUrl ? (
                    <SafeProfileImg
                      src={safeLogoUrl}
                      alt=""
                      className="h-32 w-32 rounded-full border border-[var(--profile-line)] object-cover opacity-35 shadow-2xl shadow-black/25 sm:h-44 sm:w-44"
                      onExhausted={() => setLogoFailed(true)}
                    />
                  ) : (
                    <span
                      className="grid h-32 w-32 place-items-center rounded-full text-3xl font-black shadow-2xl shadow-black/25 sm:h-40 sm:w-40"
                      style={{
                        color: readableText(colors.primary),
                        background: colors.primary,
                      }}
                      aria-hidden
                    >
                      {businessInitials(businessName)}
                    </span>
                  )}
                </div>
              )}

              {showHeroImage ? (
                <>
                  <div
                    className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/35 to-transparent"
                    aria-hidden
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-black via-black/55 to-transparent"
                    aria-hidden
                  />
                  <div
                    className="absolute inset-y-0 left-0 hidden w-2/3 bg-gradient-to-r from-black/45 to-transparent lg:block"
                    aria-hidden
                  />
                </>
              ) : null}

              <div
                className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-8 pt-24 text-white sm:px-6 sm:pb-12 lg:px-8 lg:pb-16"
                data-testid="default-profile-hero-identity"
              >
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/70 sm:text-xs">
                  {categoryLabel ? <span>{categoryLabel}</span> : null}
                  {categoryLabel && locationLabel ? (
                    <span
                      className="h-1 w-1 rounded-full bg-[var(--profile-primary)]"
                      aria-hidden
                    />
                  ) : null}
                  {locationLabel ? <span>{locationLabel}</span> : null}
                </div>
                <h1 className="mt-4 max-w-4xl text-[2.75rem] font-black leading-[0.94] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                  {title}
                </h1>
                {supportingText &&
                !samePublicCopy(supportingText, title) &&
                !samePublicCopy(supportingText, categoryLabel) ? (
                  <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-white/70 lg:text-lg">
                    {supportingText}
                  </p>
                ) : null}

                <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                  {showContact ? (
                    <button
                      type="button"
                      onClick={() => onDirectConnect()}
                      className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-ts-orange px-7 text-base font-black text-white shadow-xl shadow-black/25 transition hover:-translate-y-0.5 hover:bg-ts-orange-dark"
                    >
                      <MessageCircle className="h-5 w-5" aria-hidden />
                      Direct Connect
                    </button>
                  ) : null}
                  {safeFeaturedWorkUrl ? (
                    <a
                      href={safeFeaturedWorkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-white/30 bg-black/35 px-7 text-base font-black text-white backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/60 hover:bg-black/55"
                      data-testid="default-profile-work-link"
                    >
                      <Play className="h-4 w-4 fill-current" aria-hidden />
                      Watch reel
                    </a>
                  ) : null}
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                  {services.length > 0 ? (
                    <a
                      href="#profile-services"
                      className="inline-flex items-center gap-2 text-sm font-black text-white/80 transition hover:text-white"
                    >
                      View services
                      <ArrowRight className="h-4 w-4 rotate-90" aria-hidden />
                    </a>
                  ) : null}
                  {safeSocials.length > 0
                    ? safeSocials.map((social) => (
                        <a
                          key={`${social.label}-${social.href}`}
                          href={social.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-bold text-white/65 transition hover:text-white"
                        >
                          {social.kind === "instagram" ? (
                            <Instagram className="h-4 w-4" aria-hidden />
                          ) : (
                            <ArrowUpRight className="h-4 w-4" aria-hidden />
                          )}
                          {social.handle || social.label}
                        </a>
                      ))
                    : null}
                </div>
                {shareAction ? <div className="mt-5 sm:hidden">{shareAction}</div> : null}
              </div>
            </div>
            <div
              className="h-1 w-full"
              style={{
                background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent}, ${colors.primaryDark})`,
              }}
              aria-hidden
            />
          </section>
        </>
      ) : (
        <>
          <header className="relative z-20 border-b border-[var(--profile-line)]">
            <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                {showLogo && safeLogoUrl ? (
                  <SafeProfileImg
                    src={safeLogoUrl}
                    alt={`${businessName} logo`}
                    className="h-11 w-11 shrink-0 rounded-full border border-[var(--profile-line)] object-cover"
                    onExhausted={() => setLogoFailed(true)}
                  />
                ) : (
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-black"
                    style={{
                      color: readableText(colors.primary),
                      background: colors.primary,
                    }}
                    aria-hidden
                  >
                    {businessInitials(businessName)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-black tracking-[-0.02em] sm:text-base">
                    {businessName}
                  </p>
                  {operatorName || locationLabel ? (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--profile-muted)]">
                      {operatorName ? <span className="truncate">{operatorName}</span> : null}
                      {operatorName && locationLabel ? <span aria-hidden>·</span> : null}
                      {locationLabel ? (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                          <span className="truncate">{locationLabel}</span>
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {shareAction}
                {showContact ? (
                  <button
                    type="button"
                    onClick={() => onDirectConnect()}
                    className="hidden items-center gap-2 rounded-full bg-ts-orange px-5 py-3 text-sm font-black text-white shadow-lg shadow-black/20 transition hover:bg-ts-orange-dark sm:inline-flex"
                  >
                    Direct Connect
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
            </div>
          </header>

          <section className="relative">
            <div
              className="pointer-events-none absolute inset-0 opacity-80"
              style={{
                background: `radial-gradient(circle at 15% 15%, ${rgba(
                  colors.primary,
                  0.19
                )}, transparent 34%), radial-gradient(circle at 78% 78%, ${rgba(
                  colors.secondary,
                  0.13
                )}, transparent 38%)`,
              }}
              aria-hidden
            />
            <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:min-h-[720px] lg:grid-cols-[minmax(0,0.9fr)_minmax(460px,1.1fr)] lg:items-center lg:gap-14 lg:px-8 lg:py-16">
              <div className="flex flex-col items-start">
                <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--profile-muted)]">
                  {categoryLabel ? <span>{categoryLabel}</span> : null}
                  {categoryLabel && locationLabel ? (
                    <span
                      className="h-1 w-1 rounded-full bg-[var(--profile-primary)]"
                      aria-hidden
                    />
                  ) : null}
                  {locationLabel ? <span>{locationLabel}</span> : null}
                </div>
                <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[0.94] tracking-[-0.055em] sm:text-6xl lg:text-[5.35rem]">
                  {title}
                </h1>
                {supportingText ? (
                  <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--profile-muted)] sm:text-lg">
                    {supportingText}
                  </p>
                ) : null}
                <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                  {showContact ? (
                    <button
                      type="button"
                      onClick={() => onDirectConnect()}
                      className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-ts-orange px-7 text-base font-black text-white shadow-xl shadow-black/25 transition hover:-translate-y-0.5 hover:bg-ts-orange-dark"
                    >
                      <MessageCircle className="h-5 w-5" aria-hidden />
                      Direct Connect
                    </button>
                  ) : null}
                  {safeFeaturedWorkUrl ? (
                    <a
                      href={safeFeaturedWorkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-[var(--profile-line)] bg-[var(--profile-primary-soft)] px-7 text-base font-bold transition hover:border-[var(--profile-primary)]"
                    >
                      <Play className="h-4 w-4 fill-current" aria-hidden />
                      View
                    </a>
                  ) : null}
                </div>
                {safeSocials.length > 0 ? (
                  <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                    {safeSocials.map((social) => (
                      <a
                        key={`${social.label}-${social.href}`}
                        href={social.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-bold text-[var(--profile-muted)] transition hover:text-[var(--profile-fg)]"
                      >
                        {social.kind === "instagram" ? (
                          <Instagram className="h-4 w-4" aria-hidden />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" aria-hidden />
                        )}
                        {social.handle || social.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="relative min-h-[290px] sm:min-h-[440px] lg:min-h-[620px]">
                {showHeroImage && safeHeroImageUrl ? (
                  <div className="absolute inset-0 overflow-hidden rounded-[2rem] border border-[var(--profile-line)] bg-[var(--profile-surface)] shadow-2xl shadow-black/35 sm:rounded-[2.5rem]">
                    <SafeProfileImg
                      src={safeHeroImageUrl}
                      alt={heroImageAlt || `${businessName} featured image`}
                      className="h-full w-full object-cover"
                      loading="eager"
                      onExhausted={() => setHeroImageFailed(true)}
                    />
                    <div
                      className="absolute inset-x-0 bottom-0 h-1/3"
                      style={{
                        background: "linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0))",
                      }}
                      aria-hidden
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white sm:p-7">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">
                          Featured
                        </p>
                        <p className="mt-1 text-lg font-black">{businessName}</p>
                      </div>
                      {safeFeaturedWorkUrl ? (
                        <a
                          href={safeFeaturedWorkUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="View featured item"
                          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-black transition hover:scale-105"
                        >
                          <Play className="h-5 w-5 fill-current" aria-hidden />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div
                    className="absolute inset-0 grid place-items-center overflow-hidden rounded-[2rem] border border-[var(--profile-line)] bg-[var(--profile-surface)] p-8 shadow-2xl shadow-black/25 sm:rounded-[2.5rem]"
                    style={{
                      background: `linear-gradient(145deg, ${colors.surface}, ${colors.background})`,
                    }}
                    data-testid="default-profile-brand-hero"
                  >
                    <div
                      className="absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl"
                      style={{ background: rgba(colors.primary, 0.32) }}
                      aria-hidden
                    />
                    <div className="relative flex max-w-md flex-col items-center text-center">
                      {showLogo && safeLogoUrl ? (
                        <SafeProfileImg
                          src={safeLogoUrl}
                          alt={`${businessName} logo`}
                          className="h-28 w-28 rounded-full border border-[var(--profile-line)] object-cover shadow-2xl"
                          onExhausted={() => setLogoFailed(true)}
                        />
                      ) : (
                        <span
                          className="grid h-28 w-28 place-items-center rounded-full text-3xl font-black"
                          style={{
                            color: readableText(colors.primary),
                            background: colors.primary,
                          }}
                        >
                          {businessInitials(businessName)}
                        </span>
                      )}
                      <p className="mt-7 text-3xl font-black tracking-[-0.04em] text-[var(--profile-surface-fg)]">
                        {businessName}
                      </p>
                      {categoryLabel ? (
                        <p className="mt-2 text-sm text-[var(--profile-surface-fg)] opacity-65">
                          {categoryLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {showServices && services.length > 0 ? (
        <section
          id="profile-services"
          className="scroll-mt-24 border-y border-[var(--profile-line)] bg-[var(--profile-surface)] text-[var(--profile-surface-fg)]"
        >
          <div
            className={`mx-auto w-full px-4 sm:px-6 lg:px-8 ${
              firstDeliverable ? "max-w-6xl py-12 sm:py-16" : "max-w-7xl py-16 sm:py-20"
            }`}
          >
            <div
              className={`grid gap-8 ${
                firstDeliverable
                  ? "lg:grid-cols-[0.72fr_1.28fr] lg:gap-14"
                  : "lg:grid-cols-[0.65fr_1.35fr] lg:gap-16"
              }`}
            >
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--profile-accent-on-surface)]">
                  Services
                </p>
                <h2 className="mt-4 text-4xl font-black leading-tight tracking-[-0.045em] sm:text-5xl">
                  {firstDeliverable
                    ? categoryLabel
                      ? `${categoryLabel} for the work in front of you.`
                      : "Services for the work in front of you."
                    : "Choose what you need."}
                </h2>
                {firstDeliverable && !showContact ? (
                  <p className="mt-4 max-w-md text-sm leading-relaxed opacity-65 sm:text-base">
                    Services available from {businessName}.
                  </p>
                ) : null}
              </div>
              {firstDeliverable ? (
                <div className="grid border-b border-[var(--profile-line)] md:grid-cols-2 md:gap-x-8">
                  {services.slice(0, 12).map((service, index) => {
                    const content = (
                      <>
                        <span className="text-[10px] font-black tracking-[0.18em] text-[var(--profile-accent-on-surface)]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1 text-lg font-black leading-snug text-[var(--profile-surface-fg)]">
                          {service}
                        </span>
                        {showContact ? (
                          <ArrowRight
                            className="h-5 w-5 shrink-0 text-[var(--profile-accent-on-surface)] opacity-55 transition group-hover:translate-x-1 group-hover:opacity-100"
                            aria-hidden
                          />
                        ) : null}
                      </>
                    );
                    const fillsOddDesktopRow =
                      services.length % 2 === 1 && index === services.length - 1;
                    const className = `group flex min-h-24 items-center gap-4 border-t border-[var(--profile-line)] py-5 text-left md:min-h-28 ${
                      fillsOddDesktopRow ? "md:col-span-2" : ""
                    }`;

                    return showContact ? (
                      <button
                        key={service}
                        type="button"
                        onClick={() => onDirectConnect(service)}
                        className={`${className} px-1 transition hover:bg-[var(--profile-primary-soft)] sm:px-3`}
                        data-testid={`default-profile-service-${index}`}
                      >
                        {content}
                      </button>
                    ) : (
                      <article
                        key={service}
                        className={className}
                        data-testid={`default-profile-service-${index}`}
                      >
                        {content}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="grid gap-px overflow-hidden rounded-3xl border border-[var(--profile-line)] bg-[var(--profile-line)] sm:grid-cols-2">
                  {services.slice(0, 12).map((service, index) => (
                    <button
                      key={service}
                      type="button"
                      onClick={() => onDirectConnect(service)}
                      className="group flex min-h-32 items-start gap-4 bg-[var(--profile-surface)] p-5 text-left transition hover:bg-[var(--profile-primary-soft)] sm:min-h-40 sm:p-6"
                      data-testid={`default-profile-service-${index}`}
                    >
                      <span className="mt-0.5 text-xs font-black text-[var(--profile-accent-on-surface)]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="flex min-w-0 flex-1 items-start justify-between gap-3">
                        <span className="text-lg font-black leading-tight sm:text-xl">
                          {service}
                        </span>
                        <ArrowUpRight
                          className="h-5 w-5 shrink-0 opacity-45 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100"
                          aria-hidden
                        />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {visibleGallery.length > 0 ? (
        <section
          className={`mx-auto w-full px-4 sm:px-6 lg:px-8 ${
            firstDeliverable ? "max-w-6xl py-14 sm:py-20" : "max-w-7xl py-16 sm:py-20"
          }`}
        >
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--profile-accent-on-bg)]">
                {firstDeliverable ? "Work" : "Gallery"}
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
                {firstDeliverable ? "Selected work" : "Recent work."}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {firstDeliverable && safeFeaturedWorkUrl ? (
                <a
                  href={safeFeaturedWorkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-black"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden />
                  Watch reel
                </a>
              ) : null}
              {instagram ? (
                <a
                  href={instagram.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-black"
                >
                  {firstDeliverable ? "More on Instagram" : "Instagram"}
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </a>
              ) : null}
            </div>
          </div>
          <div
            className={
              firstDeliverable
                ? "mt-8 grid gap-4 md:grid-cols-12"
                : "mt-8 grid gap-4 md:grid-cols-2"
            }
          >
            {visibleGallery.slice(0, 6).map((item, index) => (
              <article
                id={`profile-gallery-${item.slug}`}
                key={item.slug}
                className={`group overflow-hidden border bg-[var(--profile-surface)] ${
                  firstDeliverable
                    ? "relative rounded-2xl shadow-2xl shadow-black/20 sm:rounded-[2rem]"
                    : "rounded-3xl"
                } ${
                  item.slug === sharedGallerySlug
                    ? "border-ts-orange ring-2 ring-ts-orange/35"
                    : "border-[var(--profile-line)]"
                } ${
                  firstDeliverable
                    ? visibleGallery.length === 1
                      ? "md:col-span-12"
                      : visibleGallery.length === 2
                        ? index === 0
                          ? "md:col-span-7"
                          : "md:col-span-5"
                        : "md:col-span-6"
                    : index === 0 && visibleGallery.length > 2
                      ? "md:row-span-2"
                      : ""
                }`}
              >
                <SafeProfileImg
                  src={item.imageUrl}
                  alt={item.imageAlt}
                  loading="lazy"
                  className={
                    firstDeliverable
                      ? "aspect-[16/11] h-full min-h-[260px] w-full object-cover transition duration-500 group-hover:scale-[1.02] sm:min-h-[440px] sm:aspect-[16/9]"
                      : `w-full object-cover transition duration-500 group-hover:scale-[1.02] ${
                          index === 0 && visibleGallery.length > 2
                            ? "aspect-[4/5] h-full"
                            : "aspect-[4/3]"
                        }`
                  }
                />
                {firstDeliverable ? (
                  <div
                    className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8"
                    style={{
                      background: "linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0))",
                    }}
                  >
                    <h3 className="text-xl font-black sm:text-2xl">{item.title}</h3>
                    {item.description ? (
                      <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
                        {item.description}
                      </p>
                    ) : null}
                    {renderGalleryShare ? (
                      <div className="mt-4">{renderGalleryShare(item)}</div>
                    ) : null}
                  </div>
                ) : (
                  <div className="p-5 text-[var(--profile-surface-fg)]">
                    <h3 className="text-lg font-black">{item.title}</h3>
                    {item.description ? (
                      <p className="mt-2 text-sm leading-relaxed opacity-65">{item.description}</p>
                    ) : null}
                    {renderGalleryShare ? (
                      <div className="mt-4">{renderGalleryShare(item)}</div>
                    ) : null}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {(showAbout && aboutText) || (showServiceAreas && serviceAreas.length > 0) ? (
        <section
          className="border-y border-[var(--profile-line)]"
          data-testid="default-profile-details"
        >
          <div
            className={`mx-auto grid w-full gap-10 px-4 sm:px-6 lg:gap-16 lg:px-8 ${
              firstDeliverable ? "max-w-6xl py-14 sm:py-20" : "max-w-7xl py-16 sm:py-20"
            } ${
              firstDeliverable && showAbout && aboutText
                ? "lg:grid-cols-[1.25fr_0.75fr]"
                : showAbout && aboutText && showServiceAreas && serviceAreas.length > 0
                  ? "lg:grid-cols-[1.25fr_0.75fr]"
                  : ""
            }`}
          >
            {showAbout && aboutText ? (
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--profile-accent-on-bg)]">
                  About
                </p>
                {firstDeliverable ? (
                  <>
                    <h2 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-[-0.045em] sm:text-5xl">
                      {operatorName ? `Meet ${operatorName}.` : `About ${businessName}.`}
                    </h2>
                    {operatorName ? (
                      <p className="mt-3 text-sm font-black uppercase tracking-[0.16em] text-[var(--profile-accent-on-bg)]">
                        {businessName}
                      </p>
                    ) : null}
                  </>
                ) : null}
                <p
                  className={
                    firstDeliverable
                      ? "mt-6 max-w-3xl text-lg font-semibold leading-relaxed tracking-[-0.015em] text-[var(--profile-muted)] sm:text-xl"
                      : "mt-5 max-w-3xl text-2xl font-bold leading-snug tracking-[-0.025em] sm:text-3xl"
                  }
                >
                  {aboutText}
                </p>
              </div>
            ) : null}
            {firstDeliverable ? (
              <aside className="rounded-[2rem] border border-[var(--profile-line)] bg-[var(--profile-surface)] p-6 text-[var(--profile-surface-fg)] shadow-2xl shadow-black/15 sm:p-8">
                <div className="flex items-center gap-4">
                  {showLogo && safeLogoUrl ? (
                    <SafeProfileImg
                      src={safeLogoUrl}
                      alt={`${businessName} logo`}
                      className="h-20 w-20 shrink-0 rounded-full border border-[var(--profile-line)] object-cover shadow-lg shadow-black/25"
                      onExhausted={() => setLogoFailed(true)}
                    />
                  ) : (
                    <span
                      className="grid h-20 w-20 shrink-0 place-items-center rounded-full text-xl font-black"
                      style={{
                        color: readableText(colors.primary),
                        background: colors.primary,
                      }}
                      aria-hidden
                    >
                      {businessInitials(businessName)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-xl font-black leading-tight tracking-[-0.03em]">
                      {businessName}
                    </p>
                    {operatorName ? (
                      <p className="mt-1 text-sm font-semibold opacity-65">{operatorName}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-7 space-y-3 border-t border-[var(--profile-line)] pt-6 text-sm font-semibold">
                  {categoryLabel ? (
                    <p className="flex items-center gap-3">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: colors.primary }}
                        aria-hidden
                      />
                      {categoryLabel}
                    </p>
                  ) : null}
                  {locationLabel ? (
                    <p className="flex items-center gap-3">
                      <MapPin
                        className="h-4 w-4 shrink-0 text-[var(--profile-accent-on-surface)]"
                        aria-hidden
                      />
                      {locationLabel}
                    </p>
                  ) : null}
                </div>

                {showServiceAreas && serviceAreas.length > 0 ? (
                  <div className="mt-6 border-t border-[var(--profile-line)] pt-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-55">
                      Service area
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {serviceAreas.slice(0, 12).map((area) => (
                        <span
                          key={area}
                          className="rounded-full border border-[var(--profile-line)] px-3 py-1.5 text-xs font-bold"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {safeSocials.length > 0 ? (
                  <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 border-t border-[var(--profile-line)] pt-6">
                    {safeSocials.map((social) => (
                      <a
                        key={`${social.label}-${social.href}`}
                        href={social.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-black transition hover:text-[var(--profile-accent-on-surface)]"
                      >
                        {social.kind === "instagram" ? (
                          <Instagram className="h-4 w-4" aria-hidden />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" aria-hidden />
                        )}
                        {social.handle || social.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </aside>
            ) : showServiceAreas && serviceAreas.length > 0 ? (
              <div className="rounded-3xl border border-[var(--profile-line)] bg-[var(--profile-primary-soft)] p-6 sm:p-8">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--profile-muted)]">
                  Service area
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {serviceAreas.slice(0, 12).map((area) => (
                    <span
                      key={area}
                      className="rounded-full border border-[var(--profile-line)] px-4 py-2 text-sm font-bold"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {(showBadges && badges.length > 0) || (showStats && stats.length > 0) ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-2">
            {showBadges && badges.length > 0 ? (
              <div className="rounded-3xl border border-[var(--profile-line)] bg-[var(--profile-surface)] p-6 text-[var(--profile-surface-fg)]">
                <p className="text-xs font-black uppercase tracking-[0.18em] opacity-60">Profile</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {badges.slice(0, 8).map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-[var(--profile-line)] px-4 py-2 text-sm font-bold"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {showStats && stats.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 rounded-3xl border border-[var(--profile-line)] bg-[var(--profile-surface)] p-4 text-[var(--profile-surface-fg)] sm:p-6">
                {stats.slice(0, 4).map((stat) => (
                  <div key={`${stat.label}-${stat.value}`} className="p-2">
                    <p className="text-2xl font-black tracking-[-0.04em]">{stat.value}</p>
                    <p className="mt-1 text-xs font-bold opacity-60">{stat.label}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {customBlocks.length > 0 ? (
        <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-16 sm:px-6 md:grid-cols-2 lg:px-8">
          {customBlocks.map((block) => (
            <article
              key={`${block.title}-${block.body}`}
              className="rounded-3xl border border-[var(--profile-line)] bg-[var(--profile-surface)] p-6 text-[var(--profile-surface-fg)] sm:p-8"
            >
              <h2 className="text-2xl font-black tracking-[-0.03em]">{block.title}</h2>
              <p className="mt-3 text-sm leading-relaxed opacity-70">{block.body}</p>
            </article>
          ))}
        </section>
      ) : null}

      {showRecommendations && visibleRecommendations.length > 0 ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--profile-accent-on-bg)]">
            Recommendations
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.045em]">
            {recommendationMode === "received"
              ? "What people say."
              : `Recommendations from ${businessName}.`}
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {visibleRecommendations.slice(0, 6).map((recommendation) => (
              <blockquote
                key={recommendation.id}
                className="rounded-3xl border border-[var(--profile-line)] bg-[var(--profile-surface)] p-6 text-[var(--profile-surface-fg)] sm:p-8"
              >
                {recommendationMode === "authored" ? (
                  <>
                    <p className="text-xs font-black uppercase tracking-[0.16em] opacity-60">
                      {recommendation.recommendationType === "positive"
                        ? "Recommends"
                        : "Does not recommend"}
                    </p>
                    <p className="mt-3 text-xl font-black">{recommendation.subjectName}</p>
                    <p className="mt-3 text-base font-bold leading-relaxed">
                      “{recommendation.comment}”
                    </p>
                    {recommendation.subjectHref ? (
                      <a
                        href={recommendation.subjectHref}
                        className="mt-5 inline-flex items-center gap-2 text-sm font-black"
                      >
                        View profile
                        <ArrowUpRight className="h-4 w-4" aria-hidden />
                      </a>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold leading-relaxed">“{recommendation.comment}”</p>
                    <footer className="mt-5 text-sm opacity-60">
                      {recommendation.customerName || "TradeScout member"}
                      {recommendation.projectType ? ` · ${recommendation.projectType}` : ""}
                    </footer>
                  </>
                )}
              </blockquote>
            ))}
          </div>
        </section>
      ) : null}

      {bookingSection ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {bookingSection}
        </section>
      ) : null}

      {profileItems ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {profileItems}
        </section>
      ) : null}

      {showContact && firstDeliverable ? (
        <section
          className="border-y border-[var(--profile-line)] bg-[var(--profile-surface)] text-[var(--profile-surface-fg)]"
          data-testid="default-profile-final-connect"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-14 lg:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--profile-accent-on-surface)]">
                Ready when you are
              </p>
              <h2 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-[-0.05em] sm:text-5xl">
                Tell {operatorName || businessName} what you need.
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onDirectConnect()}
              className="inline-flex min-h-14 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-ts-orange px-8 text-base font-black text-white shadow-xl shadow-black/25 transition hover:-translate-y-0.5 hover:bg-ts-orange-dark sm:w-auto"
            >
              Direct Connect
              <ArrowRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </section>
      ) : showContact ? (
        <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div
            className="relative overflow-hidden rounded-[2rem] border border-[var(--profile-line)] p-7 sm:p-10 lg:p-14"
            style={{
              background: `linear-gradient(135deg, ${colors.surface}, ${rgba(
                colors.primary,
                0.3
              )})`,
              color: surfaceForeground,
            }}
          >
            <div
              className="absolute -right-20 -top-24 h-72 w-72 rounded-full blur-3xl"
              style={{ background: rgba(colors.accent, 0.26) }}
              aria-hidden
            />
            <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] opacity-60">
                  Start here
                </p>
                <h2 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-[-0.05em] sm:text-5xl">
                  Connect with {businessName}.
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onDirectConnect()}
                className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-ts-orange px-7 text-base font-black text-white shadow-xl shadow-black/25 transition hover:-translate-y-0.5 hover:bg-ts-orange-dark"
              >
                Direct Connect
                <ArrowRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section
        className={`mx-auto w-full px-4 sm:px-6 lg:px-8 ${
          firstDeliverable ? "max-w-6xl py-8 sm:py-10" : "max-w-7xl pb-10"
        }`}
        data-testid="profile-trust-section"
        aria-label="Trust and profile actions"
      >
        {resolvedTrustActions}
      </section>

      {tradeScoutHandoff}
    </main>
  );
}
