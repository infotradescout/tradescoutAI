import { ArrowUpRight, Building2, ShieldCheck } from "lucide-react";
import {
  RED_GRANITI_BUSINESS_NAME,
  RED_GRANITI_LOGO_URL,
  RED_GRANITI_PROFILE_SLUG,
} from "@shared/redGranitiProfile";
import { getCanonicalAppOrigin } from "@/lib/canonicalOrigin";
import { jw } from "./brand";

export function JwStoneSourcePartnersSection({
  onStartRequest,
}: {
  onStartRequest: () => void;
}) {
  const redGranitiProfileUrl = `${getCanonicalAppOrigin()}/u/${RED_GRANITI_PROFILE_SLUG}`;

  return (
    <section
      aria-labelledby="jw-source-partners-heading"
      data-testid="jw-source-partners"
      className={`border-t ${jw.border} ${jw.surface}`}
    >
      <div className="mx-auto max-w-[1500px] px-5 py-12 sm:px-9 sm:py-14 lg:px-12 lg:py-16">
        <div className="mb-7 max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--jw-mark)]">
            Source partnerships
          </p>
          <h2
            id="jw-source-partners-heading"
            className="mt-3 font-editorial text-3xl leading-tight tracking-tight text-[var(--jw-ink)] sm:text-4xl"
          >
            New sources. Kept separate from available inventory.
          </h2>
          <p className="mt-4 text-sm leading-7 text-[var(--jw-muted)] sm:text-base">
            Source-company relationships and physical JW Stone inventory are tracked separately.
            Material is not shown as available at JW until it is received, verified, and added to the
            live collection.
          </p>
        </div>

        <article className="grid overflow-hidden rounded-[1.5rem] border border-[var(--jw-line)] bg-[var(--jw-bg)] shadow-[0_24px_70px_rgba(42,39,36,0.08)] lg:grid-cols-[minmax(240px,0.55fr)_minmax(0,1.45fr)]">
          <div className="flex min-h-[230px] items-center justify-center border-b border-[var(--jw-line)] bg-white p-10 lg:border-b-0 lg:border-r">
            <img
              src={RED_GRANITI_LOGO_URL}
              alt={`${RED_GRANITI_BUSINESS_NAME} logo`}
              className="h-32 w-32 object-contain sm:h-40 sm:w-40"
            />
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--jw-line)] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--jw-ink)]">
                <Building2 className="h-3.5 w-3.5 text-[var(--jw-mark)]" aria-hidden="true" />
                Source company
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--jw-mark)]/30 bg-[var(--jw-mark)]/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--jw-mark)]">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Exclusive first-cut distributor
              </span>
            </div>

            <h3 className="mt-5 font-editorial text-3xl tracking-tight text-[var(--jw-ink)] sm:text-4xl">
              {RED_GRANITI_BUSINESS_NAME}
            </h3>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--jw-muted)] sm:text-base">
              JW Stone is the exclusive first-cut distributor for R.E.D. Graniti stone. The source
              company, distribution right, canonical materials, and any future JW inventory remain
              separate records so customers see the right truth at every stage.
            </p>
            <p className="mt-3 text-xs leading-6 text-[var(--jw-muted)]">
              Geographic territory is not stated publicly until the confirmed scope is available.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href={redGranitiProfileUrl}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--jw-ink)] px-5 text-sm font-bold text-[var(--jw-ink)] transition-colors hover:bg-[var(--jw-ink)] hover:text-white"
              >
                View company profile
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={onStartRequest}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--jw-mark)] px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Start a first-cut request
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
