import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Megaphone, Radio, Salad, UserRoundPlus, Users2 } from "lucide-react";
import { useLocation } from "wouter";
import { CURRENT_PROFILE_VERSION } from "@shared/profile";
import { SEOHelmet } from "@/components/SEOHelmet";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import "./tradepartner-cumulus.css";

const LANDING_TEMPLATE_VERSION = "2026-03-12.2";
const DEAL_AMOUNT = 2000;
const RSVP_RETURN_PATH = "/tradepartners/cumulus-media?rsvp=1";
const POST_RSVP_NEXT = "/scout?onboarding=true";
const CUMULUS_BASE_PATH = "/tradepartners/cumulus-media";

type CountySeoConfig = {
  slug: string;
  countyName: string;
  stateCode: string;
  displayLabel: string;
  localFocus: string;
  neighborhoods: string[];
};

const COUNTY_SEO: Record<string, CountySeoConfig> = {
  "mobile-county-al": {
    slug: "mobile-county-al",
    countyName: "Mobile County",
    stateCode: "AL",
    displayLabel: "Mobile County, AL",
    localFocus: "Gulf Coast service businesses, home services, and local retail growth campaigns.",
    neighborhoods: ["Mobile", "Daphne", "Fairhope", "Saraland"],
  },
  "escambia-county-fl": {
    slug: "escambia-county-fl",
    countyName: "Escambia County",
    stateCode: "FL",
    displayLabel: "Escambia County, FL",
    localFocus: "Pensacola-area local business awareness, direct response, and event promotion.",
    neighborhoods: ["Pensacola", "Cantonment", "Gulf Breeze", "Pace"],
  },
  "okaloosa-county-fl": {
    slug: "okaloosa-county-fl",
    countyName: "Okaloosa County",
    stateCode: "FL",
    displayLabel: "Okaloosa County, FL",
    localFocus: "Fort Walton Beach and Destin corridor business visibility across local audiences.",
    neighborhoods: ["Fort Walton Beach", "Destin", "Crestview", "Niceville"],
  },
};

const DEFAULT_KEYWORDS =
  "TradeScout, Cumulus Media, free ads, local business marketing, Mobile County AL marketing, Escambia County FL marketing, Okaloosa County FL marketing, county business meetup, TradePartner, Westwood One";

const MEETING_SLOTS = [
  {
    id: "mobile-2026-03-24",
    countySlug: "mobile-county-al",
    countyLabel: "Mobile County, AL",
    meetingDate: "2026-03-24",
    dateLabel: "Tuesday, March 24, 2026",
    teaser: "Gulf Coast business networking + Cumulus partnership briefing.",
  },
  {
    id: "escambia-2026-03-25",
    countySlug: "escambia-county-fl",
    countyLabel: "Escambia County, FL",
    meetingDate: "2026-03-25",
    dateLabel: "Wednesday, March 25, 2026",
    teaser: "Regional lunch meetup focused on local growth planning.",
  },
  {
    id: "okaloosa-2026-03-26",
    countySlug: "okaloosa-county-fl",
    countyLabel: "Okaloosa County, FL",
    meetingDate: "2026-03-26",
    dateLabel: "Thursday, March 26, 2026",
    teaser: "County-wide workshop with Cumulus corporate partners.",
  },
];

const BENEFITS = [
  "Unconditional $2,000 in free ads for the TradeScout network.",
  "Local radio reach plus strategic amplification across digital channels.",
  "One of the largest audio footprints in the U.S. market.",
  "Westwood One network access for broader regional and national campaign options.",
  "County-level campaign planning tailored to local business demand.",
  "Creative support and messaging help from experienced Cumulus teams.",
  "Brand credibility through trusted local personalities and station audiences.",
  "Integrated campaign options across on-air, stream, podcast, and digital touchpoints.",
];

