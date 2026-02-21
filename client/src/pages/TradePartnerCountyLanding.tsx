import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  HandHeart,
  MapPinned,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useLocation } from "wouter";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import "./trade-partner-county.css";

const LANDING_TEMPLATE_VERSION = "2026-02-21.3";

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

function normalizeCountySlug(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9-]{1,80}$/.test(normalized)) return "";
  return normalized;
}

function deriveCountySlug(pathname: string) {
  const pathOnly = pathname.split(/[?#]/, 1)[0] || "";
  const match = /^\/tradepartners\/([^/]+)/i.exec(pathOnly);
  if (!match?.[1]) return "";

  try {
    return normalizeCountySlug(decodeURIComponent(match[1]));
  } catch {
    return normalizeCountySlug(match[1]);
  }
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
  const countySlug = useMemo(() => {
    const fromProp = normalizeCountySlug(String(countySlugProp || ""));
    if (fromProp) return fromProp;

    const fromLocation = deriveCountySlug(String(location || ""));
    if (fromLocation) return fromLocation;

    if (typeof window !== "undefined") {
      return deriveCountySlug(window.location.pathname);
    }

    return "";
  }, [countySlugProp, location]);

  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const title = useMemo(() => (data ? data.pageTitle : "Trade Partner"), [data]);

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
    document.title = title;
  }, [title]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (!data) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
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
  const processSteps = [
    "Apply for a category seat in this county.",
    "Ops reviews category availability and fit.",
    "Seat assignment is locked for the term window.",
    "Partner visibility and County Vault attribution goes live.",
  ];

  return (
    <div className="tp-county-page">
      <div className="tp-container">
        <header className="tp-hero tp-fade-up">
          <div className="tp-hero-left">
            <p className="tp-kicker">
              <MapPinned size={14} />
              {countyLabel}
            </p>
            <h1>{renderHeadlineWithAccent(data.heroHeadline)}</h1>
            <p className="tp-subhead">{data.heroSubhead}</p>
            <div className="tp-hero-actions">
              <button type="button" className="tp-btn-primary" onClick={scrollToForm}>
                Request category review
                <ArrowRight size={16} />
              </button>
              <button type="button" className="tp-btn-ghost" onClick={scrollToForm}>
                See seat terms
              </button>
            </div>
          </div>
          <div className="tp-hero-right">
            <MetricCard label="Term window" value={`${data.seatTermMonths} months`} />
            <MetricCard label="Exclusivity" value="1 seat per category" />
            <MetricCard label="Giveback allocation" value={`${data.givebackSeatRevenuePct}%`} />
            <MetricCard label="County Vault" value={`${data.countyVaultAffiliatePct}%`} />
          </div>
        </header>

        <div className="tp-layout">
          <div className="tp-content tp-fade-up tp-delay-1">
            <section className="tp-panel">
              <h2>Why this model exists</h2>
              <p>
                Most local marketplaces monetize interruption. TradeScout is designed for trust and
                operating continuity, not lead flipping.
              </p>
              <div className="tp-feature-grid">
                <FeatureCard
                  icon={<ShieldCheck size={18} />}
                  title="No pay-per-lead extraction"
                  text="Contractor opportunity stays open while partner seats fund infrastructure."
                />
                <FeatureCard
                  icon={<BadgeCheck size={18} />}
                  title="Category clarity"
                  text="One partner seat per category keeps the signal clean and predictable."
                />
                <FeatureCard
                  icon={<HandHeart size={18} />}
                  title="Visible local giveback"
                  text="A fixed revenue share is routed to county-visible giveback activity."
                />
                <FeatureCard
                  icon={<Wallet size={18} />}
                  title="Public attribution"
                  text="County Vault summaries credit partner impact with recurring transparency."
                />
              </div>
            </section>

            <section className="tp-panel">
              <h2>How seat operations work</h2>
              <ol className="tp-step-list">
                {processSteps.map((step) => (
                  <li key={step}>
                    <Sparkles size={14} />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="tp-panel">
              <h2>Placement and amplification</h2>
              <div className="tp-split-grid">
                <div>
                  <h3>Embedded placement</h3>
                  <ul>
                    <li>Introduced during onboarding as infrastructure support.</li>
                    <li>Listed across county resource and partner contexts.</li>
                    <li>Positioned for familiarity before purchasing intent.</li>
                  </ul>
                </div>
                <div>
                  <h3>Recurring visibility</h3>
                  <ul>
                    <li>Monthly partner mention cadence in county channels.</li>
                    <li>Inclusion in documented giveback and impact stories.</li>
                    <li>Consistent exposure without ad-noise behavior.</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="tp-panel">
              <h2>County scope and expansion</h2>
              <p>
                {data.countyName} is operated as a measured county unit. Multi-county expansion is
                evaluated only after pilot stability is proven in ops metrics and community output.
              </p>
              <div className="tp-chip-row">
                <span className="tp-chip">
                  <CalendarClock size={14} />
                  {data.seatTermMonths}-month standard term
                </span>
                <span className="tp-chip">
                  <HandHeart size={14} />
                  {data.givebackSeatRevenuePct}% public giveback allocation
                </span>
                <span className="tp-chip">
                  <Wallet size={14} />
                  {data.countyVaultAffiliatePct}% County Vault affiliate routing
                </span>
              </div>
            </section>
          </div>

          <aside className="tp-sidebar tp-fade-up tp-delay-2">
            <section className="tp-panel tp-form-panel" id="interest-form">
              <h2>Request a category seat review</h2>
              <p className="tp-form-intro">
                Submit your business details. TradeScout ops will confirm seat availability for this
                county and follow up with term details.
              </p>

              {data.allowedCategories.length > 0 ? (
                <div className="tp-allowed-categories">
                  {data.allowedCategories.map((category) => (
                    <span key={category}>{category}</span>
                  ))}
                </div>
              ) : null}

              {submitted ? (
                <div className="tp-submit-success">
                  <strong>Received.</strong>
                  <span>Your request is in queue and will be reviewed shortly.</span>
                  <button
                    type="button"
                    className="tp-btn-ghost"
                    onClick={() => {
                      setSubmitted(false);
                      setSubmitError(null);
                    }}
                  >
                    Submit another request
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
                  />
                  <Field label="Contact name" name="contactName" required />
                  <Field label="Email" name="email" type="email" required />
                  <Field label="Phone (optional)" name="phone" />
                  <Field label="Notes (optional)" name="message" asTextarea />

                  <div className="tp-consent-group">
                    <Checkbox
                      name="acknowledgesExclusivity"
                      label="I understand seats are exclusive: one partner per category in this county."
                    />
                    <Checkbox
                      name="acknowledgesTerm"
                      label={`I understand the standard term for this county is ${data.seatTermMonths} months.`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="tp-btn-primary tp-submit-btn"
                  >
                    {submitting ? "Submitting..." : "Submit request"}
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
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  asTextarea?: boolean;
  asSelect?: boolean;
  options?: string[];
}) {
  return (
    <label className="tp-field">
      <span>
        {label} {required ? <em>*</em> : null}
      </span>
      {asSelect && options.length > 0 ? (
        <select name={name} required={required} defaultValue="" className="tp-select">
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
        <textarea name={name} className="tp-textarea" />
      ) : (
        <input name={name} required={required} type={type} className="tp-input" />
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
