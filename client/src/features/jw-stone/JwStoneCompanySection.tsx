import {
  Facebook,
  Instagram,
  MapPin,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { JW_STONE_PUBLIC_IDENTITY } from "@shared/jwStonePresentation";
import { useJwStoneProfileContext } from "./JwStoneProfileContext";
import { jw } from "./brand";

const SOCIAL_ICONS: Record<
  (typeof JW_STONE_PUBLIC_IDENTITY.socials)[number]["id"],
  LucideIcon
> = {
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
};

/**
 * JW Stone 2.0 keeps its current company presentation while receiving the
 * standard TradeScout profile actions from ProfileSiteView.
 */
export function JwStoneCompanySection() {
  const { about, founderStory, address, socials } = JW_STONE_PUBLIC_IDENTITY;
  const { profileActions } = useJwStoneProfileContext();

  return (
    <section
      id="about-jw-stone"
      data-testid="jw-company-identity"
      aria-labelledby="jw-company-heading"
      className={`border-t ${jw.border} ${jw.surface} ${jw.scrollTarget}`}
    >
      <div className="mx-auto grid max-w-[1600px] gap-10 px-5 py-12 sm:px-9 sm:py-14 lg:grid-cols-3 lg:gap-14 lg:px-12 lg:py-16">
        <div className="lg:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--jw-mark)]">
            Company
          </p>
          <h2
            id="jw-company-heading"
            className="mt-3 font-editorial text-3xl tracking-tight text-[var(--jw-ink)] sm:text-4xl"
          >
            About JW Stone
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--jw-muted)] sm:text-lg sm:leading-8">
            {about}
          </p>

          <div
            data-testid="jw-founder-story"
            className={`mt-8 max-w-4xl border-t pt-8 sm:mt-10 sm:pt-10 ${jw.border}`}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--jw-mark)]">
              Original founder story
            </p>
            <h3 className="mt-3 font-editorial text-2xl tracking-tight text-[var(--jw-ink)] sm:text-3xl">
              Our Journey to Excellence
            </h3>
            <p className="mt-4 text-base leading-7 text-[var(--jw-muted)] sm:text-lg sm:leading-8">
              {founderStory}
            </p>
          </div>
        </div>

        <div
          className={`space-y-8 border-t pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0 ${jw.border}`}
        >
          {profileActions ? (
            <div data-testid="jw-tradescout-profile-actions">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--jw-mark)]">
                TradeScout profile
              </p>
              {profileActions}
            </div>
          ) : null}

          <div id="jw-stone-location" className={jw.scrollTarget}>
            <h3 className="font-editorial text-2xl text-[var(--jw-ink)]">Visit JW Stone</h3>
            <address className="mt-4 not-italic">
              <div className="flex items-start gap-3 text-sm font-semibold leading-6 text-[var(--jw-ink)]">
                <MapPin
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--jw-mark)]"
                  aria-hidden="true"
                />
                <span className="flex-1">
                  <span className="block">{address.streetAddress}</span>
                  <span className="block">
                    {address.addressLocality}, {address.addressRegion} {address.postalCode}
                  </span>
                </span>
              </div>
            </address>
          </div>

          <div id="jw-stone-socials" className={jw.scrollTarget}>
            <h3 className="font-editorial text-2xl text-[var(--jw-ink)]">Follow JW Stone</h3>
            <ul className="mt-4 grid grid-cols-2 gap-2" aria-label="JW Stone social media">
              {socials.map((social) => {
                const Icon = SOCIAL_ICONS[social.id];
                const content = (
                  <>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>
                      <span className="block font-semibold">{social.label}</span>
                      <span className="block text-xs text-[var(--jw-muted)]">
                        {social.publicHandle}
                      </span>
                    </span>
                  </>
                );

                return (
                  <li key={social.id}>
                    {social.id === "youtube" ? (
                      <a
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="jw-social-youtube"
                        aria-label="Watch JW Stone on YouTube"
                        className={`flex min-h-11 w-full items-center justify-center gap-2 border px-3 text-sm transition-colors hover:bg-[var(--jw-bg)] ${jw.border}`}
                      >
                        {content}
                      </a>
                    ) : (
                      <div
                        className={`flex min-h-11 w-full items-center justify-center gap-2 border px-3 text-sm ${jw.border}`}
                      >
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