function cleanField(form: FormData, key: string, maxLen: number): string {
  const raw = form.get(key);
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function normalizeSafePath(path: string): string {
  const normalized = String(path || "").trim();
  if (!normalized.startsWith("/")) return "/";
  if (normalized.startsWith("//")) return "/";
  return normalized;
}

function scrollToElementById(id: string) {
  if (typeof document === "undefined") return;
  const form = document.getElementById(id);
  form?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getUserName(user: Record<string, unknown> | null): string {
  if (!user) return "";
  const firstName = typeof user.firstName === "string" ? user.firstName.trim() : "";
  const lastName = typeof user.lastName === "string" ? user.lastName.trim() : "";
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function getUserBusinessName(user: Record<string, unknown> | null): string {
  if (!user) return "";
  const businessName = typeof user.businessName === "string" ? user.businessName.trim() : "";
  if (businessName) return businessName;
  const company = typeof user.company === "string" ? user.company.trim() : "";
  if (company) return company;
  const fallbackName = getUserName(user);
  return fallbackName ? `${fallbackName} | TradeScout` : "TradeScout Member";
}

function needsOnboarding(user: Record<string, unknown> | null): boolean {
  if (!user) return true;
  const onboardingCompleted = user.onboardingCompleted === true;
  const profileVersion = typeof user.profileVersion === "number" ? user.profileVersion : 0;
  return !onboardingCompleted || profileVersion < CURRENT_PROFILE_VERSION;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
}

function getErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "";
}

function getPathname(location: string): string {
  const path = String(location || "").split(/[?#]/, 1)[0] || "";
  return path || CUMULUS_BASE_PATH;
}

function getCountySlugFromPath(pathname: string): string {
  const match = /^\/tradepartners\/cumulus-media\/([a-z0-9-]+)\/?$/i.exec(pathname);
  if (!match?.[1]) return "";
  const slug = match[1].toLowerCase();
  return slug in COUNTY_SEO ? slug : "";
}

function buildStructuredData(args: {
  canonicalUrl: string;
  activeCounty: CountySeoConfig | null;
  visibleSlots: Array<(typeof MEETING_SLOTS)[number]>;
}) {
  const { canonicalUrl, activeCounty, visibleSlots } = args;
  const webPageName = activeCounty
    ? `TradeScout x Cumulus Media in ${activeCounty.displayLabel}`
    : "TradeScout x Cumulus Media County Meetings";

  const faqItems = [
    {
      "@type": "Question",
      name: "Is the $2,000 ad credit really unconditional?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. The TradeDeal is presented as no catch, no minimum spend, and no hidden terms.",
      },
    },
    {
      "@type": "Question",
      name: "Which counties are included?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Mobile County, Escambia County, and Okaloosa County are included in this campaign.",
      },
    },
    {
      "@type": "Question",
      name: "What happens after I RSVP?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "After RSVP, TradeScout routes eligible accounts through the normal onboarding flow.",
      },
    },
  ];

  const events = visibleSlots.map((slot) => ({
    "@type": "Event",
    name: `TradeScout x Cumulus Meeting - ${slot.countyLabel}`,
    startDate: `${slot.meetingDate}T12:00:00-05:00`,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: slot.countyLabel,
      address: {
        "@type": "PostalAddress",
        addressRegion: slot.countyLabel.split(",")[1]?.trim() || "US",
        addressCountry: "US",
      },
    },
    organizer: {
      "@type": "Organization",
      name: "TradeScout",
      url: "https://www.thetradescout.com",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: canonicalUrl,
    },
  }));

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: webPageName,
        url: canonicalUrl,
        description: activeCounty
          ? `Cumulus Media $2,000 free ad TradeDeal for ${activeCounty.displayLabel}. RSVP for local meeting + free lunch.`
          : "Cumulus Media $2,000 free ad TradeDeal with county meeting RSVP and free lunch.",
      },
      {
        "@type": "FAQPage",
        mainEntity: faqItems,
      },
      ...events,
    ],
  };
}

