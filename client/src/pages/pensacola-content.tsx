import React, { type ReactNode } from "react";
import {
  PENSACOLA_DISCOVERY as content,
  PENSACOLA_PROJECTS,
  pensacolaProjectRequestHref,
  type PensacolaProjectKind,
} from "@shared/pensacolaDiscovery";
import { PENSACOLA_CLUSTERS, PENSACOLA_COUNTY_CODE } from "@/lib/pensacolaClusters";
import { LOCAL_BUSINESS_DISCOVERY } from "@/lib/popularSearchQueries";
import { ISSA_BUILD_HERO_POSTER } from "@shared/issaBuildProfile";

const primaryLink =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-ts-orange px-5 py-3 text-base font-semibold text-white hover:bg-ts-orange-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ts-orange";
const secondaryLink =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 px-5 py-3 text-base font-semibold text-white hover:bg-white/10";
type Props = { onStartRequest?: (kind: PensacolaProjectKind) => void };

function RequestLink({
  kind,
  onStartRequest,
  children,
}: Props & { kind: PensacolaProjectKind; children: ReactNode }) {
  return (
    <a
      href={pensacolaProjectRequestHref(kind)}
      className={primaryLink}
      onClick={(event) => {
        if (
          !onStartRequest ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        onStartRequest(kind);
      }}
    >
      {children}
    </a>
  );
}

/** One visible body for browsers and the initial server response. */
export default function PensacolaContent({ onStartRequest }: Props = {}) {
  return (
    <main
      data-seo-pensacola="true"
      className="mx-auto max-w-6xl space-y-10 px-4 py-10 text-white md:py-14"
    >
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <section className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-widest text-ts-orange">
            ISSA Build · Pensacola and surrounding areas
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            {content.heading}
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-white/80">{content.introduction}</p>
          <div className="flex flex-wrap gap-3">
            <RequestLink kind="project" onStartRequest={onStartRequest}>
              Start a Request
            </RequestLink>
            <a href={content.profileHref} className={secondaryLink}>
              See ISSA Build’s work
            </a>
          </div>
          <p className="text-sm text-white/70">
            Your kitchen and bathroom request goes to ISSA Build through TradeScout.
          </p>
        </section>
        <figure className="overflow-hidden rounded-2xl border border-white/15 bg-white/5">
          <a href={content.profileHref} aria-label="Explore ISSA Build’s onyx work">
            <img
              src={ISSA_BUILD_HERO_POSTER}
              alt="Onyx work from ISSA Build’s project portfolio"
              width={1280}
              height={720}
              className="aspect-video w-full object-cover"
            />
          </a>
          <figcaption className="px-5 py-3 text-sm text-white/75">
            Explore ISSA Build’s onyx work and material collections.
          </figcaption>
        </figure>
      </div>

      <section
        aria-label="Kitchen and bathroom services"
        className="grid items-start gap-6 md:grid-cols-2"
      >
        {content.projectKinds.map((kind) => {
          const project = PENSACOLA_PROJECTS[kind];
          return (
            <article
              key={kind}
              className="rounded-2xl border border-white/15 bg-white/5 p-6 md:p-8"
            >
              <h2 className="text-2xl font-bold">
                <a
                  href={`${content.profileHref}/services/${project.serviceSlug}`}
                  className="hover:text-ts-orange"
                >
                  {project.title}
                </a>
              </h2>
              <p className="mb-5 mt-3 leading-relaxed text-white/80">{project.description}</p>
              <RequestLink kind={kind} onStartRequest={onStartRequest}>
                {project.label}
              </RequestLink>
            </article>
          );
        })}
      </section>

      <section className="space-y-4 rounded-2xl border border-white/15 p-6 md:p-8">
        <h2 className="text-2xl font-bold">Start with your room and what you need.</h2>
        <p className="max-w-3xl leading-relaxed text-white/80">
          Include your city or ZIP, approximate dimensions, material or finish ideas and desired
          timing. Photos and plans help explain the project. ISSA Build can review the scope with
          you before a quote or schedule is confirmed.
        </p>
        <p className="text-sm text-white/70">
          The request form opens here. Add your name, email and phone so the TradeScout team can
          follow up on your ISSA Build inquiry.
        </p>
      </section>

      <section aria-labelledby="pensacola-questions" className="space-y-4">
        <h2 id="pensacola-questions" className="text-2xl font-bold">
          Before you request
        </h2>
        <div className="divide-y divide-white/15">
          {content.faqItems.map((item) => (
            <details key={item.question} className="py-4">
              <summary className="cursor-pointer text-lg font-semibold">{item.question}</summary>
              <p className="mt-3 max-w-4xl leading-relaxed text-white/75">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="space-y-4 border-t border-white/15 pt-8">
        <h2 className="text-2xl font-bold">Other local services in Escambia County</h2>
        <p className="text-white/75">
          For work outside kitchens and bathrooms, browse the wider TradeScout community.
        </p>
        <nav aria-label="Pensacola local services" className="flex flex-wrap gap-2">
          {PENSACOLA_CLUSTERS.filter((cluster) => cluster.slug !== "kitchen-remodel").map(
            (cluster) => (
              <a
                key={cluster.slug}
                href={`/pensacola/${cluster.slug}`}
                className="rounded-lg border border-white/20 px-4 py-3 text-sm hover:border-ts-orange"
              >
                {cluster.shortLabel}
              </a>
            )
          )}
        </nav>
        <div className="flex flex-wrap gap-3">
          <a href={LOCAL_BUSINESS_DISCOVERY.pensacolaRequestHref} className={secondaryLink}>
            Request other local work
          </a>
          <a
            href={`/direct-connect?county=${PENSACOLA_COUNTY_CODE}&source=pensacola-launch&intent=local_search`}
            className={secondaryLink}
          >
            Browse local businesses
          </a>
        </div>
        <p className="pt-3 text-sm text-white/70">
          Run a local business?{" "}
          <a
            href={`/claim-my-business?stateCode=FL&countyFips=${PENSACOLA_COUNTY_CODE}&source=pensacola`}
            className="text-ts-orange hover:underline"
          >
            Claim or create your business
          </a>
          {" · "}
          <a
            href={`/create-account?source=pensacola-launch&county=${PENSACOLA_COUNTY_CODE}`}
            className="text-ts-orange hover:underline"
          >
            Create a free account
          </a>
        </p>
      </section>
    </main>
  );
}
