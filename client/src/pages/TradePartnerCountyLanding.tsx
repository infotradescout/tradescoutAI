import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";

type LandingData = {
  countySlug: string;
  countyName: string;
  stateCode: string;
  pageTitle: string;
  heroHeadline: string;
  heroSubhead: string;
  seatTermMonths: number;
  givebackSeatRevenuePct: number;
  countyVaultAffiliatePct: number;
  allowedCategories: string[];
};

type PartnerInterestPayload = {
  countySlug: string;
  businessName: string;
  serviceCategory: string;
  contactName: string;
  email: string;
  phone: string;
  message: string;
  acknowledgesExclusivity: boolean;
  acknowledgesTerm: boolean;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => String(item || "").trim()).filter((item) => item.length > 0))
  );
}

function cleanField(form: FormData, key: string, maxLen: number) {
  const raw = form.get(key);
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (trimmed.length > maxLen) return trimmed.slice(0, maxLen);
  return trimmed;
}

function parseCheckbox(form: FormData, key: string) {
  const raw = form.get(key);
  if (typeof raw !== "string") return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on";
}

function renderHeadlineWithAccent(headline: string): ReactNode {
  if (!headline.includes("{accent}")) return headline;

  const pairedPattern = /\{accent\}(.+?)\{accent\}/g;
  if (pairedPattern.test(headline)) {
    pairedPattern.lastIndex = 0;
    const parts: ReactNode[] = [];
    let cursor = 0;
    let match: RegExpExecArray | null = pairedPattern.exec(headline);

    while (match) {
      const start = match.index;
      const end = match.index + match[0].length;
      if (start > cursor) {
        parts.push(headline.slice(cursor, start));
      }
      parts.push(
        <span key={`${start}-${end}`} className="text-orange-500">
          {match[1]}
        </span>
      );
      cursor = end;
      match = pairedPattern.exec(headline);
    }

    if (cursor < headline.length) {
      parts.push(headline.slice(cursor));
    }

    return parts;
  }

  const split = headline.split("{accent}");
  return split.map((part, idx) =>
    idx === 1 ? (
      <span key={`accent-${idx}`} className="text-orange-500">
        {part}
      </span>
    ) : (
      <span key={`base-${idx}`}>{part}</span>
    )
  );
}

