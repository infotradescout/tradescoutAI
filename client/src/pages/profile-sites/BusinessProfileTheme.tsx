import { useEffect, useRef, useState, type ComponentProps, type CSSProperties } from "react";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Images, MapPin, Play } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SafeProfileImg } from "./safeProfileImage";
import type PreservedDefaultProfileTheme from "./PreservedDefaultProfileTheme";
import "./BusinessProfileTheme.css";

type Props = ComponentProps<typeof PreservedDefaultProfileTheme>;
type Photo = Props["galleryItems"][number];

export function publicProfileUrl(value: string | undefined, relative = false): string | undefined {
  const candidate = String(value || "").trim();
  if (!candidate || /[\u0000-\u001f\\]/.test(candidate)) return undefined;
  if (relative && candidate.startsWith("/") && !candidate.startsWith("//")) return candidate.replaceAll(" ", "%20");
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch { return undefined; }
}
function sameText(first?: string, second?: string) {
  const normalize = (value?: string) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return Boolean(normalize(first)) && normalize(first) === normalize(second);
}
function hex(value: string | undefined, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "").trim()) ? value!.trim() : fallback;
}
function luminance(color: string) {
  const rgb = [1, 3, 5].map((offset) => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function ink(background: string) { return luminance(background) > 0.179 ? "#111418" : "#ffffff"; }
function alpha(color: string, opacity: number) {
  return `rgba(${[1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16)).join(",")},${opacity})`;
}
function ProfilePhoto({ onExhausted, ...props }: ComponentProps<typeof SafeProfileImg>) {
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => setUnavailable(false), [props.src]);
  return unavailable ? <span className="bp-photo-unavailable">Photo unavailable</span> : <SafeProfileImg {...props} onExhausted={() => { setUnavailable(true); onExhausted?.(); }} />;
}

/** Presentation only: stored copy, contact authority, memberships and routes remain upstream. */
export default function BusinessProfileTheme(props: Props) {
  const {
    businessName, operatorName, categoryLabel, locationLabel, heroTitle, headline, heroText,
    logoUrl, heroImageUrl, heroImageAlt, featuredWorkUrl, brandColors, services, serviceAreas,
    aboutText, galleryItems, sharedGallerySlug, socials = [], customBlocks = [], badges = [],
    stats = [], recommendations = [], recommendationMode = "received", showAbout = true,
    showBadges = true, showStats = true, showServices = true, showServiceAreas = true,
    showRecommendations = true, showContact = true, onDirectConnect, shareAction,
    renderGalleryShare, bookingSection, profileItems, trustActions, lightTrustActions, tradeScoutHandoff,
  } = props;
  const background = hex(brandColors?.background, "#111315");
  const surface = hex(brandColors?.surface, "#1a1d20");
  const primary = hex(brandColors?.primary, "#f97316");
  const foreground = ink(background), surfaceForeground = ink(surface);
  const style = {
    "--bp-bg": background, "--bp-surface": surface, "--bp-fg": foreground,
    "--bp-surface-fg": surfaceForeground, "--bp-muted": alpha(foreground, .72),
    "--bp-surface-muted": alpha(surfaceForeground, .72), "--bp-line": alpha(foreground, .16),
    "--bp-primary": primary, "--bp-button-fg": ink(primary),
    "--profile-bg": background, "--profile-surface": surface, "--profile-fg": foreground,
    "--profile-surface-fg": surfaceForeground, "--profile-muted": alpha(foreground, .72),
    "--profile-line": alpha(foreground, .16), "--profile-primary": primary,
  } as CSSProperties;
  const logo = publicProfileUrl(logoUrl, true);
  const hero = publicProfileUrl(heroImageUrl, true);
  const featuredWork = publicProfileUrl(featuredWorkUrl);
  const safeSocials = socials.flatMap((social) => {
    const href = publicProfileUrl(social.href);
    return href ? [{ ...social, href }] : [];
  });
  const safePhotos = galleryItems.flatMap((photo) => {
    const imageUrl = publicProfileUrl(photo.imageUrl, true);
    return imageUrl ? [{ ...photo, imageUrl }] : [];
  });
  const heroPhoto: Photo | undefined = hero
    ? safePhotos.find((photo) => photo.imageUrl === hero) || {
        slug: "profile-cover", title: "", imageAlt: heroImageAlt || `${businessName} photo`, imageUrl: hero,
      }
    : safePhotos[0];
  const photos = heroPhoto ? [heroPhoto, ...safePhotos.filter((photo) => photo.imageUrl !== heroPhoto.imageUrl)] : safePhotos;
  const [failedCover, setFailedCover] = useState(false);
  const [failedLogo, setFailedLogo] = useState(false);
  const [activePhoto, setActivePhoto] = useState<number | null>(null);
  const [expandedGallery, setExpandedGallery] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => setFailedCover(false), [heroPhoto?.imageUrl]);
  useEffect(() => setFailedLogo(false), [logo]);
  useEffect(() => {
    if (!sharedGallerySlug) return;
    const index = photos.findIndex((photo) => photo.slug === sharedGallerySlug);
    if (index >= 0) setActivePhoto(index);
  }, [sharedGallerySlug, photos.map((photo) => photo.slug).join("|")]);
  const openPhoto = (index: number, target?: HTMLElement) => {
    opener.current = target || null;
    setActivePhoto(index);
  };
  const selected = activePhoto === null ? undefined : photos[activePhoto];
  const movePhoto = (amount: number) => setActivePhoto((index) => index === null ? null : (index + amount + photos.length) % photos.length);
  const coverVisible = Boolean(heroPhoto) && !failedCover;
  const storedTitle = heroTitle || headline || "";
  const supporting = heroText || (heroTitle ? headline : "") || "";
  const titleIsDistinct = storedTitle && !sameText(storedTitle, businessName) && !sameText(storedTitle, categoryLabel);
  const supportingIsDistinct = supporting && !sameText(supporting, storedTitle) && !sameText(supporting, businessName) && !sameText(supporting, categoryLabel);
  const visibleRecommendations = recommendations.filter((entry) => recommendationMode === "received" ? entry.recommendationType === "positive" : Boolean(entry.subjectName));
  const visibleStats = stats.filter((stat) => !(
    (stat.label === "Services" && stat.value === String(services.length)) ||
    (stat.label === "Serves" && stat.value === `${serviceAreas.length} area${serviceAreas.length === 1 ? "" : "s"}`)
  ));
  const visibleBadges = badges.filter((badge) => !sameText(badge, categoryLabel));
  const navigation = [
    showAbout && aboutText ? ["profile-about", "About"] : null,
    showServices && services.length ? ["profile-services", "Services"] : null,
    photos.length ? ["profile-gallery", "Gallery"] : null,
    profileItems ? ["profile-items", "Products"] : null,
    showRecommendations && visibleRecommendations.length ? ["profile-recommendations", "Recommendations"] : null,
  ].filter((entry): entry is string[] => Boolean(entry));
  const hasAside = (showServiceAreas && serviceAreas.length > 0) || bookingSection || trustActions || lightTrustActions;
  const galleryShare = (photo: Photo) => safePhotos.some((item) => item.slug === photo.slug) ? renderGalleryShare?.(photo) : null;

  return <main className="business-profile" style={style} data-testid="default-profile-theme" data-presentation="business-editorial">
    <div className="bp-wrap">
      {coverVisible && heroPhoto ? <section className={`bp-cover ${photos.length > 2 ? "bp-cover--mosaic" : ""}`} aria-label="Business photographs" data-testid="business-profile-cover">
        <button type="button" className="bp-cover-main" onClick={(event) => openPhoto(0, event.currentTarget)} aria-label={`View ${heroPhoto.imageAlt}`}>
          <ProfilePhoto src={heroPhoto.imageUrl} alt={heroPhoto.imageAlt} loading="eager" className="bp-cover-image" onExhausted={() => setFailedCover(true)} />
        </button>
        {photos.length > 2 ? <div className="bp-cover-side">{photos.slice(1, 3).map((photo, index) => <button key={photo.slug} type="button" onClick={(event) => openPhoto(index + 1, event.currentTarget)} aria-label={`View ${photo.imageAlt}`}>
          <ProfilePhoto src={photo.imageUrl} alt={photo.imageAlt} loading="lazy" className="bp-cover-image" />
        </button>)}</div> : null}
        <button type="button" className="bp-photo-count" onClick={(event) => openPhoto(0, event.currentTarget)}><Images size={16} aria-hidden />{photos.length} {photos.length === 1 ? "photo" : "photos"}</button>
      </section> : null}
      <header className={`bp-identity ${coverVisible ? "bp-identity--cover" : ""}`} data-testid="default-profile-header">
        <div className="bp-logo" data-testid={!coverVisible ? "default-profile-brand-hero" : undefined}>{logo && !failedLogo ? <SafeProfileImg src={logo} alt={`${businessName} logo`} loading="eager" onExhausted={() => setFailedLogo(true)} /> : <span aria-hidden>{businessName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("")}</span>}</div>
        <div className="bp-identity-copy">
          <h1>{businessName}</h1>
          <div className="bp-meta">{categoryLabel ? <span>{categoryLabel}</span> : null}{locationLabel ? <span><MapPin size={14} aria-hidden />{locationLabel}</span> : null}{operatorName ? <span>{operatorName}</span> : null}</div>
          {titleIsDistinct ? <p className="bp-headline">{storedTitle}</p> : null}
          {supportingIsDistinct ? <p className="bp-summary">{supporting}</p> : null}
        </div>
        <div className="bp-primary-actions">{showContact ? <button type="button" className="bp-request" onClick={() => onDirectConnect()} data-testid="business-profile-request">Start a Request <ArrowRight size={18} aria-hidden /></button> : null}{shareAction ? <div className="bp-share">{shareAction}</div> : null}</div>
      </header>
      {navigation.length > 1 ? <nav className="bp-nav" aria-label="Profile sections">{navigation.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav> : null}
      <div className={`bp-body ${hasAside ? "bp-body--aside" : ""}`}>
        <div className="bp-content">
          {showAbout && aboutText ? <section id="profile-about" className="bp-section"><h2>About</h2><p className="bp-prose">{aboutText}</p></section> : null}
          {showServices && services.length > 0 ? <section id="profile-services" className="bp-section"><h2>Services</h2><div className="bp-services">{services.map((service, index) => showContact ? <button key={`${service}-${index}`} type="button" onClick={() => onDirectConnect(service)} data-testid={`default-profile-service-${index}`}><span>{service}</span><ArrowUpRight size={18} aria-hidden /></button> : <div key={`${service}-${index}`} data-testid={`default-profile-service-${index}`}><span>{service}</span></div>)}</div></section> : null}
          {photos.length > 0 ? <section id="profile-gallery" className="bp-section"><div className="bp-section-heading"><h2>Gallery</h2>{photos.length > 4 ? <button className="bp-text-button" type="button" onClick={() => setExpandedGallery(!expandedGallery)} aria-expanded={expandedGallery} aria-controls="business-profile-photos">{expandedGallery ? "Show fewer photos" : `View all ${photos.length} photos`}<ArrowRight size={16} aria-hidden /></button> : null}</div>
            <div id="business-profile-photos" className="bp-gallery">{(expandedGallery ? photos : photos.slice(0, 4)).map((photo, index) => <article key={`${photo.slug}-${index}`} id={`profile-gallery-${photo.slug}`} className={sharedGallerySlug === photo.slug ? "bp-photo bp-photo--selected" : "bp-photo"}>
              <button type="button" onClick={(event) => openPhoto(index, event.currentTarget)} aria-label={`View ${photo.imageAlt || photo.title}`}><ProfilePhoto src={photo.imageUrl} alt={photo.imageAlt} loading="lazy" className="bp-gallery-image" /></button>
              {(photo.title && !sameText(photo.title, businessName)) || photo.description || galleryShare(photo) ? <div className="bp-caption"><div>{photo.title && !sameText(photo.title, businessName) ? <h3>{photo.title}</h3> : null}{photo.description ? <p>{photo.description}</p> : null}</div>{galleryShare(photo)}</div> : null}
            </article>)}</div>
          </section> : null}
          {profileItems ? <section id="profile-items" className="bp-section bp-items" aria-label="Products and profile items">{profileItems}</section> : null}
          {customBlocks.map((block, index) => <section key={`${block.title}-${index}`} className="bp-section"><h2>{block.title}</h2><p className="bp-prose">{block.body}</p></section>)}
          {showRecommendations && visibleRecommendations.length ? <section id="profile-recommendations" className="bp-section"><h2>{recommendationMode === "authored" ? "Recommendations" : "Customer recommendations"}</h2><div className="bp-recommendations">{visibleRecommendations.map((entry) => {
            const href = publicProfileUrl(entry.subjectHref, true);
            return <article key={entry.id}>{recommendationMode === "authored" ? <p>{entry.recommendationType === "negative" ? "Does not recommend" : "Recommends"}</p> : null}{entry.comment ? <blockquote>{entry.comment}</blockquote> : null}<p>{recommendationMode === "authored" ? (href ? <a href={href}>{entry.subjectName}<ArrowUpRight size={14} aria-hidden /></a> : entry.subjectName) : entry.customerName || "TradeScout member"}{entry.projectType ? <span> · {entry.projectType}</span> : null}</p></article>;
          })}</div></section> : null}
          {showStats && visibleStats.length ? <dl className="bp-facts">{visibleStats.map((stat, index) => <div key={`${stat.label}-${index}`}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl> : null}
          {showBadges && visibleBadges.length ? <div className="bp-badges">{visibleBadges.map((badge, index) => <span key={`${badge}-${index}`}>{badge}</span>)}</div> : null}
        </div>
        {hasAside ? <aside className="bp-aside" aria-label="Business details" data-testid={(showServiceAreas && serviceAreas.length > 0) || (showAbout && aboutText) ? "default-profile-details" : undefined}>
          {showServiceAreas && serviceAreas.length ? <section className="bp-aside-section"><h2>Service area</h2><ul className="bp-areas">{serviceAreas.map((area, index) => <li key={`${area}-${index}`}><MapPin size={16} aria-hidden /><span>{area}</span></li>)}</ul></section> : null}
          {bookingSection ? <div className="bp-booking">{bookingSection}</div> : null}
          {trustActions || lightTrustActions ? <section className="bp-aside-section bp-trust" data-testid="profile-trust-section" aria-label="Verification and community support">{surfaceForeground === "#ffffff" ? trustActions : lightTrustActions || trustActions}</section> : null}
        </aside> : null}
      </div>
      {safeSocials.length || featuredWork ? <div className="bp-socials">{featuredWork ? <a href={featuredWork} target="_blank" rel="noreferrer"><Play size={16} aria-hidden />View featured work</a> : null}{safeSocials.map((social) => <a key={`${social.label}-${social.href}`} href={social.href} target="_blank" rel="noreferrer">{social.handle || social.label}<ArrowUpRight size={16} aria-hidden /></a>)}</div> : null}
      <div className="bp-footer">{tradeScoutHandoff}</div>
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setActivePhoto(null); }}>
      <DialogContent className="bp-lightbox" onCloseAutoFocus={(event) => { if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus(); } }} onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); movePhoto(1); } if (event.key === "ArrowLeft") { event.preventDefault(); movePhoto(-1); } }}>
        <DialogTitle className="sr-only">{selected?.title || `${businessName} gallery`}</DialogTitle><DialogDescription className="sr-only">{selected?.imageAlt || "Business photograph"}</DialogDescription>
        {selected ? <><div className="bp-lightbox-image"><ProfilePhoto src={selected.imageUrl} alt={selected.imageAlt} loading="eager" /></div><div className="bp-lightbox-controls"><button type="button" onClick={() => movePhoto(-1)} disabled={photos.length < 2} aria-label="Previous photo"><ChevronLeft size={22} /></button><p aria-live="polite">{(activePhoto || 0) + 1} / {photos.length}</p><button type="button" onClick={() => movePhoto(1)} disabled={photos.length < 2} aria-label="Next photo"><ChevronRight size={22} /></button></div>{selected.description ? <p className="bp-lightbox-caption">{selected.description}</p> : null}{galleryShare(selected) ? <div className="bp-lightbox-share">{galleryShare(selected)}</div> : null}</> : null}
      </DialogContent>
    </Dialog>
  </main>;
}
