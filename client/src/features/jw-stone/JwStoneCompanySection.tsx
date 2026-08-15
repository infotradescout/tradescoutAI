import {
  Facebook,
  Instagram,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { JW_STONE_PUBLIC_IDENTITY } from "@shared/jwStonePresentation";
import { jw } from "./brand";

const SOCIAL_ICONS: Record<
  (typeof JW_STONE_PUBLIC_IDENTITY.socials)[number]["id"],
  LucideIcon
> = {
  instagram: Instagram,
  facebook: Facebook,
};

/**
 * Public company identity belongs on the marketplace itself, not behind
 * Direct Connect. The address and official account names stay visible, while
 * every outbound/contact action remains inside the gated request flow.
 */
export function JwStoneCompanySection() {
  const { about, address, socials } = JW_STONE_PUBLIC_IDENTITY;

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
        </div>

        <div
          className={`space-y-8 border-t pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0 ${jw.border}`}
        >
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
                return (
                  <li key={social.id}>
                    <div
                      className={`flex min-h-11 w-full items-center justify-center gap-2 border px-3 text-sm ${jw.border}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>
                        <span className="block font-semibold">{social.label}</span>
                        <span className="block text-xs text-[var(--jw-muted)]">
                          {social.publicHandle}
                        </span>
                      </span>
                    </div>
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
