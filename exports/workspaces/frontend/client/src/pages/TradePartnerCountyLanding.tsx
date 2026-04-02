import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  CalendarClock,
  HandHeart,
  Heart,
  Lock,
  MapPinned,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";
import { formatTradeScoutTitle } from "@shared/brand";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import { SEOHelmet } from "@/components/SEOHelmet";
import "./trade-partner-county.css";

const LANDING_TEMPLATE_VERSION = "2026-02-21.4";

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

type TradePartnerPathInfo = {
  countySlug: string;
  categorySlug: string;
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

function normalizeCountySlug(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9-]{1,80}$/.test(normalized)) return "";
  return normalized;
}

function normalizeCategorySlug(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9-]{1,120}$/.test(normalized)) return "";
  return normalized;
}

function slugifyCategory(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function humanizeSlug(slug: string) {
  return slug
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ")
    .trim();
}

function derivePathInfo(pathname: string): TradePartnerPathInfo {
  const pathOnly = pathname.split(/[?#]/, 1)[0] || "";
  const match = /^\/tradepartners\/([^/]+)(?:\/([^/]+))?/i.exec(pathOnly);
  if (!match?.[1]) {
    return { countySlug: "", categorySlug: "" };
  }

  let countyRaw = match[1];
  let categoryRaw = match[2] || "";

  try {
    countyRaw = decodeURIComponent(countyRaw);
  } catch {
    // Keep raw value on malformed encoding.
  }

  try {
    categoryRaw = decodeURIComponent(categoryRaw);
  } catch {
    // Keep raw value on malformed encoding.
  }

  return {
    countySlug: normalizeCountySlug(countyRaw),
    categorySlug: normalizeCategorySlug(categoryRaw),
  };
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
        <span key={`${start}-${end}`} className="tp-accent-text">
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
      <span key={`accent-${idx}`} className="tp-accent-text">
        {part}
      </span>
    ) : (
      <span key={`base-${idx}`}>{part}</span>
    )
  );
}

function scrollToForm() {
  if (typeof document === "undefined") return;
  const element = document.getElementById("interest-form");
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function TradePartnerCountyLanding({
  countySlug: countySlugProp,
}: {
  countySlug?: string;
} = {}) {
  const [location] = useLocation();

  const pathInfo = useMemo(() => {
    if (countySlugProp) {
      return {
        countySlug: normalizeCountySlug(String(countySlugProp || "")),
        categorySlug: "",
      };
    }

    const fromLocation = derivePathInfo(String(location || ""));
    if (fromLocation.countySlug) return fromLocation;

    if (typeof window !== "undefined") {
      return derivePathInfo(window.location.pathname);
    }

    return { countySlug: "", categorySlug: "" };
  }, [countySlugProp, location]);

  const countySlug = pathInfo.countySlug;
  const categorySlug = pathInfo.categorySlug;
  const seoCanonicalPath = countySlug
    ? categorySlug
      ? `/tradepartners/${countySlug}/${categorySlug}`
      : `/tradepartners/${countySlug}`
    : "/tradepartners";
  const seoCanonical = `https://www.thetradescout.com${seoCanonicalPath}`;

  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedCategoryLabel = useMemo(() => {
    if (!categorySlug || !data) return "";

    const exactMatch = data.allowedCategories.find(
      (category) => slugifyCategory(category) === categorySlug
    );
    return exactMatch || humanizeSlug(categorySlug);
  }, [categorySlug, data]);

  const selectedCategoryAllowed = useMemo(() => {
    if (!categorySlug || !data) return true;
    if (data.allowedCategories.length === 0) return true;
    return data.allowedCategories.some((category) => slugifyCategory(category) === categorySlug);
  }, [categorySlug, data]);

  const title = useMemo(() => {
    if (!data) return "Trade Partner";
    if (selectedCategoryLabel) {
      return `${selectedCategoryLabel} Partner | ${data.countyName}, ${data.stateCode}`;
    }
    return data.pageTitle;
  }, [data, selectedCategoryLabel]);
  const seoTitle = data ? `${title} | TradeScout` : "County Trade Partner Program | TradeScout";
  const seoDescription = data
    ? selectedCategoryLabel
      ? `${selectedCategoryLabel} partner placement for ${data.countyName}, ${data.stateCode}. Apply for county category availability and local giveback reporting.`
      : `${data.countyName}, ${data.stateCode} TradePartner county program with category-based partner placements and county-level giveback visibility.`
    : "TradeScout county TradePartner landing with category-based local partner opportunities.";

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);

    const fetchLanding = async () => {
      setLoading(true);
      setLoadError(null);
      setData(null);

      if (!countySlug) {
        setLoadError("Missing county.");
        return;
      }

      const response = await fetch(buildApiUrl(`/api/tradepartner-landing/${countySlug}`), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (cancelled) return;

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        if (!errorText) {
          setLoadError("Could not load page.");
          return;
        }

        try {
          const errorBody = JSON.parse(errorText);
          setLoadError(String((errorBody as any)?.error || "Could not load page."));
        } catch {
          setLoadError(errorText.slice(0, 220));
        }
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
    };

    fetchLanding()
      .catch((error) => {
        if (cancelled) return;
        const errorName = String((error as any)?.name || "");
        if (errorName === "AbortError") {
          setLoadError("Request timed out. Refresh and try again.");
          return;
        }
        const message = String((error as any)?.message || "").toLowerCase();
        if (message.includes("failed to fetch") || message.includes("network")) {
          setLoadError("Network error while loading this county page.");
          return;
        }
        setLoadError("Could not load page.");
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [countySlug]);

  useEffect(() => {
    document.title = formatTradeScoutTitle(`${title} | TradeScout`);
  }, [title]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (!data) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    let serviceCategory = cleanField(form, "serviceCategory", 120);
    if (!serviceCategory && selectedCategoryLabel) {
      serviceCategory = selectedCategoryLabel;
    }

    const payload: PartnerInterestPayload = {
      countySlug: data.countySlug,
      businessName: cleanField(form, "businessName", 160),
      serviceCategory,
      contactName: cleanField(form, "contactName", 120),
      email: cleanField(form, "email", 200),
      phone: cleanField(form, "phone", 60),
      message: cleanField(form, "message", 2000),
      acknowledgesExclusivity: parseCheckbox(form, "acknowledgesExclusivity"),
      acknowledgesTerm: parseCheckbox(form, "acknowledgesTerm"),
    };

    try {
      setSubmitting(true);
      const response = await fetch(buildApiUrl("/api/partner-interest"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        setSubmitError(String((errorBody as any)?.error || "Submission failed."));
        return;
      }

      setSubmitted(true);
      formElement?.reset?.();
    } catch {
      setSubmitError("Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="tp-county-page">
        <SEOHelmet title={seoTitle} description={seoDescription} canonical={seoCanonical} />
        <div className="tp-container">
          <div className="tp-status-card">
            <p className="tp-kicker">Trade Partner Program</p>
            <h1>Loading county page</h1>
            <p>Fetching county settings and partnership details.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="tp-county-page">
        <SEOHelmet title={seoTitle} description={seoDescription} canonical={seoCanonical} />
        <div className="tp-container">
          <div className="tp-status-card tp-status-card-error">
            <p className="tp-kicker">Trade Partner Program</p>
            <h1>Page unavailable</h1>
            <p>{loadError || "Unknown error."}</p>
          </div>
        </div>
      </div>
    );
  }

  const countyLabel = `${data.countyName}, ${data.stateCode}`;
  const selectedCategoryTitle = selectedCategoryLabel || "your category";

  const heroHeadline = selectedCategoryLabel
    ? `Become the {accent}${selectedCategoryLabel}{accent} partner for ${data.countyName} County`
    : data.heroHeadline;

  const heroSubhead = selectedCategoryLabel
    ? `Apply for the exclusive ${selectedCategoryLabel} county category slot. If approved, your business is the official category partner for ${data.seatTermMonths} months with visible local giveback attribution.`
    : data.heroSubhead;

  const processSteps = [
    "Submit your business and service category details.",
    "We confirm category availability for this county.",
    "If approved, your category is reserved for the full term.",
    "Your business is added to county partner placement and County Vault reporting.",
  ];

  return (
    <div className="tp-county-page">
      <SEOHelmet title={seoTitle} description={seoDescription} canonical={seoCanonical} />
      <div className="tp-container">
        <header className="tp-hero tp-fade-up">
          <div className="tp-hero-left">
            <p className="tp-kicker">
              <MapPinned size={14} />
              {countyLabel}
            </p>
            <h1>{renderHeadlineWithAccent(heroHeadline)}</h1>
            <p className="tp-subhead">{heroSubhead}</p>
            <div className="tp-hero-actions">
              <button type="button" className="tp-btn-primary" onClick={scrollToForm}>
                Apply now
                <ArrowRight size={16} />
              </button>
              <button type="button" className="tp-btn-ghost" onClick={scrollToForm}>
                See terms
              </button>
            </div>
          </div>
          <div className="tp-hero-right">
            <MetricCard label="Term" value={`${data.seatTermMonths} months`} />
            <MetricCard label="Category slots" value="1 per category" />
            <MetricCard label="Giveback allocation" value={`${data.givebackSeatRevenuePct}%`} />
            <MetricCard label="County Vault" value={`${data.countyVaultAffiliatePct}%`} />
          </div>
        </header>

        <div className="tp-layout">
          <div className="tp-content tp-fade-up tp-delay-1">
            <section className="tp-panel">
              <h2>The local problem</h2>
              <div className="tp-problem-grid">
                <ProblemCard
                  icon={<TrendingUp size={18} />}
                  title="Money leaves the community"
                  text="Most marketplaces extract local value by reselling access and attention."
                />
                <ProblemCard
                  icon={<Lock size={18} />}
                  title="Opportunity becomes pay-gated"
                  text="Local merit gets replaced by whoever can buy the most visibility."
                />
                <ProblemCard
                  icon={<Users size={18} />}
                  title="Trust gets fragmented"
                  text="Disconnected tools prevent steady local relationships and accountability."
                />
              </div>
            </section>

            <section className="tp-panel">
              <h2>The Community Builders model</h2>
              <p>
                {data.countyName} County Community Builders keeps opportunity open while keeping
                reinvestment visible.
              </p>
              <div className="tp-feature-grid">
                <FeatureCard
                  icon={<Zap size={18} />}
                  title="Free opportunity pathways"
                  text="Contractor opportunity remains open with no pay-per-lead extraction."
                />
                <FeatureCard
                  icon={<Shield size={18} />}
                  title="No lead resale"
                  text="Partnerships fund infrastructure, not lead flipping."
                />
                <FeatureCard
                  icon={<Heart size={18} />}
                  title="Local giveback engine"
                  text="Giveback is a built-in output with public tracking."
                />
              </div>
            </section>

            <section className="tp-panel">
              <h2>Category exclusivity</h2>
              <p>
                One official partner is selected per category to keep quality high and noise low.
                {selectedCategoryLabel ? ` You are applying for ${selectedCategoryTitle}.` : ""}
              </p>
              <ol className="tp-step-list">
                {processSteps.map((step) => (
                  <li key={step}>
                    <Sparkles size={14} />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <div className="tp-chip-row">
                <span className="tp-chip">
                  <Award size={14} />
                  One partner per category
                </span>
                <span className="tp-chip">
                  <CalendarClock size={14} />
                  {data.seatTermMonths}-month term
                </span>
              </div>
            </section>

            <section className="tp-panel">
              <h2>Placement and amplification</h2>
              <div className="tp-split-grid">
                <div>
                  <h3>Embedded placement</h3>
                  <ul>
                    <li>Introduced during onboarding as infrastructure support.</li>
                    <li>Listed in county partner and resource contexts.</li>
                    <li>Positioned for trust before buying intent appears.</li>
                  </ul>
                </div>
                <div>
                  <h3>Recurring visibility</h3>
                  <ul>
                    <li>Consistent monthly mention cadence.</li>
                    <li>Included in documented giveback content.</li>
                    <li>Cross-channel distribution where Community Builders is active.</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="tp-panel">
              <h2>County Vault impact model</h2>
              <p>
                County Vault is the accountability layer. {data.countyVaultAffiliatePct}% of
                affiliate revenue is routed to the county vault with public attribution in the
                partner name.
              </p>
              <div className="tp-chip-row">
                <span className="tp-chip">
                  <HandHeart size={14} />
                  {data.givebackSeatRevenuePct}% seat revenue allocated to giveback
                </span>
                <span className="tp-chip">
                  <Wallet size={14} />
                  Quarterly impact summaries remain public
                </span>
              </div>
            </section>
          </div>

          <aside className="tp-sidebar tp-fade-up tp-delay-2">
            <section className="tp-panel tp-form-panel" id="interest-form">
              <h2>Apply for county category partner slot</h2>
              <p className="tp-form-intro">
                Submit your business details. We will confirm category availability and send the
                exact operating terms.
              </p>

              {selectedCategoryLabel ? (
                <div className="tp-category-callout">
                  Applying for: <strong>{selectedCategoryLabel}</strong>
                </div>
              ) : null}

              {!selectedCategoryAllowed ? (
                <div className="tp-submit-error">
                  This category is not currently listed as open in this county. You can still submit
                  and we will confirm availability.
                </div>
              ) : null}

              {data.allowedCategories.length > 0 ? (
                <div className="tp-allowed-categories">
                  {data.allowedCategories.map((category) => (
                    <span key={category}>{category}</span>
                  ))}
                </div>
              ) : null}

              {submitted ? (
                <div className="tp-submit-success">
                  <strong>Request received.</strong>
                  <span>We will follow up after verifying category availability.</span>
                  <button
                    type="button"
                    className="tp-btn-ghost"
                    onClick={() => {
                      setSubmitted(false);
                      setSubmitError(null);
                    }}
                  >
                    Submit another application
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="tp-form">
                  {submitError ? <p className="tp-submit-error">{submitError}</p> : null}

                  <Field label="Business name" name="businessName" required />
                  <Field
                    label="Service category"
                    name="serviceCategory"
                    required
                    asSelect
                    options={data.allowedCategories}
                    defaultValue={selectedCategoryAllowed ? selectedCategoryLabel : ""}
                  />
                  <Field label="Contact name" name="contactName" required />
                  <Field label="Email" name="email" type="email" required />
                  <Field label="Phone (optional)" name="phone" />
                  <Field label="Notes (optional)" name="message" asTextarea />

                  <div className="tp-consent-group">
                    <Checkbox
                      name="acknowledgesExclusivity"
                      label="I understand one business is selected per category in this county."
                    />
                    <Checkbox
                      name="acknowledgesTerm"
                      label={`I understand the standard term is ${data.seatTermMonths} months.`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="tp-btn-primary tp-submit-btn"
                  >
                    {submitting ? "Submitting..." : "Send application"}
                    {!submitting ? <ArrowRight size={16} /> : null}
                  </button>
                </form>
              )}
            </section>
          </aside>
        </div>

        <footer className="tp-footer">
          {new Date().getFullYear()} TradeScout | {data.countyName} County Community Builders | v
          {LANDING_TEMPLATE_VERSION}
        </footer>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="tp-metric-card">
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}

function ProblemCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="tp-problem-card">
      <div className="tp-feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function FeatureCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="tp-feature-card">
      <div className="tp-feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
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
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  asTextarea?: boolean;
  asSelect?: boolean;
  options?: string[];
  defaultValue?: string;
}) {
  const normalizedDefault = defaultValue ? String(defaultValue) : "";

  return (
    <label className="tp-field">
      <span>
        {label} {required ? <em>*</em> : null}
      </span>
      {asSelect && options.length > 0 ? (
        <select
          name={name}
          required={required}
          defaultValue={normalizedDefault || ""}
          className="tp-select"
        >
          <option value="" disabled>
            Select category
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : asTextarea ? (
        <textarea
          name={name}
          className="tp-textarea"
          defaultValue={normalizedDefault || undefined}
        />
      ) : (
        <input
          name={name}
          required={required}
          type={type}
          className="tp-input"
          defaultValue={normalizedDefault || undefined}
        />
      )}
    </label>
  );
}

function Checkbox({ name, label }: { name: string; label: string }) {
  return (
    <label className="tp-checkbox">
      <input name={name} type="checkbox" value="true" required />
      <span>{label}</span>
    </label>
  );
}
