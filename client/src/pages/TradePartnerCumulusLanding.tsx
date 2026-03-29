import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  Megaphone,
  Radio,
  Salad,
  Share2,
  UserRoundPlus,
  Users2,
} from "lucide-react";
import { useLocation } from "wouter";
import { CURRENT_PROFILE_VERSION } from "@shared/profile";
import { SEOHelmet } from "@/components/SEOHelmet";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { share } from "@/utils/share";
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

type MeetingSlot = {
  id: string;
  countySlug: string;
  countyLabel: string;
  meetingCity: string;
  meetingDate: string;
  dateLabel: string;
  timeLabel: string;
  startDateTime: string;
  addressLine1: string;
  addressLine2: string;
  teaser: string;
};

type CalendarMonthGroup = {
  key: string;
  label: string;
  sessions: GroupedMeetingSession[];
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

const BIWEEKLY_REPEAT_DAYS = 14;
const FUTURE_SESSION_COUNT = 8;

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

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseMeetingDateValue(dateText: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const parsed = new Date(`${dateText}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeTimeToken(timeLabel: string): string {
  return timeLabel.toLowerCase().replace(/[^0-9apm]+/g, "");
}

function parseTimeLabelToParts(timeLabel: string): { hours: number; minutes: number } | null {
  const match = /^\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*$/i.exec(timeLabel);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || "0");
  const meridiem = match[3].toUpperCase();

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;

  if (meridiem === "AM") {
    if (hours === 12) hours = 0;
  } else if (hours !== 12) {
    hours += 12;
  }

  return { hours, minutes };
}

function buildStartDateTime(dateText: string, timeLabel: string): string {
  const parts = parseTimeLabelToParts(timeLabel);
  if (!parts) return `${dateText}T12:00:00`;

  const hourText = String(parts.hours).padStart(2, "0");
  const minuteText = String(parts.minutes).padStart(2, "0");
  return `${dateText}T${hourText}:${minuteText}:00`;
}

function getTimeSortValue(slot: { startDateTime?: string; timeLabel?: string }): number {
  if (slot.startDateTime) {
    const timestamp = new Date(slot.startDateTime).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }

  const parts = parseTimeLabelToParts(slot.timeLabel || "");
  if (!parts) return Number.MAX_SAFE_INTEGER;
  return parts.hours * 60 + parts.minutes;
}

function buildRecurringMeetingSlots(meetings: MeetingSlot[]): MeetingSlot[] {
  if (!meetings.length) return [];

  const existingKeys = new Set(
    meetings.map((meeting) => `${meeting.countySlug}|${meeting.meetingDate}|${meeting.timeLabel}`)
  );
  const latestTemplateBySeries = new Map<string, MeetingSlot>();

  for (const meeting of meetings) {
    const seriesKey = `${meeting.countySlug}|${normalizeTimeToken(meeting.timeLabel)}`;
    const currentTemplate = latestTemplateBySeries.get(seriesKey);
    if (!currentTemplate || meeting.meetingDate > currentTemplate.meetingDate) {
      latestTemplateBySeries.set(seriesKey, meeting);
    }
  }

  const generated: MeetingSlot[] = [];

  for (const template of latestTemplateBySeries.values()) {
    const baseDate = parseMeetingDateValue(template.meetingDate);
    if (!baseDate) continue;

    let nextDate = addDays(baseDate, BIWEEKLY_REPEAT_DAYS);
    let generatedCount = 0;

    while (generatedCount < FUTURE_SESSION_COUNT) {
      const nextDateText = toIsoDate(nextDate);
      const nextKey = `${template.countySlug}|${nextDateText}|${template.timeLabel}`;

      if (!existingKeys.has(nextKey)) {
        generated.push({
          ...template,
          id: `${template.countySlug}-${nextDateText}-${normalizeTimeToken(template.timeLabel)}`,
          meetingDate: nextDateText,
          dateLabel: formatDateLabel(nextDate),
          startDateTime: buildStartDateTime(nextDateText, template.timeLabel),
        });
        existingKeys.add(nextKey);
        generatedCount += 1;
      }

      nextDate = addDays(nextDate, BIWEEKLY_REPEAT_DAYS);
    }
  }

  return generated;
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
  const [sharing, setSharing] = useState(false);

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

  const campaignMeetings = useMemo<MeetingSlot[]>(() => {
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

  const recurringCampaignMeetings = useMemo(
    () => buildRecurringMeetingSlots(campaignMeetings),
    [campaignMeetings]
  );

  const allCampaignMeetings = useMemo(
    () =>
      [...campaignMeetings, ...recurringCampaignMeetings].sort((a, b) => {
        const dateCompare = a.meetingDate.localeCompare(b.meetingDate);
        if (dateCompare !== 0) return dateCompare;
        return getTimeSortValue(a) - getTimeSortValue(b);
      }),
    [campaignMeetings, recurringCampaignMeetings]
  );

  const visibleMeetingSlots = useMemo(
    () =>
      activeCounty
        ? allCampaignMeetings.filter((slot) => slot.countySlug === activeCounty.slug)
        : allCampaignMeetings,
    [activeCounty, allCampaignMeetings]
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

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        slots: [...group.slots].sort((a, b) => {
          return getTimeSortValue(a) - getTimeSortValue(b);
        }),
      }))
      .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
  }, [visibleMeetingSlots]);

  const calendarMonths = useMemo<CalendarMonthGroup[]>(() => {
    const grouped = new Map<string, CalendarMonthGroup>();

    for (const session of groupedMeetingSessions) {
      const monthDate = parseMeetingDateValue(session.meetingDate);
      const monthKey = session.meetingDate.slice(0, 7);
      const monthLabel = monthDate
        ? monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : monthKey;

      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, {
          key: monthKey,
          label: monthLabel,
          sessions: [],
        });
      }

      grouped.get(monthKey)?.sessions.push(session);
    }

    return Array.from(grouped.values());
  }, [groupedMeetingSessions]);

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
  const prefilledEmail =
    (typeof userRecord?.email === "string" ? userRecord.email.trim() : "") ||
    (typeof userRecord?.emailAddress === "string" ? userRecord.emailAddress.trim() : "");
  const prefilledPhone =
    (typeof userRecord?.phone === "string" ? userRecord.phone.trim() : "") ||
    (typeof userRecord?.phoneNumber === "string" ? userRecord.phoneNumber.trim() : "");
  const prefilledBusinessName = getUserBusinessName(userRecord);
  const emailVerified =
    userRecord?.emailVerified === true ||
    userRecord?.isEmailVerified === true ||
    userRecord?.email_verified === true;
  const signInHref = `/pre-scout-setup?mode=signin&next=${encodeURIComponent(rsvpReturnPath)}`;

  const handleShareCampaign = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const sharePath = String(location || CUMULUS_BASE_PATH).startsWith("/")
        ? String(location || CUMULUS_BASE_PATH)
        : CUMULUS_BASE_PATH;
      await share({
        path: sharePath,
        title: seoTitle,
        text: `TradeScout x Cumulus Media: claim the active local campaign and RSVP for the next session.${seoDescription ? ` ${seoDescription}` : ""}`,
        contextLabel: "Share link",
      });
    } finally {
      setSharing(false);
    }
  };
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

  const submitRsvpForSlot = async (slotId: string) => {
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

    const selectedSlot = visibleMeetingSlots.find((slot) => slot.id === slotId);
    if (!selectedSlot) {
      setSubmitError("Select a county meeting date.");
      return;
    }

    try {
      setSubmitting(true);
      setMeetingSlotId(selectedSlot.id);
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

  const handleSubmitRsvp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitRsvpForSlot(meetingSlotId);
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
          ogImage="/tradescout-social-preview.png?v=10"
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
            <button
              type="button"
              className="tpc-btn tpc-btn-secondary"
              onClick={() => void handleShareCampaign()}
              disabled={sharing}
            >
              {sharing ? "Sharing..." : "Share"}
              <Share2 size={16} />
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
              and time with Cumulus and TradeScout. Sessions repeat every two weeks on the same day
              and time windows so you can book further out.
            </p>
            <div className="tpc-county-list">
              {groupedMeetingSessions.map((session) => (
                <article key={session.id} className="tpc-county-card">
                  <h3>{session.meetingCity || session.countyLabel}</h3>
                  <p className="tpc-county-served">Serving {session.countyLabel}</p>
                  <p>{session.teaser}</p>
                  <p className="tpc-county-date">{session.dateLabel}</p>
                  <p className="tpc-county-time">Choose a time and RSVP.</p>
                  {session.addressLine1 ? <p>{session.addressLine1}</p> : null}
                  {session.addressLine2 ? <p>{session.addressLine2}</p> : null}
                  <div className="tpc-slot-grid tpc-session-slot-grid">
                    {session.slots.map((slot) => (
                      <label key={slot.id} className="tpc-slot-option">
                        <input
                          type="radio"
                          name="meetingSlot"
                          value={slot.id}
                          checked={meetingSlotId === slot.id}
                          onChange={(event) => setMeetingSlotId(event.target.value)}
                        />
                        <div>
                          <strong>{slot.timeLabel || "TBD"}</strong>
                          <span>{session.meetingCity || session.countyLabel}</span>
                          <span>{session.dateLabel}</span>
                        </div>
                      </label>
                    ))}
                  </div>
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
                  <div className="tpc-session-actions">
                    {!isAuthenticated ? (
                      <button
                        type="button"
                        className="tpc-btn tpc-btn-primary"
                        onClick={() => scrollToElementById("cumulus-account-form")}
                      >
                        Create account to RSVP
                        <ArrowRight size={16} />
                      </button>
                    ) : !emailVerified ? (
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
                        Verify email to RSVP
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="tpc-btn tpc-btn-primary"
                        disabled={submitting}
                        onClick={() => {
                          const targetSlotId =
                            session.slots.find((slot) => slot.id === meetingSlotId)?.id ||
                            session.slots[0]?.id ||
                            "";
                          void submitRsvpForSlot(targetSlotId);
                        }}
                      >
                        {submitting && session.slots.some((slot) => slot.id === meetingSlotId)
                          ? "Submitting..."
                          : "RSVP"}
                        {!submitting ? <ArrowRight size={16} /> : null}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className="tpc-booking-calendar">
              <div className="tpc-booking-calendar-head">
                <h3>Biweekly Booking Calendar</h3>
                <p>
                  Browse the next several session cycles by month. Choose any listed time to lock in
                  a future RSVP.
                </p>
              </div>
              <div className="tpc-calendar-months">
                {calendarMonths.map((month) => (
                  <section key={month.key} className="tpc-calendar-month">
                    <header className="tpc-calendar-month-header">
                      <h4>{month.label}</h4>
                    </header>
                    <div className="tpc-calendar-session-grid">
                      {month.sessions.map((session) => (
                        <article key={session.id} className="tpc-calendar-session-card">
                          <div className="tpc-calendar-session-topline">
                            <strong>{session.meetingCity || session.countyLabel}</strong>
                            <span>Serving {session.countyLabel}</span>
                          </div>
                          <p className="tpc-calendar-session-date">{session.dateLabel}</p>
                          <div className="tpc-calendar-slot-row">
                            {session.slots.map((slot) => (
                              <button
                                key={slot.id}
                                type="button"
                                className={`tpc-calendar-slot-button${meetingSlotId === slot.id ? " is-selected" : ""}`}
                                onClick={() => {
                                  setMeetingSlotId(slot.id);
                                  scrollToElementById("cumulus-rsvp-form");
                                }}
                              >
                                {slot.timeLabel || "TBD"}
                              </button>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
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

                    <div className="tpc-prefill-card">
                      <div>
                        <span>Selected session</span>
                        <strong>
                          {visibleMeetingSlots.find((slot) => slot.id === meetingSlotId)
                            ?.timeLabel || "Choose a time from a session card"}
                        </strong>
                      </div>
                      <div>
                        <span>Meeting details</span>
                        <strong>
                          {(() => {
                            const selectedSlot = visibleMeetingSlots.find(
                              (slot) => slot.id === meetingSlotId
                            );
                            if (!selectedSlot) return "Select a session card above.";
                            return `${selectedSlot.meetingCity || selectedSlot.countyLabel} | ${selectedSlot.dateLabel}`;
                          })()}
                        </strong>
                      </div>
                    </div>

                    <label className="tpc-field">
                      <span>Notes (optional)</span>
                      <textarea
                        name="notes"
                        className="tpc-input tpc-textarea"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                      />
                    </label>

                    <p className="tpc-auth-helper">
                      Choose a time on the session card and RSVP. Notes entered here will be
                      included with your submission.
                    </p>
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
            <button
              type="button"
              className="tpc-btn tpc-btn-secondary"
              onClick={() => void handleShareCampaign()}
              disabled={sharing}
            >
              {sharing ? "Sharing..." : "Share"}
              <Share2 size={16} />
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