export default function TradePartnerCumulusLanding() {
  const [location, navigate] = useLocation();
  const { user, isAuthenticated, refetch } = useAuth();
  const queryClient = useQueryClient();

  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [signupEmail, setSignupEmail] = useState("");

  const [meetingSlotId, setMeetingSlotId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const pathOnly = useMemo(() => getPathname(String(location || "")), [location]);
  const activeCountySlug = useMemo(() => getCountySlugFromPath(pathOnly), [pathOnly]);
  const activeCounty = activeCountySlug ? COUNTY_SEO[activeCountySlug] : null;

  const locationParams = useMemo(() => {
    const rawLocation = String(location || "");
    const search = rawLocation.includes("?") ? rawLocation.split("?")[1] || "" : "";
    return new URLSearchParams(search);
  }, [location]);

  const visibleMeetingSlots = useMemo(
    () =>
      activeCounty
        ? MEETING_SLOTS.filter((slot) => slot.countySlug === activeCounty.slug)
        : MEETING_SLOTS,
    [activeCounty]
  );

  useEffect(() => {
    if (!visibleMeetingSlots.length) return;
    const selectedStillVisible = visibleMeetingSlots.some((slot) => slot.id === meetingSlotId);
    if (!selectedStillVisible) {
      setMeetingSlotId(visibleMeetingSlots[0].id);
    }
  }, [meetingSlotId, visibleMeetingSlots]);

  const shouldPromptRsvp = locationParams.get("rsvp") === "1";
  const rsvpReturnPath = activeCounty
    ? `${CUMULUS_BASE_PATH}/${activeCounty.slug}?rsvp=1`
    : RSVP_RETURN_PATH;
  const userRecord = (user || null) as Record<string, unknown> | null;
  const prefilledName = getUserName(userRecord);
  const prefilledEmail = typeof userRecord?.email === "string" ? userRecord.email.trim() : "";
  const prefilledPhone = typeof userRecord?.phone === "string" ? userRecord.phone.trim() : "";
  const prefilledBusinessName = getUserBusinessName(userRecord);
  const emailVerified = userRecord?.emailVerified === true;
  const signInHref = `/pre-scout-setup?mode=signin&next=${encodeURIComponent(rsvpReturnPath)}`;

  const seoTitle = activeCounty
    ? `$2,000 Free Ads + Cumulus RSVP | ${activeCounty.displayLabel}`
    : "$2,000 Free Ads + Cumulus County RSVP";

  const seoDescription = activeCounty
    ? `TradeScout x Cumulus Media in ${activeCounty.displayLabel}. Claim the unconditional $2,000 free-ad TradeDeal, RSVP for free lunch, and connect with local businesses and corporate partners.`
    : "TradeScout x Cumulus Media: unconditional $2,000 free-ad TradeDeal, county meeting RSVP, and free lunch in Mobile, Escambia, and Okaloosa counties.";

  const seoCanonicalPath = activeCounty
    ? `${CUMULUS_BASE_PATH}/${activeCounty.slug}`
    : CUMULUS_BASE_PATH;
  const seoCanonical = `https://www.thetradescout.com${seoCanonicalPath}`;
  const seoKeywords = activeCounty
    ? `${DEFAULT_KEYWORDS}, ${activeCounty.countyName} ${activeCounty.stateCode}, ${activeCounty.neighborhoods.join(
        ", "
      )}`
    : DEFAULT_KEYWORDS;

  const structuredData = useMemo(
    () =>
      buildStructuredData({
        canonicalUrl: seoCanonical,
        activeCounty,
        visibleSlots: visibleMeetingSlots,
      }),
    [seoCanonical, activeCounty, visibleMeetingSlots]
  );

  const countyLandingLinks = useMemo(
    () =>
      Object.values(COUNTY_SEO).map((county) => ({
        label: county.displayLabel,
        href: `${CUMULUS_BASE_PATH}/${county.slug}`,
      })),
    []
  );

  useEffect(() => {
    if (!isAuthenticated || !shouldPromptRsvp) return;
    scrollToElementById("cumulus-rsvp-form");
  }, [isAuthenticated, shouldPromptRsvp]);

  useEffect(() => {
    if (isAuthenticated) return;
    const emailParam = locationParams.get("email") || "";
    if (emailParam.trim()) {
      setSignupEmail(emailParam.trim());
    }
  }, [isAuthenticated, locationParams]);

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);

    const form = new FormData(event.currentTarget);
    const firstName = cleanField(form, "firstName", 80);
    const lastName = cleanField(form, "lastName", 80);
    const email = cleanField(form, "email", 200).toLowerCase();
    const phone = cleanField(form, "phone", 60);
    const password = cleanField(form, "password", 200);
    const confirmPassword = cleanField(form, "confirmPassword", 200);
    const acceptedTerms = form.get("acceptTerms") === "on";

    setSignupEmail(email);

    if (!firstName || !lastName || !email || !phone || !password || !confirmPassword) {
      setCreateError("Complete all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      setCreateError("Passwords must match.");
      return;
    }

    if (password.length < 8) {
      setCreateError("Use at least 8 characters for your password.");
      return;
    }

    if (!acceptedTerms) {
      setCreateError("You must accept Terms and Privacy.");
      return;
    }

    try {
      setCreateSubmitting(true);
      const response = await apiRequest("POST", "/api/auth/register", {
        firstName,
        lastName,
        email,
        phone,
        password,
        userTypes: [],
        userIntent: "",
        acceptTerms: true,
        allowPhoneCalls: false,
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      try {
        await refetch?.();
      } catch {
        // fail-soft
      }

      if (response?.emailVerificationRequired === true) {
        navigate(
          `/check-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(rsvpReturnPath)}`
        );
        return;
      }

      navigate(rsvpReturnPath);
    } catch (error) {
      const code = getErrorCode(error);
      const message = getErrorMessage(error, "Could not create account.");
      const accountExists =
        code === "AUTH_ACCOUNT_EXISTS" ||
        code === "AUTH_ACCOUNT_EXISTS_SOCIAL_ONLY" ||
        message.toLowerCase().includes("already exists");
      if (accountExists) {
        setCreateError("An account already exists for this email. Use sign in to continue.");
        return;
      }
      setCreateError(message);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleSubmitRsvp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (!isAuthenticated || !userRecord) {
      scrollToElementById("cumulus-account-form");
      setSubmitError("Create an account first, then RSVP.");
      return;
    }

    if (!emailVerified) {
      const next = normalizeSafePath(rsvpReturnPath);
      const emailParam = prefilledEmail ? `email=${encodeURIComponent(prefilledEmail)}&` : "";
      navigate(`/check-email?${emailParam}next=${encodeURIComponent(next)}`);
      return;
    }

    const selectedSlot = visibleMeetingSlots.find((slot) => slot.id === meetingSlotId);
    if (!selectedSlot) {
      setSubmitError("Select a county meeting date.");
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest("POST", "/api/tradepartner-rsvp", {
        countySlug: selectedSlot.countySlug,
        meetingDate: selectedSlot.meetingDate,
        businessName: prefilledBusinessName,
        contactName: prefilledName || prefilledBusinessName,
        email: prefilledEmail,
        phone: prefilledPhone,
        attendeeCount: 1,
        lunchAttendees: 1,
        notes: notes.trim(),
      });

      setSubmitted(true);
      setNotes("");

      const onboardingTarget = needsOnboarding(userRecord)
        ? `/onboarding/profile?next=${encodeURIComponent(POST_RSVP_NEXT)}`
        : POST_RSVP_NEXT;

      window.setTimeout(() => {
        navigate(onboardingTarget);
      }, 900);
    } catch (error) {
      setSubmitError(getErrorMessage(error, "RSVP submission failed."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tpc-page">
      <div className="tpc-orb tpc-orb-left" aria-hidden />
      <div className="tpc-orb tpc-orb-right" aria-hidden />
      <div className="tpc-container">
        <SEOHelmet
          title={seoTitle}
          description={seoDescription}
          keywords={seoKeywords}
          canonical={seoCanonical}
          structuredData={structuredData}
        />
        <header className="tpc-hero tpc-rise">
          <div className="tpc-brand-lockup">
            <TradeScoutLogo size="md" className="tpc-brand-mark" />
            <span>Official TradeScout TradePartner Campaign</span>
          </div>
          <p className="tpc-kicker">TradePartner Campaign</p>
          <h1>
            {activeCounty
              ? `TradeScout x Cumulus Media | ${activeCounty.displayLabel}`
              : "TradeScout x Cumulus Media"}
          </h1>
          <p className="tpc-subhead">
            Cumulus Media is providing an unconditional{" "}
            <strong>${DEAL_AMOUNT.toLocaleString()} in free ads</strong> to the TradeScout network.
            No catch. No minimum spend. No hidden terms.
            {activeCounty ? ` This page is scoped to ${activeCounty.displayLabel}.` : ""}
          </p>
          <div className="tpc-hero-actions">
            <button
              type="button"
              className="tpc-btn tpc-btn-primary"
              onClick={() => {
                if (isAuthenticated) {
                  scrollToElementById("cumulus-rsvp-form");
                  return;
                }
                scrollToElementById("cumulus-account-form");
              }}
            >
              {isAuthenticated ? "Choose meeting date" : "Create account to RSVP"}
              <ArrowRight size={16} />
            </button>
            <span className="tpc-no-catch-pill">No minimum. No purchase required.</span>
          </div>
        </header>

        <section className="tpc-tradedeal tpc-rise tpc-delay-1">
          <div className="tpc-tradedeal-icon">
            <Megaphone size={22} />
          </div>
          <div>
            <h2>TradeDeal: ${DEAL_AMOUNT.toLocaleString()} Free Ad Credit</h2>
            <p>
              Every participating TradeScout county network gets access to the ad credit allocation.
              The deal is direct and unconditional so local businesses can activate marketing
              faster.
            </p>
          </div>
        </section>

        <div className="tpc-grid">
          <section className="tpc-panel tpc-rise tpc-delay-2">
            <h2>County Meetings + Free Lunch</h2>
            <p>
              RSVP for your county event to meet local businesses, TradeScout operators, and Cumulus
              corporate partners.
            </p>
            <div className="tpc-county-list">
              {visibleMeetingSlots.map((slot) => (
                <article key={slot.id} className="tpc-county-card">
                  <h3>{slot.countyLabel}</h3>
                  <p>{slot.teaser}</p>
                  <p className="tpc-county-date">{slot.dateLabel}</p>
                  <div className="tpc-county-meta">
                    <span>
                      <Salad size={14} />
                      Free lunch
                    </span>
                    <span>
                      <Users2 size={14} />
                      Local business networking
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="tpc-panel tpc-form-panel tpc-rise tpc-delay-3" id="cumulus-rsvp-form">
            {!isAuthenticated ? (
              <section id="cumulus-account-form">
                <h2>Create account, then RSVP</h2>
                <p>
                  Step 1: create your TradeScout account. Step 2: verify your email. Step 3: return
                  here, pick a meeting date, and submit RSVP.
                </p>
                <form className="tpc-form" onSubmit={handleCreateAccount}>
                  {createError ? <p className="tpc-error">{createError}</p> : null}

                  <div className="tpc-two-col">
                    <label className="tpc-field">
                      <span>First name *</span>
                      <input name="firstName" className="tpc-input" required />
                    </label>
                    <label className="tpc-field">
                      <span>Last name *</span>
                      <input name="lastName" className="tpc-input" required />
                    </label>
                  </div>

                  <label className="tpc-field">
                    <span>Email *</span>
                    <input
                      name="email"
                      type="email"
                      className="tpc-input"
                      required
                      value={signupEmail}
                      onChange={(event) => setSignupEmail(event.target.value)}
                    />
                  </label>

                  <label className="tpc-field">
                    <span>Phone *</span>
                    <input name="phone" className="tpc-input" required />
                  </label>

                  <div className="tpc-two-col">
                    <label className="tpc-field">
                      <span>Password *</span>
                      <input
                        name="password"
                        type="password"
                        className="tpc-input"
                        minLength={8}
                        required
                      />
                    </label>
                    <label className="tpc-field">
                      <span>Confirm password *</span>
                      <input
                        name="confirmPassword"
                        type="password"
                        className="tpc-input"
                        minLength={8}
                        required
                      />
                    </label>
                  </div>

                  <label className="tpc-checkline">
                    <input name="acceptTerms" type="checkbox" required />
                    <span>
                      I agree to TradeScout <a href="/terms">Terms</a> and{" "}
                      <a href="/privacy">Privacy</a>.
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="tpc-btn tpc-btn-primary"
                    disabled={createSubmitting}
                  >
                    {createSubmitting ? "Creating account..." : "Create account"}
                    {!createSubmitting ? <UserRoundPlus size={16} /> : null}
                  </button>
                </form>

                <p className="tpc-auth-helper">
                  Already have an account? <a href={signInHref}>Sign in</a>
                </p>
              </section>
            ) : (
              <section>
                <h2>RSVP</h2>
                <p>
                  You are signed in. Pick your county meeting date and submit. Your name and email
                  are already attached.
                </p>

                {!emailVerified ? (
                  <div className="tpc-verify-block">
                    <strong>Email verification required before RSVP.</strong>
                    <button
                      type="button"
                      className="tpc-btn tpc-btn-secondary"
                      onClick={() =>
                        navigate(
                          `/check-email?email=${encodeURIComponent(prefilledEmail)}&next=${encodeURIComponent(
                            rsvpReturnPath
                          )}`
                        )
                      }
                    >
                      Verify email
                    </button>
                  </div>
                ) : null}

                <div className="tpc-prefill-card">
                  <div>
                    <span>Name</span>
                    <strong>{prefilledName || "TradeScout member"}</strong>
                  </div>
                  <div>
                    <span>Email</span>
                    <strong>{prefilledEmail || "Not available"}</strong>
                  </div>
                </div>

                {submitted ? (
                  <div className="tpc-success">
                    <strong>RSVP received.</strong>
                    <span>Routing you into standard onboarding now.</span>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitRsvp} className="tpc-form">
                    {submitError ? <p className="tpc-error">{submitError}</p> : null}

                    <fieldset className="tpc-slot-group">
                      <legend>Meeting date *</legend>
                      <div className="tpc-slot-grid">
                        {visibleMeetingSlots.map((slot) => (
                          <label key={slot.id} className="tpc-slot-option">
                            <input
                              type="radio"
                              name="meetingSlot"
                              value={slot.id}
                              checked={meetingSlotId === slot.id}
                              onChange={(event) => setMeetingSlotId(event.target.value)}
                              required
                            />
                            <div>
                              <strong>{slot.dateLabel}</strong>
                              <span>{slot.countyLabel}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <label className="tpc-field">
                      <span>Notes (optional)</span>
                      <textarea
                        name="notes"
                        className="tpc-input tpc-textarea"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={submitting || !emailVerified}
                      className="tpc-btn tpc-btn-primary"
                    >
                      {submitting ? "Submitting..." : "Submit RSVP"}
                      {!submitting ? <ArrowRight size={16} /> : null}
                    </button>
                  </form>
                )}
              </section>
            )}
          </aside>
        </div>

        {activeCounty ? (
          <section className="tpc-panel tpc-rise tpc-delay-2">
            <h2>{activeCounty.displayLabel} Local Campaign Focus</h2>
            <p>{activeCounty.localFocus}</p>
            <div className="tpc-chip-row">
              {activeCounty.neighborhoods.map((city) => (
                <span key={city} className="tpc-chip">
                  {city}
                </span>
              ))}
            </div>
            <p className="tpc-county-links">
              County pages:
              {countyLandingLinks.map((link) => (
                <a key={link.href} href={link.href}>
                  {link.label}
                </a>
              ))}
            </p>
          </section>
        ) : null}

        <section className="tpc-panel tpc-rise tpc-delay-2">
          <h2>Why Market With Cumulus</h2>
          <p>
            Cumulus combines local station influence with large-scale audio network distribution.
            That gives small and mid-sized businesses practical county reach and larger growth
            options on one partner stack.
          </p>
          <div className="tpc-benefit-grid">
            {BENEFITS.map((benefit) => (
              <article key={benefit} className="tpc-benefit-card">
                <Radio size={16} />
                <span>{benefit}</span>
              </article>
            ))}
          </div>
          <div className="tpc-stats">
            <div>
              <strong>394</strong>
              <span>owned-and-operated stations</span>
            </div>
            <div>
              <strong>84</strong>
              <span>U.S. markets</span>
            </div>
            <div>
              <strong>~250M</strong>
              <span>monthly listeners reached</span>
            </div>
            <div>
              <strong>7,800+</strong>
              <span>Westwood One affiliate stations</span>
            </div>
          </div>
          <p className="tpc-source-note">
            Market footprint figures above are based on Cumulus Media and Westwood One public
            materials verified on March 12, 2026.
          </p>
        </section>

        <footer className="tpc-footer">
          <div>
            <a href="https://www.cumulusmedia.com" target="_blank" rel="noreferrer">
              Cumulus Media
            </a>
            <a
              href="https://www.cumulusmedia.com/advertise-with-us/network-solutions/"
              target="_blank"
              rel="noreferrer"
            >
              Network Solutions
            </a>
            <a href="https://www.westwoodone.com" target="_blank" rel="noreferrer">
              Westwood One
            </a>
          </div>
          <span>v{LANDING_TEMPLATE_VERSION}</span>
        </footer>
      </div>
    </div>
  );
}
