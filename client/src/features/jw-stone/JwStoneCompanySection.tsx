import {
  ArrowUpRight,
  Facebook,
  Instagram,
  MapPin,
  ShieldCheck,
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
 * Editorial company close for the JW Stone 2.0 profile. Direct contact stays
 * inside Express Direct Connect; this section keeps only company, visit, social,
 * and community information.
 */
export function JwStoneCompanySection() {
  const { about, founderStory, address, socials } = JW_STONE_PUBLIC_IDENTITY;
  const { profileActions } = useJwStoneProfileContext();

  return (
    <section
      id="about-jw-stone"
      data-testid="jw-company-identity"
      aria-labelledby="jw-company-heading"
      className={`relative overflow-hidden border-t ${jw.border} ${jw.surface} ${jw.scrollTarget}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--jw-mark),transparent)] opacity-60"
      />

      <div className="mx-auto max-w-[1500px] px-5 py-14 sm:px-9 sm:py-16 lg:px-12 lg:py-20">
        <div
          data-testid="jw-company-editorial-layout"
          className="grid gap-12 xl:grid-cols-[minmax(0,1.7fr)_minmax(350px,0.72fr)] xl:gap-16 2xl:gap-20"
        >
          <div className="min-w-0">
            <div className="max-w-4xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--jw-mark)]">
                Company
              </p>
              <h2
                id="jw-company-heading"
                className="mt-4 font-editorial text-4xl leading-none tracking-tight text-[var(--jw-ink)] sm:text-5xl lg:text-[3.6rem]"
              >
                About JW Stone
              </h2>
              <span
                aria-hidden="true"
                className="mt-6 block h-0.5 w-20 bg-[var(--jw-mark)]"
              />
              <p className="mt-6 max-w-3xl text-base leading-8 text-[var(--jw-muted)] sm:text-lg sm:leading-9">
                {about}
              </p>
            </div>

            <article
              data-testid="jw-founder-story"
              className={`relative mt-10 overflow-hidden rounded-[1.5rem] border bg-[var(--jw-bg)] p-6 shadow-[0_24px_70px_rgba(42,39,36,0.08)] sm:p-8 lg:mt-12 lg:p-10 ${jw.border}`}
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-1 bg-[var(--jw-mark)]"
              />
              <div className="grid gap-7 sm:grid-cols-[minmax(190px,0.42fr)_minmax(0,1fr)] sm:gap-10 lg:gap-12">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--jw-mark)]">
                    Original founder story
                  </p>
                  <h3 className="mt-4 font-editorial text-3xl leading-[1.02] tracking-tight text-[var(--jw-ink)] sm:text-4xl">
                    Our Journey to Excellence
                  </h3>
                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--jw-secondary)]">
                    Founded 2017 · Pensacola, Florida
                  </p>
                </div>
                <p className="text-base leading-8 text-[var(--jw-muted)] sm:text-lg sm:leading-9">
                  {founderStory}
                </p>
              </div>
            </article>
          </div>

          <aside className={`min-w-0 xl:border-l xl:pl-10 2xl:pl-12 ${jw.border}`}>
            <div className="space-y-5 xl:sticky xl:top-[calc(4.25rem+2rem)]">
              {profileActions ? (
                <section
                  data-testid="jw-tradescout-profile-actions"
                  className={`rounded-[1.5rem] border bg-[var(--jw-bg)] p-5 shadow-[0_18px_55px_rgba(42,39,36,0.08)] sm:p-6 ${jw.border}`}
                >
                  <div className="mb-4 flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--jw-accent)]/25 text-[var(--jw-ink)]">
                      <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--jw-mark)]">
                        TradeScout profile
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--jw-muted)]">
                        Recommend, save, or share JW Stone.
                      </p>
                    </div>
                  </div>
                  <div className="[&_[data-testid=public-profile-identity]]:hidden [&_[data-testid=public-profile-account-card]]:hidden [&>div]:!rounded-none [&>div]:!border-0 [&>div]:!bg-transparent [&>div]:!p-0 [&>div]:!shadow-none [&>div>p:first-child]:hidden">
                    {profileActions}
                  </div>
                </section>
              ) : null}

              <section
                data-testid="jw-company-contact-card"
                className={`overflow-hidden rounded-[1.5rem] border bg-[var(--jw-bg)] shadow-[0_18px_55px_rgba(42,39,36,0.07)] ${jw.border}`}
              >
                <div
                  id="jw-stone-location"
                  className={`p-5 sm:p-6 ${jw.scrollTarget}`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--jw-mark)]">
                    Pensacola, Florida
                  </p>
                  <h3 className="mt-2 font-editorial text-3xl leading-none text-[var(--jw-ink)]">
                    Visit JW Stone
                  </h3>
                  <address className="mt-5 not-italic">
                    <div
                      className={`flex min-h-20 items-center gap-3 rounded-2xl border bg-[var(--jw-surface)] px-4 py-3 text-left ${jw.border}`}
                    >
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--jw-accent)]/25 text-[var(--jw-ink)]">
                        <MapPin className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-semibold leading-6 text-[var(--jw-ink)]">
                        <span className="block">{address.streetAddress}</span>
                        <span className="block text-[var(--jw-muted)]">
                          {address.addressLocality}, {address.addressRegion} {address.postalCode}
                        </span>
                      </span>
                    </div>
                  </address>
                </div>

                <div
                  id="jw-stone-socials"
                  className={`border-t p-5 sm:p-6 ${jw.border} ${jw.scrollTarget}`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--jw-mark)]">
                    Official channels
                  </p>
                  <h3 className="mt-2 font-editorial text-3xl leading-none text-[var(--jw-ink)]">
                    Follow JW Stone
                  </h3>
                  <ul
                    className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-1"
                    aria-label="JW Stone social media"
                  >
                    {socials.map((social) => {
                      const Icon = SOCIAL_ICONS[social.id];
                      const content = (
                        <>
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--jw-border)] bg-[var(--jw-bg)] text-[var(--jw-ink)]">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block text-sm font-bold text-[var(--jw-ink)]">
                              {social.label}
                            </span>
                            <span className="block truncate text-xs font-medium text-[var(--jw-muted)]">
                              {social.publicHandle}
                            </span>
                          </span>
                        </>
                      );
                      const socialClassName = `flex min-h-14 items-center gap-3 rounded-2xl border bg-[var(--jw-surface)] px-4 py-3 ${jw.border}`;

                      return (
                        <li key={social.id} className="min-w-0">
                          <a
                            href={social.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`jw-social-${social.id}`}
                            aria-label={`Open JW Stone on ${social.label}`}
                            className={`${socialClassName} group transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-[var(--jw-mark)] hover:shadow-[0_12px_30px_rgba(42,39,36,0.08)]`}
                          >
                            {content}
                            <ArrowUpRight
                              className="h-4 w-4 shrink-0 text-[var(--jw-mark)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                              aria-hidden="true"
                            />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
