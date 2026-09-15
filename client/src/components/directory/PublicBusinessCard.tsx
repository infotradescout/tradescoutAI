import { ArrowUpRight, Building2, ChevronDown, MapPin, Star } from "lucide-react";
import { Link } from "wouter";
import { ShareButton } from "@/components/ShareButton";
import {
  readPublicBusinessImportedRating,
  type PublicDirectoryBusiness,
} from "@shared/publicBusinessCard";
import { sanitizePublicProfileText } from "@shared/publicListingSafety";

/** Business discovery, not an inventory card. All contact remains on the existing profile path. */
export function PublicBusinessCard({ business }: { business: PublicDirectoryBusiness }) {
  const card = business.card;
  const name = sanitizePublicProfileText(business.name, 200) || "Business profile";
  const category = sanitizePublicProfileText(card?.category, 100);
  const tagline = sanitizePublicProfileText(card?.tagline, 180);
  const description = sanitizePublicProfileText(card?.description, 1200);
  const services = Array.isArray(card?.services)
    ? [...new Set(card.services.map((value) => sanitizePublicProfileText(value, 100)).filter(Boolean))].slice(0, 12)
    : [];
  const countyLabels = [...new Set((business.counties || []).map((county) =>
    [sanitizePublicProfileText(county.name, 100), sanitizePublicProfileText(county.stateCode, 2)]
      .filter(Boolean).join(", ")
  ).filter(Boolean))].slice(0, 6);
  const city = sanitizePublicProfileText(card?.city, 100);
  const stateCode = sanitizePublicProfileText(card?.stateCode || business.counties?.[0]?.stateCode, 2);
  const location = city ? [city, stateCode].filter(Boolean).join(", ") : countyLabels[0] || stateCode;
  const rating = readPublicBusinessImportedRating(card?.importedRating?.average, card?.importedRating?.reviewCount);
  const destination = `/business/${encodeURIComponent(business.slug)}`;
  const moreDescription = description.length > 200;
  const moreServices = services.length > 4;
  const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-300";

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(135deg,rgba(249,115,22,0.08),rgba(15,23,42,0.98)_48%)] text-white shadow-lg transition-colors hover:border-orange-400/50 motion-reduce:transition-none"
      data-testid="public-business-card">
      <div className="flex min-w-0 items-start gap-4 border-b border-white/10 p-5 sm:p-6">
        <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-400/25 bg-orange-400/10 text-orange-300">
          <Building2 className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          {category ? <p className="mb-2 break-words text-xs font-bold uppercase leading-relaxed tracking-wide text-orange-300 [overflow-wrap:anywhere]">{category}</p> : null}
          <h3 className="text-xl font-bold leading-snug [overflow-wrap:anywhere] sm:text-2xl">
            <Link href={destination} className={`rounded-sm hover:underline underline-offset-4 ${focus}`}>{name}</Link>
          </h3>
          {location ? <p className="mt-3 flex items-start gap-1.5 text-sm text-slate-300">
            <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0 [overflow-wrap:anywhere]">{location}</span>
          </p> : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-5 p-5 sm:p-6">
        {tagline && tagline !== category ? <p className="text-base font-semibold leading-relaxed text-white [overflow-wrap:anywhere]">{tagline}</p> : null}
        {description && description !== tagline ? <p className="text-sm leading-7 text-slate-300 [overflow-wrap:anywhere]">
          {moreDescription ? `${description.slice(0, 200).trimEnd()}…` : description}
        </p> : null}

        {services.length > 0 ? <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Services</p>
          <ul aria-label={`${name} services`} className="flex min-w-0 flex-wrap gap-2">
            {services.slice(0, 4).map((service) => <li key={service} className="max-w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm leading-relaxed text-slate-200 [overflow-wrap:anywhere]">{service}</li>)}
          </ul>
        </div> : null}

        {rating ? <div className="rounded-xl border border-white/10 bg-black/15 px-4 py-3" data-testid="public-business-imported-rating">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <Star aria-hidden="true" className="h-4 w-4 text-amber-300" />
            <span className="font-bold text-white">{rating.average.toLocaleString(undefined, { maximumFractionDigits: 2 })} / 5</span>
            <span className="text-slate-300">from {rating.reviewCount.toLocaleString()} {rating.reviewCount === 1 ? "review" : "reviews"}</span>
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">Imported review rating · not TradeScout verification</p>
        </div> : null}

        {moreDescription || moreServices || countyLabels.length > 1 ? <details className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-md text-sm font-semibold text-orange-200 [&::-webkit-details-marker]:hidden ${focus}`}>
            More business details<ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" />
          </summary>
          <div className="space-y-4 pb-1 pt-3 text-sm leading-7 text-slate-300">
            {moreDescription ? <p className="[overflow-wrap:anywhere]">{description}</p> : null}
            {moreServices ? <div><p className="font-semibold text-white">More services</p><ul className="mt-2 flex flex-wrap gap-2">
              {services.slice(4).map((service) => <li key={service} className="max-w-full rounded-lg bg-white/5 px-3 py-1.5 [overflow-wrap:anywhere]">{service}</li>)}
            </ul></div> : null}
            {countyLabels.length > 1 ? <p className="[overflow-wrap:anywhere]"><span className="font-semibold text-white">Listed in: </span>{countyLabels.join(" · ")}</p> : null}
          </div>
        </details> : null}

        <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span title="Claim status does not establish professional verification.">{business.claimStatus === "claimed" ? "Claimed listing" : business.claimStatus === "unclaimed" ? "Unclaimed listing" : "Business listing"}</span>
            <span>TradeScout business directory</span>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <Link href={destination} aria-label={`View business: ${name}`} className={`flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-center text-sm font-bold text-slate-950 hover:bg-orange-400 ${focus}`}>
              View business<ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
            </Link>
            <ShareButton destination={destination} title={name} text={tagline || category || name} label="Share"
              className={`min-h-11 rounded-xl border-white/20 bg-white/5 px-3 text-white hover:bg-white/10 ${focus}`} />
          </div>
        </div>
      </div>
    </article>
  );
}

export default PublicBusinessCard;
