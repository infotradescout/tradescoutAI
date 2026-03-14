import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  Megaphone,
  Radio,
  Salad,
  UserRoundPlus,
  Users2,
} from "lucide-react";
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
const PARTNER_SLUG = "cumulus-media";

type CountySeoConfig = {
  slug: string;
  countyName: string;
  stateCode: string;
  displayLabel: string;
  localFocus: string;
  neighborhoods: string[];
};

type CampaignMeeting = {
  meetingId: string;
  countySlug: string;
  countyLabel: string;
  meetingCity?: string;
  meetingDate: string;
  dateLabel: string;
  timeLabel?: string;
  startDateTime?: string;
  addressLine1?: string;
  addressLine2?: string;
  teaser: string;
  eventLabel?: string;
  sortOrder?: number;
};

type CampaignConfig = {
  partnerSlug: string;
  partnerName: string;
  campaignTitle: string;
  heroKicker: string;
  heroHeadline: string;
  heroSubhead: string;
  dealAmountUsd: number;
  dealTerms: string;
  coverageScope: string;
  focusNote: string;
  ctaLabel: string;
  ctaUrl?: string;
  seoKeywords?: string;
  benefits: string[];
  counties: CountySeoConfig[];
  meetings: CampaignMeeting[];
  isActive: boolean;
};

