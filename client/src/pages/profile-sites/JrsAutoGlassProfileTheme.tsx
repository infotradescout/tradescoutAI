import type { ReactNode } from "react";
import { Link } from "wouter";
import { ShareButton } from "@/components/ShareButton";
import {
  buildProfileGalleryShareSearch,
  listProfileGalleryItems,
  type ResolvedProfileGalleryItem,
} from "@shared/profileGalleryShare";
import { JRS_AUTO_GLASS_GALLERY_BLOCKS } from "@shared/jrsAutoGlassProfile";
import {
  Camera,
  CarFront,
  ChevronRight,
  Clock3,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";

const services = [
  { icon: CarFront, label: "Windshield replacement" },
  { icon: Wrench, label: "Rock chip repair" },
  { icon: MapPin, label: "Mobile service" },
  { icon: ShieldCheck, label: "Auto glass installation" },
] as const;

const requestDetails = [
  { icon: CarFront, label: "Vehicle details" },
  { icon: ShieldCheck, label: "Damaged glass" },
  { icon: Camera, label: "Damage photos" },
  { icon: Clock3, label: "Timing and location" },
] as const;

type RecommendationEntry = {
  id: string;
  recommendationType: "positive" | "negative";
  comment: string;
  projectType: string | null;
  contractor: {
    companyName: string;
    canonicalBusinessProfileUrl?: string | null;
  };
};

type Props = {
  onDirectConnect: () => void;
  hasViewerSession: boolean;
  tradeScoutReturnHref: string;
  profileShareDestination: string;
  galleryItems?: ResolvedProfileGalleryItem[];
  sharedGallerySlug?: string | null;
  recommendationsDirectory?: RecommendationEntry[];
  profileItems?: ReactNode;
};

const assetRoot = "/images/businesses/jrs-auto-glass";
const defaultRecentWork = listProfileGalleryItems(JRS_AUTO_GLASS_GALLERY_BLOCKS);

export default function JrsAutoGlassProfileTheme({
  onDirectConnect,
  hasViewerSession,
  tradeScoutReturnHref,
  profileShareDestination,
  galleryItems = [],
  sharedGallerySlug = null,
  recommendationsDirectory = [],
  profileItems,
}: Props) {
  const publicRecommendations = recommendationsDirectory.filter(
    (entry) => entry.recommendationType === "positive"
  );
  const recentWork = galleryItems.length > 0 ? galleryItems.slice(0, 2) : defaultRecentWork;

  return (
    <main className="bg-black text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/95 backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-3xl grid-cols-[44px_1fr_44px] items-center px-2 sm:h-20 sm:grid-cols-[150px_1fr_150px] sm:px-4">
          <a
            href={tradeScoutReturnHref}
            aria-label={
              hasViewerSession
                ? "Close JR's Auto Glass and return to Direct Connect"
                : "Close JR's Auto Glass and return to TradeScout"
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </a>

          <div className="flex min-w-0 items-center justify-center" aria-label="JR's Auto Glass">
            <img
              src={`${assetRoot}/logo.webp`}
              alt="JR's Auto Glass"
              className="h-10 w-[120px] flex-none object-contain sm:h-14 sm:w-[180px]"
            />
          </div>

          <button
            type="button"
            onClick={onDirectConnect}
            aria-label="Make A Request with JR's Auto Glass"
            className="inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-full bg-ts-orange text-white transition-colors hover:bg-ts-orange-dark sm:w-auto sm:gap-2 sm:px-4"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden text-xs font-black sm:inline">Make A Request</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl bg-[#0d0d0d] sm:border-x sm:border-white/10">
        <section aria-label="JR's Auto Glass cover" className="border-b border-white/10 bg-black">
          <img
            src={`${assetRoot}/cover.webp`}
            alt="JR's Auto Glass"
            className="aspect-[1122/270] w-full object-cover"
          />
        </section>

        <section className="border-b border-white/10 px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-500">
                Mobile auto glass
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                JR&apos;s Auto Glass
              </h1>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-zinc-400">
                <MapPin className="h-4 w-4 flex-none text-red-500" />
                Ponchatoula, Louisiana
              </p>
            </div>
            <div className="hidden rounded-full border border-red-500/35 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-red-400 sm:block">
              Mobile service
            </div>
          </div>

          <button
            type="button"
            onClick={onDirectConnect}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ts-orange px-5 text-sm font-black text-white transition-colors hover:bg-ts-orange-dark"
          >
            Make A Request
            <ChevronRight className="h-4 w-4" />
          </button>
          <p className="mt-2 text-center text-[11px] font-medium text-zinc-500">
            Tell JR&apos;s what happened. Your contact details stay private.
          </p>
          <div className="mt-3 flex justify-center">
            <ShareButton
              destination={profileShareDestination}
              title="JR's Auto Glass"
              text="Mobile auto glass service in Ponchatoula, Louisiana"
              variant="ghost"
              className="text-zinc-300 hover:bg-white/10 hover:text-white"
              label="Share JR's"
            />
          </div>
        </section>

        <section className="border-b border-white/10 px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-black text-white">Services</h2>
            <p className="text-xs font-semibold text-zinc-500">All makes and models</p>
          </div>

          <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-white/10 sm:grid-cols-4">
            {services.map(({ icon: Icon, label }, index) => (
              <div
                key={label}
                className={`min-h-28 p-3.5 ${index % 2 === 0 ? "border-r border-white/10" : ""} ${index < 2 ? "border-b border-white/10 sm:border-b-0" : ""} ${index > 0 ? "sm:border-l sm:border-white/10" : ""} sm:border-r-0`}
              >
                <Icon className="h-5 w-5 text-red-500" />
                <p className="mt-5 text-sm font-bold leading-5 text-zinc-100">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-white/10 px-4 py-5 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-500">
                Recent work
              </p>
              <h2 className="mt-1 text-xl font-black text-white">Windshield replacement</h2>
            </div>
            <p className="text-xs font-semibold text-zinc-500">Before and after</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {recentWork.map((item, index) => {
              const isSharedItem = Boolean(item.slug && item.slug === sharedGallerySlug);
              return (
                <figure
                  id={item.slug ? `profile-gallery-${item.slug}` : undefined}
                  key={item.slug || item.imageUrl}
                  className={`relative overflow-hidden rounded-lg border bg-black ${
                    isSharedItem ? "border-ts-orange ring-2 ring-ts-orange/50" : "border-white/10"
                  }`}
                >
                  <img
                    src={item.imageUrl}
                    alt={item.imageAlt}
                    className="aspect-[4/3] h-full w-full object-cover"
                  />
                  <figcaption className="absolute bottom-2 left-2 rounded bg-red-600 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                    {index === 0 ? "Before" : index === 1 ? "After" : item.title}
                  </figcaption>
                  {item.slug ? (
                    <ShareButton
                      destination={`${profileShareDestination}${buildProfileGalleryShareSearch(item.slug)}`}
                      title={`${item.title} from JR's Auto Glass`}
                      text="See this recent auto glass work from JR's Auto Glass"
                      size="icon"
                      label=""
                      className="absolute right-2 top-2 border-white/20 bg-black/70 text-white hover:bg-black"
                    />
                  ) : null}
                </figure>
              );
            })}
          </div>
        </section>

        <section className="border-b border-white/10 px-4 py-5 sm:px-6">
          <h2 className="text-base font-black text-white">About JR&apos;s Auto Glass</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Mobile auto glass repair and installation serving Ponchatoula and surrounding areas.
            JR&apos;s handles windshield replacement, rock chip repair, and on-site auto glass
            service.
          </p>
        </section>

        <section className="border-b border-white/10 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-ts-orange" />
            <h2 className="text-base font-black text-white">Customer recommendations</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Recommendations from customers will appear here.
          </p>

          {publicRecommendations.length > 0 ? (
            <div className="mt-4 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
              {publicRecommendations.slice(0, 6).map((entry) => {
                const content = (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white">{entry.contractor.companyName}</p>
                      {entry.projectType ? (
                        <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-ts-orange">
                          {entry.projectType}
                        </p>
                      ) : null}
                      {entry.comment ? (
                        <p className="mt-2 text-sm leading-5 text-zinc-400">{entry.comment}</p>
                      ) : null}
                    </div>
                    {entry.contractor.canonicalBusinessProfileUrl ? (
                      <ChevronRight className="h-4 w-4 flex-none text-zinc-500" />
                    ) : null}
                  </>
                );

                return entry.contractor.canonicalBusinessProfileUrl ? (
                  <Link
                    key={entry.id}
                    href={entry.contractor.canonicalBusinessProfileUrl}
                    className="flex items-center gap-3 p-4 transition-colors hover:bg-white/5"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={entry.id} className="flex items-center gap-3 p-4">
                    {content}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3">
              <ShieldCheck className="h-4 w-4 flex-none text-red-500" />
              <p className="text-sm font-semibold text-zinc-300">
                You&apos;re here early. The first customer recommendations are coming soon.
              </p>
            </div>
          )}
        </section>

        {profileItems ? (
          <section className="border-b border-white/10 px-4 py-6 sm:px-6">{profileItems}</section>
        ) : null}

        <section id="request-details" className="scroll-mt-20 px-4 py-6 sm:px-6">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-ts-orange">
            Ready when you are
          </p>
          <h2 className="mt-1 text-xl font-black text-white">Send JR&apos;s the job details.</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            {requestDetails.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 text-sm font-semibold text-zinc-400"
              >
                <Icon className="h-4 w-4 flex-none text-ts-orange" />
                {label}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onDirectConnect}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ts-orange px-5 text-sm font-black text-white transition-colors hover:bg-ts-orange-dark"
          >
            Make A Request
            <ChevronRight className="h-4 w-4" />
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-zinc-500">
            JR&apos;s won&apos;t see your contact details unless they accept the request.
          </p>
        </section>
      </div>
    </main>
  );
}
