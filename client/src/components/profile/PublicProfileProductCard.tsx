import { useState, type ReactNode } from "react";
import { ArrowUpRight, MapPin, PackageOpen } from "lucide-react";
import { Link } from "wouter";
import { ShareButton } from "@/components/ShareButton";
import { Button } from "@/components/ui/button";
import { requiresDocumentNavigation } from "@/lib/publicProfileItemDestination";

type PublicProfileProductCardProps = {
  title: string;
  destination: string;
  imageUrl?: string | null;
  imageAlt?: string;
  description?: string | null;
  price?: string | null;
  eyebrow?: string | null;
  location?: string | null;
  availability?: string | null;
  shareText: string;
  actionLabel?: string;
};

/** Inventory only: retain canonical navigation, supplied facts and existing sharing authority. */
export function PublicProfileProductCard({
  title, destination, imageUrl, imageAlt, description, price, eyebrow, location,
  availability, shareText, actionLabel = "View item",
}: PublicProfileProductCardProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const documentNavigation = requiresDocumentNavigation(destination);
  const actionName = `${actionLabel}: ${title}`;
  const itemLink = (children: ReactNode, className?: string) => documentNavigation
    ? <a href={destination} aria-label={actionName} className={className}>{children}</a>
    : <Link href={destination} aria-label={actionName} className={className}>{children}</Link>;
  const focusClass = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-300";

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(0,0,0,0.2))] shadow-[0_16px_44px_rgba(0,0,0,0.22)] transition duration-300 hover:border-ts-orange/40 hover:shadow-[0_22px_55px_rgba(0,0,0,0.32)] motion-safe:hover:-translate-y-1 motion-reduce:transition-none"
      data-testid="public-profile-product-card">
      <div className="relative aspect-[4/3] overflow-hidden bg-black/30">
        {itemLink(imageUrl && failedImageUrl !== imageUrl ? (
          <img src={imageUrl} alt={imageAlt || title} loading="lazy" decoding="async"
            onError={() => setFailedImageUrl(imageUrl)}
            className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03] motion-reduce:transition-none" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.16),transparent_58%)] px-6 text-center text-white/80">
            <PackageOpen aria-hidden="true" className="h-8 w-8 text-ts-orange" />
            <p className="text-sm font-semibold">No photo available</p>
            <p className="text-xs text-white/70">Open the item for details.</p>
          </div>
        ), "block h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-orange-300")}
        {eyebrow ? <span className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-5rem)] break-words rounded-xl border border-white/20 bg-black/80 px-3 py-1.5 text-xs font-bold leading-snug text-white backdrop-blur-md">{eyebrow}</span> : null}
        <ShareButton destination={destination} title={title} text={shareText} size="icon" label=""
          className={`absolute right-3 top-3 min-h-11 min-w-11 rounded-full border-white/20 bg-black/80 text-white hover:bg-black ${focusClass}`} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        {price ? <p className="mb-2 break-words text-lg font-extrabold leading-snug text-ts-orange [overflow-wrap:anywhere]">{price}</p> : null}
        <h3 className="break-words text-base font-bold leading-snug text-white [overflow-wrap:anywhere] sm:text-lg">
          {itemLink(title, `rounded-sm hover:underline underline-offset-4 ${focusClass}`)}
        </h3>
        {description ? <p className="mt-2 line-clamp-3 break-words text-sm leading-relaxed text-white/80 [overflow-wrap:anywhere]">{description}</p> : null}
        {(location || availability) ? <div className="mt-4 flex min-w-0 flex-wrap gap-2 text-xs font-semibold">
          {availability ? <span className="max-w-full break-words rounded-xl bg-white/10 px-2.5 py-1.5 text-white/90 [overflow-wrap:anywhere]">{availability}</span> : null}
          {location ? <span className="inline-flex max-w-full items-start gap-1 rounded-xl bg-white/5 px-2.5 py-1.5 text-white/80">
            <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 break-words [overflow-wrap:anywhere]">{location}</span>
          </span> : null}
        </div> : null}
        <div className="mt-auto pt-5">
          <Button asChild className={`min-h-11 h-auto w-full whitespace-normal bg-white py-3 text-black hover:bg-ts-orange hover:text-white ${focusClass}`}>
            {itemLink(<><span className="min-w-0 break-words">{actionLabel}</span><ArrowUpRight aria-hidden="true" className="ml-2 h-4 w-4 shrink-0" /></>)}
          </Button>
        </div>
      </div>
    </article>
  );
}

export default PublicProfileProductCard;