type GroupedMeetingSession = {
  id: string;
  countySlug: string;
  countyLabel: string;
  meetingCity: string;
  meetingDate: string;
  dateLabel: string;
  addressLine1: string;
  addressLine2: string;
  teaser: string;
  slots: Array<{
    id: string;
    timeLabel: string;
    startDateTime: string;
  }>;
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
  "TradeScout, Cumulus Media, free ads, local business marketing, Mobile County AL marketing, Escambia County FL marketing, Okaloosa County FL marketing, Google Search Ads, Facebook Ads, Instagram Ads, Connected TV Advertising, Streaming Audio Ads, Westwood One";

const MEETING_SLOTS = [
  {
    id: "mobile-2026-03-24-1145",
    countySlug: "mobile-county-al",
    countyLabel: "Mobile County, AL",
    meetingCity: "Mobile, AL",
    meetingDate: "2026-03-24",
    dateLabel: "Tuesday, March 24, 2026",
    timeLabel: "11:45 AM",
    startDateTime: "2026-03-24T11:45:00-05:00",
    teaser:
      "Mobile, AL session with free lunch, local businesses, and Cumulus partnership briefing.",
  },
  {
    id: "mobile-2026-03-24-1400",
    countySlug: "mobile-county-al",
    countyLabel: "Mobile County, AL",
    meetingCity: "Mobile, AL",
    meetingDate: "2026-03-24",
    dateLabel: "Tuesday, March 24, 2026",
    timeLabel: "2:00 PM",
    startDateTime: "2026-03-24T14:00:00-05:00",
    teaser:
      "Mobile, AL session with free lunch, local businesses, and Cumulus partnership briefing.",
  },
  {
    id: "escambia-2026-03-25-1145",
    countySlug: "escambia-county-fl",
    countyLabel: "Escambia County, FL",
    meetingCity: "Pensacola, FL",
    meetingDate: "2026-03-25",
    dateLabel: "Wednesday, March 25, 2026",
    timeLabel: "11:45 AM",
    startDateTime: "2026-03-25T11:45:00-05:00",
    teaser: "Pensacola, FL session focused on Gulf Coast business growth and campaign planning.",
  },
  {
    id: "escambia-2026-03-25-1400",
    countySlug: "escambia-county-fl",
    countyLabel: "Escambia County, FL",
    meetingCity: "Pensacola, FL",
    meetingDate: "2026-03-25",
    dateLabel: "Wednesday, March 25, 2026",
    timeLabel: "2:00 PM",
    startDateTime: "2026-03-25T14:00:00-05:00",
    teaser: "Pensacola, FL session focused on Gulf Coast business growth and campaign planning.",
  },
  {
    id: "okaloosa-2026-03-26-1145",
    countySlug: "okaloosa-county-fl",
    countyLabel: "Okaloosa County, FL",
    meetingCity: "Fort Walton Beach, FL",
    meetingDate: "2026-03-26",
    dateLabel: "Thursday, March 26, 2026",
    timeLabel: "11:45 AM",
    startDateTime: "2026-03-26T11:45:00-05:00",
    teaser:
      "Fort Walton Beach, FL session with Cumulus corporate partners and regional networking.",
  },
  {
    id: "okaloosa-2026-03-26-1400",
    countySlug: "okaloosa-county-fl",
    countyLabel: "Okaloosa County, FL",
    meetingCity: "Fort Walton Beach, FL",
    meetingDate: "2026-03-26",
    dateLabel: "Thursday, March 26, 2026",
    timeLabel: "2:00 PM",
    startDateTime: "2026-03-26T14:00:00-05:00",
    teaser:
      "Fort Walton Beach, FL session with Cumulus corporate partners and regional networking.",
  },
];

const BENEFITS = [
  "Unconditional $2,000 advertising credit for local businesses in the TradeScout network.",
  "Campaigns can run across Google Search, display, paid social, streaming audio, connected TV, video, and native advertising.",
  "Real audience targeting using identity-backed and behavioral signals, not anonymous cookie-only audiences.",
  "One of the largest audio and digital media footprints in the U.S. with Westwood One network reach.",
  "Creative support and campaign messaging help from experienced Cumulus teams.",
  "Geo-targeted planning built for local visibility, leads, and measurable business response.",
];

const CHANNELS = [
  "Google Search Ads",
  "Display Advertising",
  "Facebook & Instagram Ads",
  "Streaming Audio Ads",
  "Connected TV Advertising",
  "Video Advertising",
  "Native Advertising",
  "Geo-targeted campaigns",
];

const TARGETING_SIGNALS = [
  "Geographic location",
  "Household income ranges",
  "Purchase behavior",
  "Lifestyle interests",
  "Life stage signals",
];

const PERFORMANCE_EXAMPLES = [
  {
    title: "Home Improvement Industry Example",
    stats: [
      "Display ads: 1.24% CTR vs 0.49% industry average",
      "Social campaigns: 1.40% CTR vs 0.70% industry average",
      "Google search campaigns: 8.84% CTR vs 5.59% industry average",
    ],
  },
  {
    title: "HVAC & Plumbing Example",
    stats: [
      "Display campaigns: 1.06% CTR vs 0.50% industry average",
      "Social campaigns: 10.23% CTR vs 7.95% industry average",
      "Google campaigns: 0.39% CTR vs 0.11% industry average",
    ],
  },
];

const CASE_STUDIES = [
  {
    title: "Burton Pools & Spas",
    investment: "Campaign investment: $21,000",
    results: ["70+ online service requests", "134 in-store visits", "$1.6M+ revenue generated"],
  },
  {
    title: "Act 1 Flooring",
    investment: "Annual campaign investment: $72,600",
    results: ["124 verified sales matched directly to the campaign audience"],
  },
];

const REGIONAL_OFFICES = [
  {
    city: "Mobile",
    addressLine1: "1551 Spring Hill Ave",
    addressLine2: "Mobile, AL 36604",
    phone: "(251) 438-5000",
  },
  {
    city: "Fort Walton Beach",
    addressLine1: "225 Hollywood Blvd NW",
    addressLine2: "Fort Walton Beach, FL 32548",
    phone: "(850) 243-7676",
  },
  {
    city: "Pensacola",
    addressLine1: "6565 North W Street #270",
    addressLine2: "Pensacola, FL 32505",
    phone: "(850) 478-6011",
  },
];

const OFFER_HIGHLIGHTS = [
  "$2,000 ad credit",
  "No minimum spend",
  "Google, social, CTV, audio",
  "Mobile, Escambia, Okaloosa",
];

const LOCATION_BY_COUNTY: Record<
  string,
  { addressLine1: string; addressLine2: string; phone?: string }
> = {
  "mobile-county-al": {
    addressLine1: "1551 Spring Hill Ave",
    addressLine2: "Mobile, AL 36604",
    phone: "(251) 438-5000",
  },
  "escambia-county-fl": {
    addressLine1: "6565 North W Street #270",
    addressLine2: "Pensacola, FL 32505",
    phone: "(850) 478-6011",
  },
  "okaloosa-county-fl": {
    addressLine1: "225 Hollywood Blvd NW",
    addressLine2: "Fort Walton Beach, FL 32548",
    phone: "(850) 243-7676",
  },
};

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

function isCompleteCampaignMeeting(meeting: CampaignMeeting): boolean {
  return Boolean(
    meeting.meetingId &&
    meeting.countySlug &&
    meeting.countyLabel &&
    meeting.meetingDate &&
    meeting.dateLabel &&
    meeting.timeLabel &&
    meeting.meetingCity
  );
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
  partnerName: string;
  dealAmountUsd: number;
}) {
  const { canonicalUrl, activeCounty, visibleSlots, partnerName, dealAmountUsd } = args;
  const webPageName = activeCounty
    ? `TradeScout x ${partnerName} in ${activeCounty.displayLabel}`
    : `TradeScout x ${partnerName} County Meetings`;

  const faqItems = [
    {
      "@type": "Question",
      name: "Is the $2,000 ad credit really unconditional?",
      acceptedAnswer: {
        "@type": "Answer",
        text: `Yes. The TradeDeal is presented as unconditional ($${dealAmountUsd.toLocaleString()}) with no catch, no minimum spend, and no hidden terms.`,
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
    name: `TradeScout x ${partnerName} Meeting - ${slot.countyLabel}`,
    startDate: slot.startDateTime || `${slot.meetingDate}T12:00:00-05:00`,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: slot.meetingCity || slot.countyLabel,
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
          ? `${partnerName} $${dealAmountUsd.toLocaleString()} free ad TradeDeal for ${activeCounty.displayLabel}. RSVP for local meeting + free lunch.`
          : `${partnerName} $${dealAmountUsd.toLocaleString()} free ad TradeDeal with county meeting RSVP and free lunch.`,
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
  const [campaignConfig, setCampaignConfig] = useState<CampaignConfig | null>(null);

  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [signupEmail, setSignupEmail] = useState("");

  const [meetingSlotId, setMeetingSlotId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadCampaign = async () => {
      try {
        const campaign = (await apiRequest(
          "GET",
          `/api/tradepartner-campaigns/${encodeURIComponent(PARTNER_SLUG)}`
        )) as CampaignConfig;
        if (!cancelled && campaign && campaign.isActive) {
          setCampaignConfig(campaign);
        }
      } catch {
        if (!cancelled) setCampaignConfig(null);
      }
    };
    void loadCampaign();
    return () => {
      cancelled = true;
    };
  }, []);

  const pathOnly = useMemo(() => getPathname(String(location || "")), [location]);
  const fallbackCounties = useMemo(() => Object.values(COUNTY_SEO), []);
  const campaignCounties = useMemo(() => {
    if (Array.isArray(campaignConfig?.counties) && campaignConfig.counties.length > 0) {
      return campaignConfig.counties;
    }
    return fallbackCounties;
  }, [campaignConfig?.counties, fallbackCounties]);
  const campaignCountyBySlug = useMemo(() => {
    return campaignCounties.reduce<Record<string, CountySeoConfig>>((acc, county) => {
      acc[county.slug] = county;
      return acc;
    }, {});
  }, [campaignCounties]);

  const activeCountySlug = useMemo(() => getCountySlugFromPath(pathOnly), [pathOnly]);
  const activeCounty = activeCountySlug ? campaignCountyBySlug[activeCountySlug] || null : null;

  const locationParams = useMemo(() => {
    const rawLocation = String(location || "");
    const search = rawLocation.includes("?") ? rawLocation.split("?")[1] || "" : "";
    return new URLSearchParams(search);
  }, [location]);

  const campaignMeetings = useMemo(() => {
    if (
      Array.isArray(campaignConfig?.meetings) &&
      campaignConfig.meetings.length > 0 &&
      campaignConfig.meetings.every(isCompleteCampaignMeeting)
    ) {
      return campaignConfig.meetings.map((meeting) => ({
        id: meeting.meetingId,
        countySlug: meeting.countySlug,
        countyLabel: meeting.countyLabel,
        meetingCity: meeting.meetingCity || "",
        meetingDate: meeting.meetingDate,
        dateLabel: meeting.dateLabel,
        timeLabel: meeting.timeLabel || "",
        startDateTime: meeting.startDateTime || "",
        addressLine1:
          meeting.addressLine1 || LOCATION_BY_COUNTY[meeting.countySlug]?.addressLine1 || "",
        addressLine2:
          meeting.addressLine2 || LOCATION_BY_COUNTY[meeting.countySlug]?.addressLine2 || "",
        teaser: meeting.teaser,
      }));
    }
    return MEETING_SLOTS.map((slot) => ({
      ...slot,
      addressLine1: LOCATION_BY_COUNTY[slot.countySlug]?.addressLine1 || "",
      addressLine2: LOCATION_BY_COUNTY[slot.countySlug]?.addressLine2 || "",
    }));
  }, [campaignConfig?.meetings]);

  const visibleMeetingSlots = useMemo(
    () =>
      activeCounty
        ? campaignMeetings.filter((slot) => slot.countySlug === activeCounty.slug)
        : campaignMeetings,
    [activeCounty, campaignMeetings]
  );

  const groupedMeetingSessions = useMemo(() => {
    const grouped = new Map<string, GroupedMeetingSession>();

    for (const slot of visibleMeetingSlots) {
      const groupKey = [
        slot.countySlug,
        slot.meetingDate,
        slot.meetingCity || slot.countyLabel,
        slot.addressLine1 || "",
        slot.addressLine2 || "",
      ].join("|");

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          id: groupKey,
          countySlug: slot.countySlug,
          countyLabel: slot.countyLabel,
          meetingCity: slot.meetingCity || slot.countyLabel,
          meetingDate: slot.meetingDate,
          dateLabel: slot.dateLabel,
          addressLine1: slot.addressLine1 || "",
          addressLine2: slot.addressLine2 || "",
          teaser: slot.teaser,
          slots: [],
        });
      }

      grouped.get(groupKey)?.slots.push({
        id: slot.id,
        timeLabel: slot.timeLabel || "",
        startDateTime: slot.startDateTime || "",
      });
    }

    return Array.from(grouped.values()).map((group) => ({
      ...group,
      slots: [...group.slots].sort((a, b) => {
        const aTime = a.startDateTime
          ? new Date(a.startDateTime).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bTime = b.startDateTime
          ? new Date(b.startDateTime).getTime()
          : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      }),
    }));
  }, [visibleMeetingSlots]);

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
  const campaignName = campaignConfig?.partnerName || "Cumulus Media";
  const campaignDealAmount =
    typeof campaignConfig?.dealAmountUsd === "number" && campaignConfig.dealAmountUsd > 0
      ? campaignConfig.dealAmountUsd
      : DEAL_AMOUNT;
  const campaignBenefits =
    Array.isArray(campaignConfig?.benefits) && campaignConfig.benefits.length > 0
      ? campaignConfig.benefits
      : BENEFITS;
  const campaignHeroHeadline = campaignConfig?.heroHeadline?.trim() || "TradeScout x Cumulus Media";
  const campaignHeroSubhead = campaignConfig?.heroSubhead?.trim() || "";
  const campaignFocusNote = campaignConfig?.focusNote?.trim() || "";
  const campaignCoverageScope = campaignConfig?.coverageScope || "national";
  const computedCoverageNote =
    campaignCoverageScope === "national"
      ? campaignFocusNote ||
        "Offer applies across Cumulus markets. Current launch focus is Mobile County AL, Escambia County FL, and Okaloosa County FL."
      : campaignFocusNote;

  const seoTitle = activeCounty
    ? `$${campaignDealAmount.toLocaleString()} Free Ads + ${campaignName} RSVP | ${activeCounty.displayLabel}`
    : `$${campaignDealAmount.toLocaleString()} Free Ads + ${campaignName} County RSVP`;

  const seoDescription = activeCounty
    ? `TradeScout x ${campaignName} in ${activeCounty.displayLabel}. Claim the unconditional $${campaignDealAmount.toLocaleString()} free-ad TradeDeal, RSVP for free lunch, and connect with local businesses and corporate partners.`
    : `TradeScout x ${campaignName}: unconditional $${campaignDealAmount.toLocaleString()} free-ad TradeDeal, county meeting RSVP, and free lunch in Mobile, Escambia, and Okaloosa counties.`;

  const seoCanonicalPath = activeCounty
    ? `${CUMULUS_BASE_PATH}/${activeCounty.slug}`
    : CUMULUS_BASE_PATH;
  const seoCanonical = `https://www.thetradescout.com${seoCanonicalPath}`;
  const seoKeywords = activeCounty
    ? `${campaignConfig?.seoKeywords || DEFAULT_KEYWORDS}, ${activeCounty.countyName} ${activeCounty.stateCode}, ${activeCounty.neighborhoods.join(
        ", "
      )}`
    : campaignConfig?.seoKeywords || DEFAULT_KEYWORDS;

  const structuredData = useMemo(
    () =>
      buildStructuredData({
        canonicalUrl: seoCanonical,
        activeCounty,
        visibleSlots: visibleMeetingSlots,
        partnerName: campaignName,
        dealAmountUsd: campaignDealAmount,
      }),
    [seoCanonical, activeCounty, visibleMeetingSlots, campaignName, campaignDealAmount]
  );

  const countyLandingLinks = useMemo(
    () =>
      campaignCounties.map((county) => ({
        label: county.displayLabel,
        href: `${CUMULUS_BASE_PATH}/${county.slug}`,
      })),
    [campaignCounties]
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
        partnerSlug: campaignConfig?.partnerSlug || PARTNER_SLUG,
        meetingId: selectedSlot.id,
        countySlug: selectedSlot.countySlug,
        meetingDate: selectedSlot.meetingDate,
        timeLabel: selectedSlot.timeLabel,
        startDateTime: selectedSlot.startDateTime,
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
          ogImage="/tradescout-brand.png?v=9"
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
              ? `TradeScout x Cumulus Media | $${campaignDealAmount.toLocaleString()} Local Advertising Credit | ${activeCounty.displayLabel}`
              : `TradeScout x Cumulus Media Partnership | $${campaignDealAmount.toLocaleString()} Local Advertising Credit`}
          </h1>
          <p className="tpc-subhead">
            {campaignHeroSubhead ||
              `TradeScout has partnered with ${campaignName}, a national broadcast and digital media network, to help local businesses reach customers across the Gulf Coast region.`}{" "}
            Local businesses can receive a{" "}
            <strong>${campaignDealAmount.toLocaleString()} advertising credit</strong> toward a
            Cumulus digital marketing campaign.{" "}
            {campaignConfig?.dealTerms || "No catch. No minimum spend. No hidden terms."}
            {activeCounty ? ` This page is scoped to ${activeCounty.displayLabel}.` : ""}
            {!activeCounty && computedCoverageNote ? ` ${computedCoverageNote}` : ""}
          </p>
          <div className="tpc-chip-row tpc-hero-highlights">
            {OFFER_HIGHLIGHTS.map((highlight) => (
              <span key={highlight} className="tpc-chip">
                {highlight}
              </span>
            ))}
          </div>
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
            <h2>TradeDeal: ${campaignDealAmount.toLocaleString()} Free Ad Credit</h2>
            <p>
              Businesses in the TradeScout network receive a ${campaignDealAmount.toLocaleString()}
              advertising credit from Cumulus. Campaign structure, channel mix, and final scope are
              determined with the Cumulus team.
            </p>
          </div>
        </section>

        <section className="tpc-panel tpc-rise tpc-delay-1">
          <h2>Potential Campaign Channels</h2>
          <p>
            Cumulus offers campaigns across multiple digital channels. Final recommendations depend
            on the business, market, and campaign plan.
          </p>
          <div className="tpc-check-grid">
            {CHANNELS.map((channel) => (
              <article key={channel} className="tpc-check-card">
                <CheckCircle2 size={16} />
                <span>{channel}</span>
              </article>
            ))}
          </div>
        </section>

        <div className="tpc-grid">
          <section className="tpc-panel tpc-rise tpc-delay-2">
            <h2>Regional Sessions</h2>
            <p>
              Pick the session that serves your county. Each one includes lunch, local networking,
              and time with Cumulus and TradeScout. Space is limited at each session, with roughly
              10 spots per RSVP time.
            </p>
            <div className="tpc-county-list">
              {groupedMeetingSessions.map((session) => (
                <article key={session.id} className="tpc-county-card">
                  <h3>{session.meetingCity || session.countyLabel}</h3>
                  <p className="tpc-county-served">Serving {session.countyLabel}</p>
                  <p>{session.teaser}</p>
                  <p className="tpc-county-date">{session.dateLabel}</p>
                  <p className="tpc-county-time">
                    RSVP times:{" "}
                    {session.slots
                      .map((slot) => slot.timeLabel || "TBD")
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {session.addressLine1 ? <p>{session.addressLine1}</p> : null}
                  {session.addressLine2 ? <p>{session.addressLine2}</p> : null}
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
                  Create your account, verify your email, then come back here to choose a session.
                  Each RSVP time has limited capacity.
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
                  Choose your session and submit. Your name and email are already attached. Each
                  session time has limited spots available.
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
                        {groupedMeetingSessions.map((session) => (
                          <div key={session.id} className="tpc-slot-option">
                            <div>
                              <strong>{session.dateLabel}</strong>
                              <span>
                                {session.meetingCity || session.countyLabel}
                                {session.meetingCity ? ` | Serving ${session.countyLabel}` : ""}
                              </span>
                              {session.addressLine1 ? <span>{session.addressLine1}</span> : null}
                              {session.addressLine2 ? <span>{session.addressLine2}</span> : null}
                            </div>
                            <div className="tpc-slot-grid">
                              {session.slots.map((slot) => (
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
                                    <strong>{slot.timeLabel || "TBD"}</strong>
                                    <span>{session.meetingCity || session.countyLabel}</span>
                                    <span>{session.dateLabel}</span>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
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
          <h2>How Cumulus Targeting Works</h2>
          <p>
            Cumulus builds audiences from verified identity data and behavioral signals so campaigns
            can be targeted and measured against real people, not just anonymous cookies.
          </p>
          <div className="tpc-chip-row">
            {TARGETING_SIGNALS.map((signal) => (
              <span key={signal} className="tpc-chip">
                {signal}
              </span>
            ))}
          </div>
        </section>

        <section className="tpc-panel tpc-rise tpc-delay-2">
          <h2>Why Cumulus</h2>
          <p>
            Local station reach, digital channel execution, and Westwood One scale all sit in one
            partner stack.
          </p>
          <div className="tpc-benefit-grid">
            {campaignBenefits.map((benefit) => (
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

        <section className="tpc-panel tpc-rise tpc-delay-2">
          <h2>Proof It Performs</h2>
          <p>
            Cumulus publishes both benchmark campaign performance and named client outcomes. This
            gives you a clearer view of what strong execution can look like before you commit.
          </p>
          <div className="tpc-proof-grid">
            {PERFORMANCE_EXAMPLES.map((example) => (
              <article key={example.title} className="tpc-proof-card">
                <h3>{example.title}</h3>
                <ul className="tpc-list">
                  {example.stats.map((stat) => (
                    <li key={stat}>{stat}</li>
                  ))}
                </ul>
              </article>
            ))}
            {CASE_STUDIES.map((study) => (
              <article key={study.title} className="tpc-proof-card">
                <h3>{study.title}</h3>
                <p className="tpc-proof-kicker">{study.investment}</p>
                <ul className="tpc-list">
                  {study.results.map((result) => (
                    <li key={result}>{result}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="tpc-panel tpc-rise tpc-delay-2">
          <h2>Regional Offices Supporting This Program</h2>
          <div className="tpc-proof-grid">
            {REGIONAL_OFFICES.map((office) => (
              <article key={office.city} className="tpc-proof-card">
                <h3>{office.city}</h3>
                <p>{office.addressLine1}</p>
                <p>{office.addressLine2}</p>
                <p>{office.phone}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="tpc-panel tpc-rise tpc-delay-2">
          <h2>Claim Your ${campaignDealAmount.toLocaleString()} Advertising Credit</h2>
          <p>
            Create your TradeScout account, verify your email, RSVP for a session, then continue
            into onboarding.
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
              Apply now
              <ArrowRight size={16} />
            </button>
            <span className="tpc-no-catch-pill">
              Grow your visibility with targeted advertising.
            </span>
          </div>
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
