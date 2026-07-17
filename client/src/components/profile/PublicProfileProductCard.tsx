import { ArrowUpRight, MapPin, PackageOpen } from "lucide-react";
import { Link } from "wouter";
import { ShareButton } from "@/components/ShareButton";
import { Button } from "@/components/ui/button";

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

/**
 * The shared card for things a business actually has for sale. Services,
 * properties, promotions, posts, and proof-of-work galleries deliberately use
 * their own presentations so customers never have to guess what is inventory.
 */
export function PublicProfileProductCard({
  title,
  destination,
  imageUrl,
  imageAlt,
  description,
  price,
  eyebrow,
  location,
  availability,
  shareText,
  actionLabel = "View item",
}: PublicProfileProductCardProps) {
  return (
    <article
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(0,0,0,0.2))] shadow-[0_16px_44px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1 hover:border-ts-orange/40 hover:shadow-[0_22px_55px_rgba(0,0,0,0.32)]"
      data-testid="public-profile-product-card"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-black/30">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={imageAlt || title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.16),transparent_58%)] px-6 text-center text-white/65">
            <PackageOpen className="h-8 w-8 text-ts-orange" />
            <p className="text-sm font-semibold text-white/80">Photo coming soon</p>
            <p className="text-xs text-white/50">The item details are ready in the meantime.</p>
          </div>
        )}

        {eyebrow ? (
          <span className="absolute left-3 top-3 max-w-[70%] truncate rounded-full border border-white/20 bg-black/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-md">
            {eyebrow}
          </span>
        ) : null}
        <ShareButton
          destination={destination}
          title={title}
          text={shareText}
          size="icon"
          label=""
          className="absolute right-3 top-3 rounded-full border-white/20 bg-black/70 text-white hover:bg-black"
        />
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="break-words text-base font-bold leading-snug text-white sm:text-lg">
              {title}
            </h3>
            {description ? (
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/65">
                {description}
              </p>
            ) : null}
          </div>
          {price ? (
            <p className="shrink-0 text-right text-base font-extrabold text-ts-orange sm:text-lg">
              {price}
            </p>
          ) : null}
        </div>

        {(location || availability) && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            {availability ? (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                {availability}
              </span>
            ) : null}
            {location ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-white/65">
                <MapPin className="h-3.5 w-3.5" />
                {location}
              </span>
            ) : null}
          </div>
        )}

        <Button
          asChild
          className="mt-5 min-h-11 w-full bg-white text-black hover:bg-ts-orange hover:text-white"
        >
          <Link href={destination} aria-label={`${actionLabel}: ${title}`}>
            {actionLabel}
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

export default PublicProfileProductCard;
