import { useEffect, useMemo, useState, useRef, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Expand,
  ExternalLink,
  Globe2,
  MapPin,
  Phone,
  X,
} from "lucide-react";
import "./ProjectServiceProfile.css";
import { ShareButton } from "@/components/ShareButton";
import { qualifyPublicProfileItemDestination } from "@/lib/publicProfileItemDestination";
import { type ResolvedProfileGalleryItem } from "@shared/profileGalleryShare";
import { buildProfilePublicItemPath } from "@shared/profilePublicItemRoute";
import type { LocalServiceProfilePresentation } from "@shared/localServiceProfile";

import { trackProfileAction, type LocalServiceProfileProps } from "./LocalServiceProfileTheme";

function formatScoreHistoryDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function externalActionProps(args: {
  profileSlug: string;
  action: "directions" | "website";
  surface: string;
}) {
  return {
    target: "_blank",
    rel: "noreferrer",
    onClick: () => trackProfileAction(args),
  } as const;
}

export default function ProjectServiceProfile({
  profileSlug,
  platformBaseHref = "",
  businessName,
  presentation,
  onDirectConnect,
  canCall = true,
  tradeScoutReturnHref,
  profileShareDestination,
  publicRouteContentBlocks,
  galleryItems: suppliedGalleryItems = [],
  sharedGallerySlug = null,
  recommendationsDirectory = [],
  trustActions,
  profileItems,
  verificationStatus = null,
  verifiedBadge = false,
  communityVerification = null,
}: LocalServiceProfileProps) {
  const [activeGalleryIndex, setActiveGalleryIndex] = useState<number | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const galleryDialogRef = useRef<HTMLDivElement>(null);
  const galleryItems = useMemo(() => {
    if (
      !presentation.heroImage ||
      suppliedGalleryItems.some((item) => item.imageUrl === presentation.heroImage)
    )
      return suppliedGalleryItems;
    const hero: ResolvedProfileGalleryItem = {
      itemType: "gallery",
      title: "Photo",
      hasPublicTitle: false,
      description: "",
      imageUrl: presentation.heroImage,
      imageAlt: presentation.heroImageAlt,
      slug: "profile-photo",
      blockIndex: -1,
      imageIndex: -1,
    };
    return [hero, ...suppliedGalleryItems];
  }, [suppliedGalleryItems, presentation.heroImage, presentation.heroImageAlt]);
  const heroGalleryIndex = Math.max(
    0,
    galleryItems.findIndex((item) => item.imageUrl === presentation.heroImage)
  );
  const additionalGalleryItems = galleryItems
    .map((item, index) => ({ item, index }))
    .filter(({ index }) => !presentation.heroImage || index !== heroGalleryIndex);
  useEffect(() => {
    setSelectedServices([]);
    setActiveGalleryIndex(null);
  }, [profileSlug]);
  const publicRecommendations = useMemo(
    () =>
      recommendationsDirectory.filter(
        (entry) => entry.recommendationType === "positive" && entry.comment.trim().length > 0
      ),
    [recommendationsDirectory]
  );
  const activeGalleryItem =
    activeGalleryIndex === null ? null : galleryItems[activeGalleryIndex] || null;
  const isVerified =
    verifiedBadge === true && String(verificationStatus || "").toLowerCase() === "approved";
  const verificationScore =
    typeof communityVerification?.score === "number" && Number.isFinite(communityVerification.score)
      ? Math.max(0, Math.round(communityVerification.score))
      : null;
  const hasCredentials = presentation.credentials.length > 0;
  const hasTrustDetails = isVerified || hasCredentials || verificationScore !== null;
  const scoreHistoryStart = formatScoreHistoryDate(communityVerification?.scoreHistoryStartsAt);
  const themeStyle = {
    "--service-brand": presentation.brand.primary,
    "--service-brand-dark": presentation.brand.primaryDark,
    "--service-surface": presentation.brand.surface,
    "--service-background": presentation.brand.background,
  } as CSSProperties;

  const openProtectedContact = (
    action: "request" | "call" | "service" | "financing",
    surface: string,
    detail?: string
  ) => {
    trackProfileAction({ profileSlug, action, surface, detail });
    const serviceContext =
      action === "call" || action === "financing"
        ? undefined
        : detail || selectedServices.join(", ") || undefined;
    onDirectConnect(serviceContext);
  };

  useEffect(() => {
    if (!activeGalleryItem) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    galleryDialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveGalleryIndex(null);
      if (event.key === "Tab") {
        const controls = [
          ...(galleryDialogRef.current?.querySelectorAll<HTMLElement>("button, a[href]") || []),
        ];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
      if (event.key === "ArrowLeft" && galleryItems.length > 1) {
        setActiveGalleryIndex((current) =>
          current === null ? null : (current - 1 + galleryItems.length) % galleryItems.length
        );
      }
      if (event.key === "ArrowRight" && galleryItems.length > 1) {
        setActiveGalleryIndex((current) =>
          current === null ? null : (current + 1) % galleryItems.length
        );
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeGalleryItem, galleryItems.length]);

  return (
    <main
      style={themeStyle}
      className="local-service-profile"
      data-testid="local-service-profile-theme"
      data-profile-layout="project-profile"
    >
      <header className="service-profile-bar">
        <a href={tradeScoutReturnHref} aria-label="Return to TradeScout">
          <ArrowLeft aria-hidden="true" />
          TradeScout
        </a>
        <ShareButton
          destination={profileShareDestination}
          title={businessName}
          text={businessName}
          variant="outline"
          label="Share"
          className="service-profile-share"
        />
      </header>

      <section className="service-profile-overview" aria-label={businessName}>
        <div className="service-profile-identity">
          <div className="service-profile-name">
            {presentation.logoImage ? (
              <img
                src={presentation.logoImage}
                alt={presentation.logoAlt}
                className="service-profile-logo"
              />
            ) : null}
            <h1>{businessName}</h1>
          </div>
          {presentation.heroTitle ? (
            <p className="service-profile-specialty">{presentation.heroTitle}</p>
          ) : null}
          <p className="service-profile-location">
            <MapPin aria-hidden="true" />
            {presentation.locationLabel}
          </p>
          {presentation.serviceAreas.length ? (
            <p className="service-profile-coverage">
              Serving{" "}
              {new Intl.ListFormat("en-US", { style: "long", type: "conjunction" }).format(
                presentation.serviceAreas
              )}
              .
            </p>
          ) : null}
          {presentation.heroDescription ? (
            <p className="service-profile-intro">{presentation.heroDescription}</p>
          ) : null}
          {isVerified ? (
            <p className="service-profile-verified">
              <BadgeCheck aria-hidden="true" />
              Verified business
            </p>
          ) : null}
        </div>

        {presentation.heroImage ? (
          <figure
            className="service-profile-photo"
            id={`profile-gallery-${galleryItems[heroGalleryIndex]?.slug || "profile-photo"}`}
            data-shared={galleryItems[heroGalleryIndex]?.slug === sharedGallerySlug || undefined}
          >
            <button
              type="button"
              onClick={() => setActiveGalleryIndex(heroGalleryIndex)}
              aria-label="View full photo"
            >
              <img src={presentation.heroImage} alt={presentation.heroImageAlt} loading="eager" />
              <span className="service-profile-photo-label">
                <Expand aria-hidden="true" />
                View photo
              </span>
            </button>
          </figure>
        ) : null}

        <div className="service-profile-project" id="services">
          {presentation.services.length ? (
            <fieldset>
              <legend>What do you need?</legend>
              <p className="service-profile-selection-help">Choose any that apply.</p>
              <div className="service-profile-choices">
                {presentation.services.map((service) => (
                  <label key={service.title} className="service-profile-choice">
                    <input
                      type="checkbox"
                      checked={selectedServices.includes(service.title)}
                      onChange={() =>
                        setSelectedServices((current) =>
                          current.includes(service.title)
                            ? current.filter((title) => title !== service.title)
                            : [...current, service.title]
                        )
                      }
                    />
                    <span>
                      <span>{service.title}</span>
                      {service.description ? <small>{service.description}</small> : null}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <div className="service-profile-request">
            <p aria-live="polite" className="service-profile-selection">
              {selectedServices.length ? selectedServices.join(" · ") : ""}
            </p>
            <button
              type="button"
              className="service-profile-primary"
              onClick={() => openProtectedContact("request", "project")}
            >
              Start a Request
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
          {canCall || presentation.websiteUrl || presentation.directionsUrl ? (
            <div className="service-profile-links">
              {canCall ? (
                <button type="button" onClick={() => openProtectedContact("call", "project")}>
                  <Phone aria-hidden="true" />
                  {presentation.callActionLabel || "Call"}
                </button>
              ) : null}
              {presentation.directionsUrl ? (
                <a
                  href={presentation.directionsUrl}
                  {...externalActionProps({
                    profileSlug,
                    action: "directions",
                    surface: "project",
                  })}
                >
                  <MapPin aria-hidden="true" />
                  Directions
                </a>
              ) : null}
              {presentation.websiteUrl ? (
                <a
                  href={presentation.websiteUrl}
                  {...externalActionProps({ profileSlug, action: "website", surface: "project" })}
                >
                  <Globe2 aria-hidden="true" />
                  Website
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <div className="service-profile-more">
        {additionalGalleryItems.length ? (
          <section className="service-profile-gallery" aria-label="Photos">
            <h2>Photos</h2>
            <div className="service-profile-gallery-grid">
              {additionalGalleryItems.map(({ item, index }) => (
                <article
                  key={item.slug}
                  id={`profile-gallery-${item.slug}`}
                  data-shared={item.slug === sharedGallerySlug || undefined}
                >
                  <button
                    type="button"
                    aria-label={`Open ${item.title}`}
                    onClick={() => {
                      trackProfileAction({
                        profileSlug,
                        action: "gallery",
                        surface: "photos",
                        detail: item.slug,
                      });
                      setActiveGalleryIndex(index);
                    }}
                  >
                    <img src={item.imageUrl} alt={item.imageAlt} loading="lazy" />
                  </button>
                  <p>{item.title}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {presentation.aboutBody || presentation.aboutImage || presentation.commitments?.length ? (
          <details className="service-profile-detail" id="company">
            <summary>
              About {businessName}
              <ChevronRight aria-hidden="true" />
            </summary>
            <div className="service-profile-detail-content">
              {presentation.aboutImage ? (
                <img
                  className="service-profile-about-image"
                  src={presentation.aboutImage}
                  alt={presentation.aboutImageAlt || presentation.aboutTitle}
                  loading="lazy"
                />
              ) : null}
              {presentation.aboutBody ? <p>{presentation.aboutBody}</p> : null}
              {presentation.commitments?.length ? (
                <ul>
                  {presentation.commitments.map((commitment) => (
                    <li key={commitment}>{commitment}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </details>
        ) : null}

        {presentation.addressLabel || presentation.hoursLabel ? (
          <details className="service-profile-detail" id="details">
            <summary>
              Location & hours
              <ChevronRight aria-hidden="true" />
            </summary>
            <div className="service-profile-detail-content">
              {presentation.addressLabel ? <p>{presentation.addressLabel}</p> : null}
              {presentation.hoursLabel ? <p>{presentation.hoursLabel}</p> : null}
              {presentation.hoursNote ? <p>{presentation.hoursNote}</p> : null}
            </div>
          </details>
        ) : null}

        {hasTrustDetails ? (
          <details className="service-profile-detail">
            <summary>
              {hasCredentials
                ? `Credentials (${presentation.credentials.length})`
                : isVerified
                  ? "Business verification"
                  : "Community verification"}
              <ChevronRight aria-hidden="true" />
            </summary>
            <div className="service-profile-detail-content">
              {isVerified ? (
                <p>
                  {presentation.verificationHistoryNote ||
                    "Business identity verified by TradeScout."}
                </p>
              ) : null}
              {presentation.credentials.map((credential) => (
                <div
                  className="service-profile-credential"
                  key={`${credential.label}-${credential.value}`}
                >
                  <h3>{credential.label}</h3>
                  <p>{credential.value}</p>
                  {credential.authority ? <p>{credential.authority}</p> : null}
                  {credential.verificationUrl ? (
                    <a href={credential.verificationUrl} target="_blank" rel="noreferrer">
                      Verify
                      <ExternalLink aria-hidden="true" />
                    </a>
                  ) : null}
                  {credential.statusLabel ? <p>{credential.statusLabel}</p> : null}
                  {credential.checkedAt ? <p>Source reviewed {credential.checkedAt}</p> : null}
                </div>
              ))}
              {hasCredentials && presentation.credentialDisclosure ? (
                <p>{presentation.credentialDisclosure}</p>
              ) : null}
              {verificationScore !== null ? (
                <p>
                  Community Verification Score · {verificationScore}
                  {scoreHistoryStart ? (
                    <>
                      <br />
                      History since {scoreHistoryStart}
                    </>
                  ) : null}
                  {typeof communityVerification?.scoreChange30d === "number" ? (
                    <>
                      <br />
                      30-day change: {communityVerification.scoreChange30d > 0 ? "+" : ""}
                      {Math.round(communityVerification.scoreChange30d)}
                    </>
                  ) : null}
                  {communityVerification?.activePolicyBoostPoints ? (
                    <>
                      <br />
                      Active score adjustments: +{communityVerification.activePolicyBoostPoints}
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </details>
        ) : null}

        {presentation.financingTitle && presentation.financingDescription ? (
          <details className="service-profile-detail">
            <summary>
              {presentation.financingTitle}
              <ChevronRight aria-hidden="true" />
            </summary>
            <div className="service-profile-detail-content">
              <p>{presentation.financingDescription}</p>
              <button
                type="button"
                className="service-profile-secondary"
                onClick={() => openProtectedContact("financing", "details")}
              >
                Ask about financing
              </button>
            </div>
          </details>
        ) : null}

        {publicRecommendations.length ? (
          <section className="service-profile-recommendations">
            <h2>Customer recommendations</h2>
            <div>
              {publicRecommendations.slice(0, 6).map((entry) => (
                <article key={entry.id}>
                  <h3>{entry.customerName || "Customer"}</h3>
                  {entry.projectType ? <p>{entry.projectType}</p> : null}
                  <blockquote>{entry.comment}</blockquote>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        {profileItems ? <section className="service-profile-items">{profileItems}</section> : null}
        {trustActions ? <div className="service-profile-trust-actions">{trustActions}</div> : null}
      </div>

      <footer className="service-profile-footer">
        <a href={qualifyPublicProfileItemDestination("/", platformBaseHref)}>
          Powered by TradeScout
        </a>
        <span>Connection Without Compromise</span>
      </footer>

      <div className="service-profile-mobile-request">
        <button
          type="button"
          className="service-profile-primary"
          onClick={() => openProtectedContact("request", "mobile_bar")}
        >
          Start a Request
          <ArrowRight aria-hidden="true" />
        </button>
      </div>

      {activeGalleryItem && activeGalleryIndex !== null ? (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/95 p-3 sm:p-6"
          ref={galleryDialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${businessName} photo gallery`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveGalleryIndex(null);
          }}
        >
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-black text-white">{activeGalleryItem.title}</p>
                {activeGalleryItem.description ? (
                  <p className="truncate text-xs text-slate-400">{activeGalleryItem.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setActiveGalleryIndex(null)}
                className="grid h-10 w-10 flex-none place-items-center rounded-full border border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close gallery"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
              <img
                src={activeGalleryItem.imageUrl}
                alt={activeGalleryItem.imageAlt}
                className="max-h-[76vh] w-full object-contain"
              />
              {galleryItems.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveGalleryIndex((current) =>
                        current === null
                          ? null
                          : (current - 1 + galleryItems.length) % galleryItems.length
                      )
                    }
                    className="absolute left-3 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/60 text-white hover:bg-black/80"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveGalleryIndex((current) =>
                        current === null ? null : (current + 1) % galleryItems.length
                      )
                    }
                    className="absolute right-3 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/60 text-white hover:bg-black/80"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
              <p className="text-xs text-slate-500">
                {activeGalleryIndex + 1} of {galleryItems.length}
              </p>
              <ShareButton
                destination={
                  buildProfilePublicItemPath({
                    profileBasePath: profileShareDestination,
                    itemType: "gallery",
                    itemSlug: activeGalleryItem.slug,
                    contentBlocks: publicRouteContentBlocks,
                  }) || profileShareDestination
                }
                title={`${activeGalleryItem.title} | ${businessName}`}
                text={presentation.galleryShareText}
                variant="outline"
                label={`Share ${activeGalleryItem.title}`}
                className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