export default function TradePartnerCountyLanding() {
  const [, params] = useRoute("/tradepartners/:countySlug");
  const countySlug = (params as Record<string, string> | null)?.countySlug || "";

  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const title = useMemo(() => (data ? data.pageTitle : "Trade Partner"), [data]);

  useEffect(() => {
    let cancelled = false;

    const fetchLanding = async () => {
      setLoading(true);
      setLoadError(null);

      if (!countySlug) {
        setLoading(false);
        setLoadError("Missing county.");
        return;
      }

      const response = await fetch(
        `/api/tradepartner-landing/${encodeURIComponent(countySlug.toLowerCase())}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "include",
        }
      );

      if (cancelled) return;

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        setLoadError(String((errorBody as any)?.error || "Could not load page."));
        setLoading(false);
        return;
      }

      const payload = (await response.json()) as Partial<LandingData>;
      const normalized: LandingData = {
        countySlug: String(payload.countySlug || countySlug).toLowerCase(),
        countyName: String(payload.countyName || ""),
        stateCode: String(payload.stateCode || ""),
        pageTitle: String(payload.pageTitle || "Trade Partner"),
        heroHeadline: String(payload.heroHeadline || ""),
        heroSubhead: String(payload.heroSubhead || ""),
        seatTermMonths: Number(payload.seatTermMonths || 12),
        givebackSeatRevenuePct: Number(payload.givebackSeatRevenuePct || 50),
        countyVaultAffiliatePct: Number(payload.countyVaultAffiliatePct || 10),
        allowedCategories: toStringArray(payload.allowedCategories),
      };

      setData(normalized);
      setLoading(false);
    };

    fetchLanding().catch((error) => {
      if (cancelled) return;
      console.error("Failed to load tradepartner county landing:", error);
      setLoadError("Could not load page.");
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [countySlug]);

  useEffect(() => {
    document.title = title;
  }, [title]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (!data) return;

    const form = new FormData(event.currentTarget);
    const payload: PartnerInterestPayload = {
      countySlug: data.countySlug,
      businessName: cleanField(form, "businessName", 160),
      serviceCategory: cleanField(form, "serviceCategory", 120),
      contactName: cleanField(form, "contactName", 120),
      email: cleanField(form, "email", 200),
      phone: cleanField(form, "phone", 60),
      message: cleanField(form, "message", 2000),
      acknowledgesExclusivity: parseCheckbox(form, "acknowledgesExclusivity"),
      acknowledgesTerm: parseCheckbox(form, "acknowledgesTerm"),
    };

    setSubmitting(true);
    const response = await fetch("/api/partner-interest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    setSubmitting(false);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      setSubmitError(String((errorBody as any)?.error || "Submission failed."));
      return;
    }

    setSubmitted(true);
    event.currentTarget.reset();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-slate-300 flex items-center justify-center px-6">
        Loading...
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen bg-black text-slate-300 flex items-center justify-center px-6">
        <div className="max-w-lg w-full bg-neutral-900 border border-neutral-700 rounded-xl p-6">
          <h1 className="text-white text-xl font-semibold mb-2">Page unavailable</h1>
          <p className="text-slate-300">{loadError || "Unknown error"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-300">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="mb-12">
          <div className="text-sm uppercase tracking-wider text-slate-400 mb-3">
            {data.countyName}, {data.stateCode}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-5">
            {renderHeadlineWithAccent(data.heroHeadline)}
          </h1>
          <p className="max-w-2xl text-lg text-slate-300">{data.heroSubhead}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
            <StatCard label="Term" value={`${data.seatTermMonths} months`} />
            <StatCard label="Category seats" value="1 per category" />
            <StatCard label="Giveback allocation" value={`${data.givebackSeatRevenuePct}%`} />
            <StatCard label="County Vault" value={`${data.countyVaultAffiliatePct}%`} />
          </div>
        </div>

        <Section title="The local problem">
          <p className="mb-4">
            Most marketplaces treat local work like inventory. They extract value by reselling
            access and attention back to the people doing the work.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Money leaves the community instead of compounding locally</li>
            <li>Opportunity becomes pay-gated instead of merit-gated</li>
            <li>Trust gets fragmented across disconnected platforms</li>
          </ul>
        </Section>

        <Section title="The Community Builders model">
          <p className="mb-4">
            {data.countyName} Community Builders is a county-level system designed to keep
            opportunity accessible and keep reinvestment visible.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Free opportunity pathways for contractors</li>
            <li>No pay-per-lead extraction</li>
            <li>Public, measurable giveback as a built-in output</li>
          </ul>
        </Section>

        <Section title="Category exclusivity">
          <p className="mb-4">
            Partnership seats are limited by design to avoid noise and preserve clarity.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>One Official Partner per category in this county</li>
            <li>{data.seatTermMonths}-month term for operational stability</li>
            <li>Renewal priority for existing partners</li>
          </ul>
        </Section>

        <Section title="Embedded placement (not advertising)">
          <p className="mb-4">
            Partners are introduced as part of the system infrastructure without turning the
            experience into a billboard.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Explained during contractor onboarding ("how this stays free")</li>
            <li>Listed in a Trade Partner directory and resource pages</li>
            <li>Pinned community references where appropriate</li>
          </ul>
        </Section>

        <Section title="Recurring visibility & amplification">
          <p className="mb-4">
            Recognition is cumulative and consistent, designed to build familiarity over time.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Two spotlight mentions per month (county channels)</li>
            <li>Inclusion in documented giveback content</li>
            <li>Cross-platform distribution where Community Builders is active</li>
          </ul>
        </Section>

        <Section title="Community giveback engine">
          <p className="mb-4">
            A portion of seat revenue is allocated to visible local givebacks with public receipts.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Vehicle restorations</li>
            <li>Tool donations</li>
            <li>Emergency assistance</li>
            <li>Meal sponsorships</li>
            <li>Small business support</li>
          </ul>
        </Section>

        <Section title="County Vault impact model">
          <p className="mb-4">
            County Vault is the accountability mechanism: attribution, totals, and summaries that
            stay public.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              {data.countyVaultAffiliatePct}% of affiliate revenue is routed to the county vault
            </li>
            <li>Contributions are credited in the partner name</li>
            <li>Quarterly summaries show cumulative impact</li>
          </ul>
        </Section>

        <Section title="Financial alignment">
          <p className="mb-4">
            The practical benefit is familiarity and trust. Contractors meet partners inside the
            system before they need them.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Partners are introduced during onboarding</li>
            <li>Familiarity improves response rates and close rates</li>
            <li>Results are driven by fit and timing, not cold interruption</li>
          </ul>
        </Section>

        <Section title="Regional expansion strategy">
          <p className="mb-4">
            {data.countyName} is the pilot county. Expansion is added only after proof-of-concept
            performance is visible.
          </p>
          <p className="text-slate-400">
            Multi-county seats are reviewed after pilot operations demonstrate stable performance.
          </p>
        </Section>

        <Section title="Partnership request">
          <p className="mb-4">
            If your organization fits a category seat, submit a request below. We will review
            availability and follow up with operational terms.
          </p>
          <p className="text-slate-400">
            This is infrastructure alignment inside a county commerce system, not a campaign.
          </p>
        </Section>

        <div
          id="interest-form"
          className="mt-14 bg-neutral-900 border border-neutral-700 rounded-2xl p-8 md:p-10"
        >
          <h2 className="text-white text-2xl font-semibold mb-2">Request a category seat review</h2>
          <p className="text-slate-400 mb-8">
            Share the basics. We will confirm category availability and next steps.
          </p>

          {submitted ? (
            <div className="bg-green-900/40 border border-green-700 text-green-200 rounded-xl p-4">
              Received. We will follow up shortly.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
              {submitError ? (
                <div className="bg-red-900/40 border border-red-700 text-red-200 rounded-xl p-4">
                  {submitError}
                </div>
              ) : null}

              <Field label="Business name" name="businessName" required />
              <Field
                label="Service category"
                name="serviceCategory"
                required
                asSelect
                options={data.allowedCategories}
              />
              <Field label="Contact name" name="contactName" required />
              <Field label="Email" name="email" required type="email" />
              <Field label="Phone (optional)" name="phone" />
              <Field label="Notes (optional)" name="message" asTextarea />

              <div className="space-y-3 pt-2">
                <Checkbox
                  name="acknowledgesExclusivity"
                  label="I understand category seats are exclusive (one per category per county)."
                />
                <Checkbox
                  name="acknowledgesTerm"
                  label={`I understand the standard term is ${data.seatTermMonths} months.`}
                />
              </div>

              <button
                disabled={submitting}
                className="mt-3 inline-flex items-center justify-center bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:hover:bg-orange-500 text-white font-semibold px-7 py-3 rounded-xl"
              >
                {submitting ? "Submitting..." : "Submit request"}
              </button>
            </form>
          )}
        </div>

        <div className="mt-10 text-sm text-slate-500">
          {new Date().getFullYear()} TradeScout - {data.countyName} Community Builders
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5">
      <div className="text-slate-400 text-sm">{label}</div>
      <div className="text-white text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-10 border-t border-neutral-800">
      <h2 className="text-white text-2xl font-semibold mb-4">{title}</h2>
      <div className="text-slate-300 leading-relaxed">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  required,
  type = "text",
  asTextarea = false,
  asSelect = false,
  options = [],
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  asTextarea?: boolean;
  asSelect?: boolean;
  options?: string[];
}) {
  const baseClass =
    "w-full bg-black border border-neutral-700 focus:border-orange-500 focus:outline-none rounded-xl px-4 py-3 text-slate-100";

  if (asSelect && options.length > 0) {
    return (
      <div>
        <label className="block text-sm text-slate-300 mb-2">
          {label} {required ? <span className="text-orange-500">*</span> : null}
        </label>
        <select name={name} required={required} className={baseClass} defaultValue="">
          <option value="" disabled>
            Select...
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm text-slate-300 mb-2">
        {label} {required ? <span className="text-orange-500">*</span> : null}
      </label>
      {asTextarea ? (
        <textarea name={name} className={`${baseClass} min-h-[120px]`} />
      ) : (
        <input name={name} required={required} type={type} className={baseClass} />
      )}
    </div>
  );
}

function Checkbox({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-start gap-3 text-slate-300">
      <input
        name={name}
        type="checkbox"
        value="true"
        className="mt-1 h-5 w-5 accent-orange-500"
        required
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}
