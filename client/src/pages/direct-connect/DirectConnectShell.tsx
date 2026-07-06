import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import type { WorkRequest } from "@shared/schema";
import {
  evaluateRoutingReadiness,
  type CanonicalDirectConnectRequest,
  type DirectConnectRoutingReadiness,
} from "@shared/directConnectRoutingSpine";
import TasksHub from "../tasks";
import DirectConnectPros from "./DirectConnectPros";
import { EmploymentBoard } from "./EmploymentBoard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { uploadPrivateObject } from "@/lib/privateObjectUpload";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { interpretWorkRequestStateForScout } from "@/utils/interpretWorkRequestState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DecisionContactGatePanel,
  type DecisionContactGateAction,
  type ReleasedContactPayload,
} from "@/components/ui/DecisionContactGatePanel";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToastAction } from "@/components/ui/toast";
import { formatDistanceToNow } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { WhyThisJobModal } from "./WhyThisJobModal";
import { WhyLink } from "@/components/WhyLink";
import { getHelpLink } from "@/scout/helpSources";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { formatCountyLabel } from "@/utils/countyFipsToName";
import { getDeviceType, trackShellEvent } from "@/lib/analytics";
import {
  trackFrictionEvent,
  trackOncePerSession,
  trackRepeatedFrictionSignal,
} from "@/lib/telemetry";
import { FirstUseGuidanceCard } from "@/components/guidance/FirstUseGuidanceCard";
import { DIRECT_CONNECT_GUIDANCE_TEXT } from "@/lib/firstUseGuidance";
import { resolveDirectConnectFirstUseTaskPrompt } from "@/lib/firstUseTaskPrompts";
import {
  trackFirstUseGuidanceViewed,
  trackFirstUseTaskPromptClicked,
  trackFirstUseTaskPromptViewed,
} from "@/lib/firstUseAnalytics";
import {
  trackDirectConnectHomeRecordCreateSelected,
  trackDirectConnectHomeRecordLinkSelected,
  trackDirectConnectHomeRecordPromptViewed,
  trackDirectConnectHomeRecordSkipped,
  trackDirectConnectHomeIdLinkSelected,
  trackDirectConnectRequestSubmittedAfterHomeRecordSkip,
  trackDirectConnectRequestStarted,
} from "@/lib/coreProductAnalytics";
import { PENSACOLA_COUNTY_CODE } from "@/lib/pensacolaClusters";
import {
  getDirectConnectInboxNextStepCopy,
  getDirectConnectNextStepCopy,
} from "./directConnectReadiness";
import {
  getDirectConnectContactGateNextAction,
  getDirectConnectContactGateNextActor,
  getDirectConnectContactGateSummary,
  getDirectConnectReleasedContactForPanel,
  getDisplayLatestStatus,
  getDisplayRequestDescription,
  getDisplayRequestTitle,
  looksLikeHiddenOrTestRequest,
  normalizeDirectConnectContactState,
} from "./requestCardPresentation";
import {
  SEOHelmet,
  createBreadcrumbStructuredData,
  createServiceStructuredData,
} from "@/components/SEOHelmet";
import {
  ClipboardPlus,
  LayoutList,
  Inbox,
  Users,
  BriefcaseBusiness,
  MessageCircle,
  MoreHorizontal,
  ChevronRight,
  Zap,
  TrendingUp,
  Bell,
  Paperclip,
  UploadCloud,
  FolderKanban,
  Clock3,
  X,
} from "lucide-react";

const SECTIONS = ["post", "board", "employment", "inbox", "pros", "engagements"] as const;
type Section = (typeof SECTIONS)[number];
type RequestType =
  | "service_request"
  | "business_request"
  | "customer_support"
  | "employment"
  | "buy_sell"
  | "other";
type DirectConnectIntent =
  | "fix_improve"
  | "vehicle_service"
  | "find_person_business"
  | "sell_list"
  | "property_real_estate"
  | "offer_services"
  | "browse_activity"
  | "browse_only";

type DirectConnectIntentConfig = {
  heading: string;
  prompt: string;
  chips: string[];
  headingKey?: string;
  promptKey?: string;
  chipKeys?: string[];
  requestType: RequestType;
  detailQuestions: Array<{
    key: "what" | "where" | "when" | "details";
    label: string;
    placeholder: string;
    required?: boolean;
  }>;
};

type RequestCompleteness = {
  level: "ready_to_share" | "needs_one_more_detail" | "too_vague";
  message: string;
  missing: string[];
};

const DIRECT_CONNECT_TABS: Section[] = [
  "post",
  "pros",
  "board",
  "employment",
  "engagements",
  "inbox",
];

const SECTION_LABELS: Record<Section, string> = {
  post: "New Request",
  board: "Local Requests",
  employment: "Jobs",
  inbox: "Replies",
  pros: "Local Directory",
  engagements: "My Requests",
};

const SECTION_SHORT_LABELS: Record<Section, string> = {
  post: "Request",
  board: "Local",
  employment: "Jobs",
  inbox: "Replies",
  pros: "Directory",
  engagements: "Requests",
};

const REQUEST_FIELD_CLASS =
  "min-h-11 rounded-lg border-[color:var(--border-subtle)]/65 bg-[color:var(--surface-card)]/55 px-3.5 text-[15px] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-secondary)]/75 focus:border-[color:var(--theme-accent-primary)]/55 focus:ring-2 focus:ring-[color:var(--theme-accent-primary)]/22";
const REQUEST_TEXTAREA_CLASS = cn(REQUEST_FIELD_CLASS, "min-h-[116px] resize-y py-3 leading-6");
const REQUEST_SELECT_CLASS = cn(REQUEST_FIELD_CLASS, "h-11 w-full");
const REQUEST_LABEL_CLASS = "text-sm font-medium text-[color:var(--text-primary)]";
const REQUEST_HELPER_CLASS = "text-[11px] leading-4 text-[color:var(--text-secondary)]";

const DIRECT_CONNECT_DRAFT_DRAFT_KEY = "ts_direct_connect_draft_v1";
const DIRECT_CONNECT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const DIRECT_CONNECT_REPEATED_SUBMIT_WINDOW_MS = 3000;
const DIRECT_CONNECT_REPEATED_CTA_WINDOW_MS = 2000;

function getSafeDirectConnectErrorCode(error: unknown): string {
  if (error && typeof error === "object") {
    const code = String((error as any).code || (error as any).name || "").trim();
    if (code) return code.slice(0, 80);
    const status = Number((error as any).status);
    if (Number.isFinite(status)) return `status_${status}`;
  }
  return "unknown";
}

function trackDirectConnectApiFailure(args: {
  source: string;
  section: string;
  status?: number;
  error?: unknown;
  requestId?: string;
  blocked?: boolean;
}) {
  trackFrictionEvent("direct_connect_api_request_failed", {
    source: args.source,
    section: args.section,
    reason:
      args.status && Number.isFinite(args.status)
        ? `status_${args.status}`
        : getSafeDirectConnectErrorCode(args.error),
    requestId: args.requestId,
    blocked: args.blocked ?? false,
  });
}
const GENERATED_HOME_LABEL_PATTERN = /^(slice\d+\s+\d+|\d{8,}|[a-f0-9]{12,})$/i;

type DirectConnectDraftSnapshot = {
  savedAt: number;
  returnPath: string;
  title: string;
  description: string;
  budgetMin: string;
  budgetMax: string;
  requestType: RequestType;
  showOptional: boolean;
  selectedProviderIds: string[];
  selectedHomeId?: string;
  assetComponentType?:
    | "roof"
    | "hvac"
    | "plumbing"
    | "electrical"
    | "foundation"
    | "exterior"
    | "interior"
    | "appliance"
    | "permit_document"
    | "other";
  assetComponentId?: string;
  assetLabel?: string;
  homeContextIntent?:
    | "link_existing"
    | "create_from_request"
    | "update_from_request"
    | "skip_for_now";
  attachmentKeys: string[];
  detailAnswers?: Record<"what" | "where" | "when" | "details", string>;
};

type FlowMode = "start" | "manage";

function toCleanHomeLabel(home: any): string {
  const nickname = String(home?.nickname || home?.name || home?.title || "").trim();
  if (nickname && !GENERATED_HOME_LABEL_PATTERN.test(nickname.replace(/\s+/g, " "))) {
    return nickname;
  }
  const address = String(home?.address1 || "").trim();
  if (address) return address;
  const city = String(home?.city || "").trim();
  const state = String(home?.state || "").trim();
  if (city && state) return `${city}, ${state}`;
  return nickname ? "My home" : "Saved home";
}

function getPostSubmitHomeIdMemoryCopy(hasHomes: boolean) {
  return {
    description: hasHomes
      ? "Save this request to your HomeID so future work is easier. You can attach it to a saved home or update property history when you are ready."
      : "Save this request to your HomeID so future work is easier. You can create a home record from the request when you are ready.",
    actionLabel: hasHomes ? "Attach/update HomeID" : "Create from request",
  };
}

const SECTION_META: Record<
  Section,
  {
    title: string;
    description: string;
    actionLabel: string;
    actionTarget: Section;
  }
> = {
  post: {
    title: "New request",
    description: "Tell people what you need, add photos if you have them, and send your request.",
    actionLabel: "Manage requests",
    actionTarget: "engagements",
  },
  board: {
    title: "Local requests",
    description: "See open requests in your area.",
    actionLabel: "Post a new request",
    actionTarget: "post",
  },
  employment: {
    title: "Jobs",
    description: "Post a request or profile and keep replies in Direct Connect.",
    actionLabel: "Post a new request",
    actionTarget: "post",
  },
  inbox: {
    title: "Replies",
    description: "Review who has responded and move accepted work into conversation.",
    actionLabel: "Review my requests",
    actionTarget: "engagements",
  },
  pros: {
    title: "Local Directory",
    description: "Look through local businesses, then send a request when you're ready.",
    actionLabel: "Post a new request",
    actionTarget: "post",
  },
  engagements: {
    title: "My requests",
    description: "Follow-up mode keeps request updates and replies together.",
    actionLabel: "See replies",
    actionTarget: "inbox",
  },
};

const SECTION_ICONS: Record<Section, ReactNode> = {
  post: <ClipboardPlus className="h-5 w-5" />,
  board: <LayoutList className="h-5 w-5" />,
  employment: <BriefcaseBusiness className="h-5 w-5" />,
  inbox: <Inbox className="h-5 w-5" />,
  pros: <Users className="h-5 w-5" />,
  engagements: <BriefcaseBusiness className="h-5 w-5" />,
};

const SECTION_GROUPS: Array<{ title: string; sections: Section[]; icon?: ReactNode }> = [
  {
    title: "Create and browse",
    sections: ["post", "pros", "board"],
    icon: <Zap className="h-4 w-4" />,
  },
  {
    title: "Job and hiring",
    sections: ["employment"],
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    title: "Follow up",
    sections: ["engagements", "inbox"],
    icon: <TrendingUp className="h-4 w-4" />,
  },
];

function getPathOnly(path: string): string {
  return path.split("?")[0].split("#")[0];
}

function getDirectConnectEntry(path: string): string | null {
  const query = path.includes("?") ? path.split("?", 2)[1].split("#", 1)[0] : "";
  if (!query) return null;
  return new URLSearchParams(query).get("entry");
}

function getDirectConnectIntent(path: string): DirectConnectIntent | null {
  const query = path.includes("?") ? path.split("?", 2)[1].split("#", 1)[0] : "";
  if (!query) return null;
  const raw = new URLSearchParams(query).get("intent");
  if (!raw) return null;
  const value = raw.trim().toLowerCase();

  const map: Record<string, DirectConnectIntent> = {
    fix_improve: "fix_improve",
    manage_projects: "fix_improve",
    vehicle_service: "vehicle_service",
    find_help: "find_person_business",
    find_person_business: "find_person_business",
    sell_list: "sell_list",
    sell_items: "sell_list",
    property_real_estate: "property_real_estate",
    real_estate: "property_real_estate",
    offer_services: "offer_services",
    browse_activity: "browse_activity",
    community: "browse_activity",
    browse_only: "browse_only",
    local_search: "find_person_business",
    directory: "find_person_business",
    business: "find_person_business",
  };
  return map[value] || null;
}

function shouldResolveDirectConnectEntry(entry: string | null): entry is string {
  return Boolean(entry && ["default", "auth", "setup", "onboarding", "intent"].includes(entry));
}

function getSectionFromPath(path: string): Section {
  const pathOnly = getPathOnly(path);
  const match = pathOnly.match(/^\/direct-connect(?:\/(.+))?/);
  const raw = match?.[1]?.split("/")[0] ?? "";
  if (!raw) {
    const query = path.includes("?") ? path.split("?", 2)[1].split("#", 1)[0] : "";
    const params = new URLSearchParams(query);
    const mode = String(params.get("mode") || "")
      .trim()
      .toLowerCase();
    const intent = String(params.get("intent") || "")
      .trim()
      .toLowerCase();
    if (
      ["directory", "pros", "browse", "browse_only", "local_search"].includes(mode) ||
      ["directory", "browse_only", "local_search", "find_help", "find_person_business"].includes(
        intent
      )
    ) {
      return "pros";
    }
    return "post";
  }
  if (SECTIONS.includes(raw as Section)) return raw as Section;
  return "post";
}

function buildHref(section: Section): string {
  if (section === "post") return "/direct-connect";
  return `/direct-connect/${section}`;
}

const DIRECT_CONNECT_INTENT_CONFIG: Record<DirectConnectIntent, DirectConnectIntentConfig> = {
  fix_improve: {
    heading: "Tell us what needs done.",
    prompt: "What do you need fixed, built, repaired, cleaned, or improved?",
    chips: ["Repair", "Cleaning", "Yard work", "Remodel", "Emergency help"],
    headingKey: "directConnect.intent.fixImprove.heading",
    promptKey: "directConnect.intent.fixImprove.prompt",
    chipKeys: [
      "directConnect.chips.repair",
      "directConnect.chips.cleaning",
      "directConnect.chips.yardWork",
      "directConnect.chips.remodel",
      "directConnect.chips.emergencyHelp",
    ],
    requestType: "service_request",
    detailQuestions: [
      {
        key: "what",
        label: "What needs done?",
        placeholder: "Fence repair, pressure washing, drywall patch...",
        required: true,
      },
      {
        key: "where",
        label: "Where is it located?",
        placeholder: "City, county, or neighborhood",
        required: true,
      },
      {
        key: "when",
        label: "How soon do you need it?",
        placeholder: "Today, this week, or flexible",
        required: true,
      },
      {
        key: "details",
        label: "Add photos/details if useful",
        placeholder: "Access notes, measurements, materials, or other context",
      },
    ],
  },
  vehicle_service: {
    heading: "Vehicle help",
    prompt: "What vehicle service or repair do you need?",
    chips: ["Repair", "Maintenance", "Tires", "Tow/help", "Sell vehicle"],
    headingKey: "directConnect.intent.vehicleService.heading",
    promptKey: "directConnect.intent.vehicleService.prompt",
    chipKeys: [
      "directConnect.chips.repair",
      "directConnect.chips.maintenance",
      "directConnect.chips.tires",
      "directConnect.chips.towHelp",
      "directConnect.chips.sellVehicle",
    ],
    requestType: "service_request",
    detailQuestions: [
      { key: "what", label: "What vehicle?", placeholder: "Year, make, model", required: true },
      {
        key: "details",
        label: "What service or issue?",
        placeholder: "Brake noise, oil change, diagnostics...",
        required: true,
      },
      {
        key: "when",
        label: "Is it urgent?",
        placeholder: "Now, today, this week, or flexible",
        required: true,
      },
      {
        key: "where",
        label: "Where should help be near?",
        placeholder: "City, county, or ZIP",
        required: true,
      },
    ],
  },
  find_person_business: {
    heading: "Find local help",
    prompt: "Who or what kind of local help are you looking for?",
    chips: ["Contractor", "Notary", "Cleaner", "Mechanic", "Local business"],
    headingKey: "directConnect.intent.findPersonBusiness.heading",
    promptKey: "directConnect.intent.findPersonBusiness.prompt",
    chipKeys: [
      "directConnect.chips.contractor",
      "directConnect.chips.notary",
      "directConnect.chips.cleaner",
      "directConnect.chips.mechanic",
      "directConnect.chips.localBusiness",
    ],
    requestType: "other",
    detailQuestions: [
      {
        key: "what",
        label: "What kind of person/business?",
        placeholder: "Notary, cleaner, mechanic, attorney...",
        required: true,
      },
      {
        key: "details",
        label: "What do you need them for?",
        placeholder: "Describe the outcome you need",
        required: true,
      },
      {
        key: "where",
        label: "Where should they be near?",
        placeholder: "City, county, or neighborhood",
        required: true,
      },
      {
        key: "when",
        label: "Any must-haves?",
        placeholder: "License, availability, language, schedule",
      },
    ],
  },
  sell_list: {
    heading: "Sell or list something",
    prompt: "What are you trying to sell or list?",
    chips: ["Tools", "Materials", "Vehicle", "Property", "Equipment"],
    headingKey: "directConnect.intent.sellList.heading",
    promptKey: "directConnect.intent.sellList.prompt",
    chipKeys: [
      "directConnect.chips.tools",
      "directConnect.chips.materials",
      "directConnect.chips.vehicle",
      "directConnect.chips.property",
      "directConnect.chips.equipment",
    ],
    requestType: "buy_sell",
    detailQuestions: [
      {
        key: "what",
        label: "What are you listing?",
        placeholder: "Item, model, or category",
        required: true,
      },
      {
        key: "details",
        label: "Condition/details?",
        placeholder: "Condition, size, quantity, included items",
        required: true,
      },
      {
        key: "when",
        label: "Price or unsure?",
        placeholder: "Price target or 'unsure'",
        required: true,
      },
      {
        key: "where",
        label: "Pickup/delivery area?",
        placeholder: "Pickup city or delivery radius",
        required: true,
      },
    ],
  },
  property_real_estate: {
    heading: "Property help",
    prompt: "What property, listing, client, or real estate need are you working on?",
    chips: ["Listing prep", "Inspection", "Realtor help", "Repairs", "Buyer/seller help"],
    headingKey: "directConnect.intent.propertyRealEstate.heading",
    promptKey: "directConnect.intent.propertyRealEstate.prompt",
    chipKeys: [
      "directConnect.chips.listingPrep",
      "directConnect.chips.inspection",
      "directConnect.chips.realtorHelp",
      "directConnect.chips.repairs",
      "directConnect.chips.buyerSellerHelp",
    ],
    requestType: "customer_support",
    detailQuestions: [
      {
        key: "what",
        label: "What property need?",
        placeholder: "Listing prep, inspection, repairs, showing support...",
        required: true,
      },
      {
        key: "details",
        label: "Buying, selling, listing prep, inspection, or repair?",
        placeholder: "Add the exact need",
        required: true,
      },
      {
        key: "where",
        label: "Where is it located?",
        placeholder: "City, county, or neighborhood",
        required: true,
      },
      {
        key: "when",
        label: "Timeline?",
        placeholder: "ASAP, this week, this month",
        required: true,
      },
    ],
  },
  offer_services: {
    heading: "Offer your services",
    prompt: "What service do you provide, and where do you work?",
    chips: ["Home services", "Vehicle services", "Property services", "Local business", "Other"],
    headingKey: "directConnect.intent.offerServices.heading",
    promptKey: "directConnect.intent.offerServices.prompt",
    chipKeys: [
      "directConnect.chips.homeServices",
      "directConnect.chips.vehicleServices",
      "directConnect.chips.propertyServices",
      "directConnect.chips.localBusiness",
      "directConnect.chips.other",
    ],
    requestType: "business_request",
    detailQuestions: [
      {
        key: "what",
        label: "What service do you provide?",
        placeholder: "Plumbing, detailing, electrical, cleaning...",
        required: true,
      },
      {
        key: "where",
        label: "Where do you work?",
        placeholder: "Cities, counties, or service radius",
        required: true,
      },
      {
        key: "when",
        label: "Are you available now?",
        placeholder: "Now, this week, next week",
        required: true,
      },
      {
        key: "details",
        label: "What proof/profile info should be reviewed?",
        placeholder: "License, insurance, certifications, portfolio",
        required: true,
      },
    ],
  },
  browse_activity: {
    heading: "See what’s happening nearby",
    prompt: "What kind of local activity do you want to see?",
    chips: ["Posts", "Events", "Listings", "Requests", "Local businesses"],
    headingKey: "directConnect.intent.browseActivity.heading",
    promptKey: "directConnect.intent.browseActivity.prompt",
    chipKeys: [
      "directConnect.chips.posts",
      "directConnect.chips.events",
      "directConnect.chips.listings",
      "directConnect.chips.requests",
      "directConnect.chips.localBusinesses",
    ],
    requestType: "other",
    detailQuestions: [
      {
        key: "what",
        label: "What do you want to see?",
        placeholder: "Jobs, listings, events, help requests",
        required: true,
      },
      {
        key: "where",
        label: "Near what area?",
        placeholder: "City, county, or neighborhood",
        required: true,
      },
      {
        key: "when",
        label: "Today, this week, or anytime?",
        placeholder: "Choose a time window",
        required: true,
      },
    ],
  },
  browse_only: {
    heading: "Start anywhere",
    prompt: "Search for local help, listings, services, jobs, people, or places.",
    chips: ["Home repair", "Vehicle service", "Local help", "Listings", "Events"],
    headingKey: "directConnect.intent.browseOnly.heading",
    promptKey: "directConnect.intent.browseOnly.prompt",
    chipKeys: [
      "directConnect.chips.homeRepair",
      "directConnect.chips.vehicleService",
      "directConnect.chips.localHelp",
      "directConnect.chips.listings",
      "directConnect.chips.events",
    ],
    requestType: "other",
    detailQuestions: [
      {
        key: "what",
        label: "What do you want to do first?",
        placeholder: "Search local help, listing, or service",
        required: true,
      },
      {
        key: "where",
        label: "Where should this request focus?",
        placeholder: "City, county, or neighborhood",
        required: true,
      },
      {
        key: "when",
        label: "When are you trying to do this?",
        placeholder: "Now, this week, flexible",
      },
    ],
  },
};

function localizeIntentConfig(
  config: DirectConnectIntentConfig,
  t: (key: string) => string
): DirectConnectIntentConfig {
  return {
    ...config,
    heading: config.headingKey ? t(config.headingKey) : config.heading,
    prompt: config.promptKey ? t(config.promptKey) : config.prompt,
    chips: config.chipKeys?.length ? config.chipKeys.map((key) => t(key)) : config.chips,
  };
}

function getFlowMode(section: Section): FlowMode {
  return section === "engagements" || section === "inbox" ? "manage" : "start";
}

function statusTone(status: string) {
  const value = String(status || "").toLowerCase();
  if (value === "accepted" || value === "in_progress") {
    return "bg-emerald-500/15 text-emerald-200 border-emerald-400/40";
  }
  if (value === "declined" || value === "cancelled") {
    return "bg-rose-500/15 text-rose-200 border-rose-400/40";
  }
  if (value === "routed" || value === "suggested" || value === "invited") {
    return "bg-ts-orange/15 text-white border-ts-orange/40";
  }
  return "bg-white/10 text-white/70 border-white/15";
}

export function getDirectConnectInboxStatusLabel(status: string | null | undefined): string {
  const value = String(status || "suggested").toLowerCase();
  switch (value) {
    case "suggested":
      return "New opportunity";
    case "invited":
      return "Invited";
    case "saved":
      return "Saved opportunity";
    case "accepted":
    case "in_progress":
      return "Connected";
    case "declined":
    case "cancelled":
      return "Dismissed";
    case "expired":
      return "Closed";
    default:
      return "Review";
  }
}

export function formatDirectConnectInboxTime(
  timestamp: string | null | undefined,
  now: Date = new Date()
): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfDate) / (24 * 60 * 60 * 1000));

  if (dayDiff === 0) return "Updated today";
  if (dayDiff === 1) return "Updated yesterday";

  return `Updated ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  })}`;
}

export function getDirectConnectInboxMatchStrength(
  score: number | null | undefined
): string | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  if (score >= 80) return "Strong local fit";
  if (score >= 50) return "Worth reviewing";
  return "Needs review";
}

export function formatDirectConnectInboxLocalContext(
  distanceMiles: number | null | undefined
): string | null {
  if (typeof distanceMiles !== "number" || !Number.isFinite(distanceMiles)) return null;
  if (distanceMiles <= 5) return "Nearby local reply";
  if (distanceMiles <= 25) return "Within your local area";
  return "Area reply";
}

export function buildDirectConnectInboxDisplay(params: {
  status?: string | null;
  timestamp?: string | null;
  scoreSnapshot?: {
    score?: number;
    reasons?: string[];
    distanceMiles?: number;
    tradeMatch?: boolean;
    recommendationCount?: number;
    responseRate?: number;
  } | null;
  now?: Date;
}) {
  const snapshot = params.scoreSnapshot || undefined;
  const matchStrength = getDirectConnectInboxMatchStrength(snapshot?.score);
  const localContext = formatDirectConnectInboxLocalContext(snapshot?.distanceMiles);
  const reasons = Array.isArray(snapshot?.reasons) ? snapshot.reasons.filter(Boolean) : [];
  const detailRows = [
    matchStrength,
    localContext,
    snapshot?.tradeMatch ? "Trade experience appears relevant" : null,
    typeof snapshot?.recommendationCount === "number" && snapshot.recommendationCount > 0
      ? "Has local recommendations"
      : null,
    ...reasons.slice(0, 2).map((reason) => `Context: ${reason}`),
  ].filter((row): row is string => Boolean(row));

  return {
    statusLabel: getDirectConnectInboxStatusLabel(params.status),
    timeLabel: formatDirectConnectInboxTime(params.timestamp, params.now),
    localContext,
    detailsLabel: "Match details",
    detailsHeading: "Local context",
    detailRows,
  };
}

type DirectConnectInboxItem = {
  assignment: {
    id: string;
    workRequestId: string;
    status: string;
    scoreSnapshot?: {
      score?: number;
      reasons?: string[];
      distanceMiles?: number;
      tradeMatch?: boolean;
      recommendationCount?: number;
      responseRate?: number;
    } | null;
    createdAt: string;
    updatedAt: string;
    // Universal provider fields — present on business/worker assignments
    contractorId?: string | null;
    responderUserId?: string | null;
    workerId?: string | null;
  };
  request: {
    id: string;
    title: string;
    description: string;
    status: string;
    tradeId?: string | null;
    countyFips?: string | null;
    stateCode?: string | null;
    createdAt?: string | null;
    attachmentCount?: number | null;
  } | null;
  conversationThreadId?: string | null;
};

type DirectConnectNotification = {
  id: string;
  request_id: string;
  notification_type: string;
  title: string;
  message: string;
  action_url?: string | null;
  action_key?: string | null;
  status: "unread" | "read" | "archived" | "dismissed";
  priority: "low" | "normal" | "high";
  created_at: string;
};

type DirectConnectRequest = {
  id: string;
  title: string;
  description: string;
  status: string;
  tradeId?: string | null;
  countyFips?: string | null;
  stateCode?: string | null;
  budgetMin?: string | null;
  budgetMax?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  attachmentCount?: number | null;
  dcSuggestedCount?: number | null;
  dcAcceptedAssignmentId?: string | null;
  dcAcceptedResponseSummary?: {
    availabilityWindow?: string;
    priceBand?: "budget" | "standard" | "premium" | "custom_quote";
    scopeNote?: string;
  } | null;
  dcConversationThreadId?: string | null;
  dcLastEventAt?: string | null;
  dcMiniLandingUrl?: string | null;
  contactGateState?: string | null;
  releasedContact?: ReleasedContactPayload | null;
  responseCount?: number | null;
  contactRequestCount?: number | null;
  lifecycleStatus?: string | null;
  latestStatus?: string | null;
  latestStatusAt?: string | null;
  unreadStatusCount?: number | null;
  isHomeIdPreviewDraft?: boolean | null;
};

type RequestFilter = "all" | "open" | "routed" | "in_progress" | "completed" | "cancelled";

type RequestWorkflowStage =
  | "ready_to_send"
  | "waiting_on_pros"
  | "active_conversation"
  | "pending_outcome"
  | "completed"
  | "cancelled";

const REQUEST_FILTERS: RequestFilter[] = [
  "all",
  "open",
  "routed",
  "in_progress",
  "completed",
  "cancelled",
];

function getRequestWorkflowStage(request: DirectConnectRequest): RequestWorkflowStage {
  const status = String(request.status || "open").toLowerCase();
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";
  if (status === "pending_outcome") return "pending_outcome";
  if (status === "in_progress" || Boolean(request.dcConversationThreadId)) {
    return "active_conversation";
  }
  if (status === "routed") return "waiting_on_pros";
  return "ready_to_send";
}

const DIRECT_CONNECT_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      name: "Direct Connect",
      description:
        "Post local requests, review provider replies, and move work forward with clearer local coordination.",
      url: "https://www.thetradescout.com/direct-connect",
    },
    createServiceStructuredData({
      name: "TradeScout Direct Connect",
      description:
        "Local request flow that lets members post what they need, review replies, and reach out without the usual spam.",
      category: "Local provider request platform",
      areaServed: "United States",
    }),
    createBreadcrumbStructuredData([
      { name: "TradeScout", url: "/" },
      { name: "Direct Connect", url: "/direct-connect" },
    ]),
  ],
};

function getRequestFilterLabel(filter: RequestFilter): string {
  switch (filter) {
    case "all":
      return "All";
    case "open":
      return "Live · open";
    case "routed":
      return "Waiting on pros";
    case "in_progress":
      return "In conversation";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

function getRequestStageLabel(stage: RequestWorkflowStage): string {
  switch (stage) {
    case "ready_to_send":
      return "Live · open";
    case "waiting_on_pros":
      return "Waiting on pros";
    case "active_conversation":
      return "In conversation";
    case "pending_outcome":
      return "Pending outcome";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

function evaluateRequestCompleteness(params: {
  answers: Record<"what" | "where" | "when" | "details", string>;
  requiredQuestions: Array<{ key: "what" | "where" | "when" | "details"; label: string }>;
  title: string;
  description: string;
}): RequestCompleteness {
  const missing = params.requiredQuestions
    .filter((question) => params.answers[question.key].trim().length < 2)
    .map((question) => question.label.replace(/\s*\*$/, ""));

  const hasMeaningfulTitle =
    params.title.trim().length >= 3 || params.answers.what.trim().length >= 3;
  const hasMeaningfulDescription =
    params.description.trim().length >= 10 || params.answers.details.trim().length >= 10;

  if (!hasMeaningfulTitle && !hasMeaningfulDescription) {
    return {
      level: "too_vague",
      message: "Add more detail before review",
      missing: missing.length > 0 ? missing : ["Add what you need and one useful detail"],
    };
  }
  if (missing.length > 0) {
    return {
      level: "needs_one_more_detail",
      message: "Needs one more detail",
      missing,
    };
  }
  return {
    level: "ready_to_share",
    message: "Ready to share",
    missing: [],
  };
}

function getRequestStageSummary(stage: RequestWorkflowStage): string {
  switch (stage) {
    case "ready_to_send":
      return "This request is already live on your board for your area. Send it to more pros anytime.";
    case "waiting_on_pros":
      return "Your request is out to local pros. Review replies as they arrive.";
    case "active_conversation":
      return "A pro has engaged with this request, so your next step is to continue the conversation.";
    case "pending_outcome":
      return "Work is wrapping up. Confirm the outcome with your provider to close this request.";
    case "completed":
      return "This request is done. You can review the details or reopen it only by creating a new request.";
    case "cancelled":
      return "This request is paused. Reopen it when you are ready for replies again.";
  }
}

function RequestLifecycleRail({ stage }: { stage: RequestWorkflowStage }) {
  const steps: Array<{ key: RequestWorkflowStage; label: string }> = [
    { key: "ready_to_send", label: "Open" },
    { key: "waiting_on_pros", label: "Routed" },
    { key: "active_conversation", label: "In Discussion" },
    { key: "pending_outcome", label: "Pending Outcome" },
    { key: "completed", label: "Completed" },
  ];
  const isCancelled = stage === "cancelled";
  const currentIndex = isCancelled ? -1 : steps.findIndex((step) => step.key === stage);
  return (
    <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]/55 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-secondary)]">
        {isCancelled ? "Request cancelled" : "Request lifecycle"}
      </p>
      <div className="mt-1.5 grid grid-cols-5 gap-1">
        {steps.map((step, index) => {
          const complete = !isCancelled && currentIndex > -1 && index <= currentIndex;
          const isCurrent = !isCancelled && index === currentIndex;
          return (
            <div key={step.key} className="space-y-1">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  isCancelled
                    ? "bg-[color:var(--border-subtle)]"
                    : complete
                      ? isCurrent
                        ? "bg-[color:var(--theme-accent-primary)] ring-1 ring-[color:var(--theme-accent-primary)]/40"
                        : "bg-[color:var(--theme-accent-primary)]"
                      : "bg-[color:var(--border-subtle)]"
                )}
              />
              <p
                className={cn(
                  "text-[9px] leading-tight",
                  complete
                    ? "text-[color:var(--text-primary)]"
                    : "text-[color:var(--text-secondary)]"
                )}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function matchesRequestFilter(request: DirectConnectRequest, filter: RequestFilter): boolean {
  const stage = getRequestWorkflowStage(request);
  if (filter === "all") return stage !== "cancelled";
  if (filter === "open") return stage === "ready_to_send";
  if (filter === "routed") return stage === "waiting_on_pros";
  if (filter === "in_progress")
    return stage === "active_conversation" || stage === "pending_outcome";
  if (filter === "completed") return stage === "completed";
  return stage === "cancelled";
}

function isCurrentRequest(request: DirectConnectRequest): boolean {
  const ts = request.dcLastEventAt || request.updatedAt || request.createdAt;
  if (!ts) return false;
  const ageMs = Date.now() - new Date(ts).getTime();
  return Number.isFinite(ageMs) && ageMs <= 120 * 24 * 60 * 60 * 1000;
}

function countRequestsByStage(
  requests: DirectConnectRequest[] | undefined,
  stage: RequestWorkflowStage
): number {
  return (requests || []).filter((request) => getRequestWorkflowStage(request) === stage).length;
}

type DraftAttachment = {
  file: File;
  previewUrl: string;
};

type DirectoryCandidate = {
  id: string;
  companyName?: string | null;
  name?: string | null;
  serviceAreas?: string[] | null;
  trustScore?: number | string | null;
  cvsScore?: number | string | null;
  distanceMiles?: number | string | null;
  countyFips?: string | null;
  city?: string | null;
  state?: string | null;
  responseTimeSla?: number | string | null;
  providerType?: "contractor" | "business" | "worker" | null;
  businessId?: string | null;
  slug?: string | null;
  roleContext?: string | null;
};

const PROVIDER_AVATAR_PALETTE = [
  "bg-sky-500/20 text-sky-200",
  "bg-emerald-500/20 text-emerald-200",
  "bg-amber-500/20 text-amber-200",
  "bg-violet-500/20 text-violet-200",
  "bg-rose-500/20 text-rose-200",
  "bg-teal-500/20 text-teal-200",
];

function getProviderInitials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function getProviderAvatarClass(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return PROVIDER_AVATAR_PALETTE[hash % PROVIDER_AVATAR_PALETTE.length];
}

type DispatchMode = "top_count" | "direct_pick";
type DirectConnectCreateDispatch = {
  targetProviderIds?: string[];
  autoRoute?: boolean;
  dispatchMode?: DispatchMode;
  dispatchCount?: number;
  homeId?: string;
  assetComponentId?: string;
  assetComponentType?:
    | "roof"
    | "hvac"
    | "plumbing"
    | "electrical"
    | "foundation"
    | "exterior"
    | "interior"
    | "appliance"
    | "permit_document"
    | "other";
  assetLabel?: string;
  homeContextIntent?:
    | "link_existing"
    | "create_from_request"
    | "update_from_request"
    | "skip_for_now";
};

function parseNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const next = Number(value);
    if (Number.isFinite(next)) return next;
  }
  return null;
}

function getCandidateCvsScore(candidate: DirectoryCandidate): number {
  const cvs = parseNumberOrNull(candidate.cvsScore);
  if (cvs !== null) return cvs;
  const trust = parseNumberOrNull(candidate.trustScore);
  if (trust !== null) return trust;
  return 0;
}

function getCandidateLocationScore(candidate: DirectoryCandidate, countyFips?: string): number {
  const distance = parseNumberOrNull(candidate.distanceMiles);
  if (distance !== null) {
    return Math.max(0, 100 - distance * 10);
  }
  if (countyFips && String(candidate.countyFips || "") === countyFips) {
    return 80;
  }
  return 60;
}

function buildRequestAttachmentUrl(requestId: string, index: number): string {
  return `/api/direct-connect/requests/${encodeURIComponent(requestId)}/attachments/${index}`;
}

function RequestAttachmentStrip({
  requestId,
  attachmentCount,
}: {
  requestId: string;
  attachmentCount?: number | null;
}) {
  const total = typeof attachmentCount === "number" ? attachmentCount : 0;
  if (total <= 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
        <Paperclip className="h-3.5 w-3.5" />
        Request photos
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: total }).map((_, index) => (
          <a
            key={`${requestId}-attachment-${index}`}
            href={buildRequestAttachmentUrl(requestId, index)}
            target="_blank"
            rel="noreferrer"
            className="group relative block h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]"
          >
            <img
              src={buildRequestAttachmentUrl(requestId, index)}
              alt={`Request photo ${index + 1}`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

function DirectConnectRequestComposer({
  defaultCountyFips,
  prefillTargetUserId,
  prefillTargetName,
  prefillSource,
  prefillTitle,
  prefillDescription,
  prefillBudgetMin,
  prefillBudgetMax,
  prefillTradeId,
}: {
  defaultCountyFips?: string;
  prefillTargetUserId?: string;
  prefillTargetName?: string;
  prefillSource?: string;
  prefillTitle?: string;
  prefillDescription?: string;
  prefillBudgetMin?: string;
  prefillBudgetMax?: string;
  prefillTradeId?: string;
}) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const directConnectIntent = useMemo(() => getDirectConnectIntent(location), [location]);
  const intentConfig = directConnectIntent
    ? localizeIntentConfig(DIRECT_CONNECT_INTENT_CONFIG[directConnectIntent], t)
    : null;
  const attachmentsRef = useRef<DraftAttachment[]>([]);
  const initialTargetName = String(prefillTargetName || "").trim();
  const prefillTargetLabel = initialTargetName || "selected member";
  const [requestType, setRequestType] = useState<
    | "service_request"
    | "business_request"
    | "customer_support"
    | "employment"
    | "buy_sell"
    | "other"
  >("service_request");
  const [title, setTitle] = useState(
    () => prefillTitle?.trim() || (initialTargetName ? `Request for ${initialTargetName}` : "")
  );
  const [description, setDescription] = useState(
    () =>
      prefillDescription?.trim() ||
      (initialTargetName
        ? `This request started from Community and is intended for ${initialTargetName}.`
        : "")
  );
  const [draftAttachmentKeys, setDraftAttachmentKeys] = useState<string[]>([]);
  const [budgetMin, setBudgetMin] = useState(() => prefillBudgetMin?.trim() || "");
  const [budgetMax, setBudgetMax] = useState(() => prefillBudgetMax?.trim() || "");
  const [showOptional, setShowOptional] = useState(() =>
    Boolean(prefillBudgetMin?.trim() || prefillBudgetMax?.trim())
  );
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [showDispatchSheet, setShowDispatchSheet] = useState(false);
  const [dispatchMode, setDispatchMode] = useState<DispatchMode>("top_count");
  const [dispatchCount, setDispatchCount] = useState<1 | 2 | 3>(3);
  const [directorySearch, setDirectorySearch] = useState("");
  const [selectedContractorIds, setSelectedContractorIds] = useState<string[]>([]);
  const [selectedHomeId, setSelectedHomeId] = useState<string>("");
  const [assetComponentType, setAssetComponentType] = useState<
    | "roof"
    | "hvac"
    | "plumbing"
    | "electrical"
    | "foundation"
    | "exterior"
    | "interior"
    | "appliance"
    | "permit_document"
    | "other"
  >("other");
  const [assetLabel, setAssetLabel] = useState("");
  const [assetComponentId, setAssetComponentId] = useState("");
  const [homeContextIntent, setHomeContextIntent] = useState<
    "link_existing" | "create_from_request" | "update_from_request" | "skip_for_now"
  >("skip_for_now");
  const [showHomeRecordDetails, setShowHomeRecordDetails] = useState(false);
  const [showRequestReady, setShowRequestReady] = useState(false);
  const [describeStep, setDescribeStep] = useState<0 | 1>(0);
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const [autofillSources, setAutofillSources] = useState<string[]>([]);
  const [detailAnswers, setDetailAnswers] = useState<
    Record<"what" | "where" | "when" | "details", string>
  >({
    what: "",
    where: "",
    when: "",
    details: "",
  });
  const hasAppliedIntentDefaultsRef = useRef(false);
  const requestStartedRef = useRef(false);
  const draftInitializedRef = useRef(false);
  const contextualAutofillAppliedRef = useRef(false);
  const contextualAutofillSnapshotRef = useRef<{
    title?: string;
    description?: string;
    where?: string;
    requestType?: RequestType;
  }>({});
  const homeRecordPromptViewedRef = useRef(false);
  const homeRecordSkippedRef = useRef(false);

  const homesQuery = useQuery({
    queryKey: ["/api/homes"],
    enabled: isAuthenticated,
  });
  const homes = Array.isArray((homesQuery.data as any)?.homes)
    ? (homesQuery.data as any).homes
    : [];
  const hasExistingHomes = homes.length > 0;

  const recentRequestsQuery = useQuery<DirectConnectRequest[]>({
    queryKey: ["/api/direct-connect/requests", "composer_autofill"],
    queryFn: async () => {
      const res = await fetch("/api/direct-connect/requests?scope=all");
      if (!res.ok) return [];
      const payload = await res.json();
      return Array.isArray(payload) ? (payload as DirectConnectRequest[]) : [];
    },
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const latestRequest = useMemo(() => {
    const rows = Array.isArray(recentRequestsQuery.data) ? recentRequestsQuery.data : [];
    if (rows.length < 1) return null;
    return [...rows]
      .filter((request) => !looksLikeHiddenOrTestRequest(request))
      .sort((a, b) => {
        const aTs = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTs = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTs - aTs;
      })[0];
  }, [recentRequestsQuery.data]);
  const currentReturnPath = () => {
    if (typeof window === "undefined") return location || "/direct-connect";
    return `${window.location.pathname}${window.location.search || ""}`;
  };

  const clearDirectConnectDraft = () => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(DIRECT_CONNECT_DRAFT_DRAFT_KEY);
    window.localStorage.removeItem(DIRECT_CONNECT_DRAFT_DRAFT_KEY);
  };

  const readDirectConnectDraft = () => {
    if (typeof window === "undefined") return null;
    return (
      window.sessionStorage.getItem(DIRECT_CONNECT_DRAFT_DRAFT_KEY) ||
      window.localStorage.getItem(DIRECT_CONNECT_DRAFT_DRAFT_KEY)
    );
  };

  const hydrateDirectConnectDraft = () => {
    if (typeof window === "undefined" || draftInitializedRef.current) return;
    draftInitializedRef.current = true;

    const raw = readDirectConnectDraft();
    if (!raw) return;
    let parsed: DirectConnectDraftSnapshot | null = null;

    try {
      const candidate = JSON.parse(raw) as unknown;
      if (
        typeof candidate === "object" &&
        candidate !== null &&
        typeof (candidate as DirectConnectDraftSnapshot).savedAt === "number" &&
        typeof (candidate as DirectConnectDraftSnapshot).returnPath === "string"
      ) {
        parsed = candidate as DirectConnectDraftSnapshot;
      }
    } catch {
      trackFrictionEvent("direct_connect_draft_restore_failed", {
        source: currentReturnPath(),
        section: "auth_handoff",
        reason: "parse_failed",
        blocked: false,
      });
      clearDirectConnectDraft();
      return;
    }

    if (!parsed) {
      trackFrictionEvent("direct_connect_draft_restore_failed", {
        source: currentReturnPath(),
        section: "auth_handoff",
        reason: "invalid_shape",
        blocked: false,
      });
      return;
    }
    if (parsed.returnPath !== currentReturnPath()) return;
    if (Date.now() - parsed.savedAt > DIRECT_CONNECT_DRAFT_TTL_MS) {
      clearDirectConnectDraft();
      return;
    }

    const parsedRequestType = parsed.requestType || "service_request";
    const parsedAttachmentKeys = (parsed.attachmentKeys || []).filter(
      (item) => typeof item === "string" && item.trim().length > 0
    );
    const parsedProviderIds = (parsed.selectedProviderIds || [])
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);

    setTitle(parsed.title || prefillTitle?.trim() || "");
    setDescription(parsed.description || prefillDescription?.trim() || "");
    setBudgetMin(parsed.budgetMin || "");
    setBudgetMax(parsed.budgetMax || "");
    if (
      parsedRequestType === "service_request" ||
      parsedRequestType === "business_request" ||
      parsedRequestType === "customer_support" ||
      parsedRequestType === "employment" ||
      parsedRequestType === "buy_sell" ||
      parsedRequestType === "other"
    ) {
      setRequestType(parsedRequestType);
    }
    setShowOptional(Boolean(parsed.showOptional));
    setSelectedContractorIds(parsedProviderIds);
    if (typeof parsed.selectedHomeId === "string") setSelectedHomeId(parsed.selectedHomeId.trim());
    if (
      parsed.assetComponentType === "roof" ||
      parsed.assetComponentType === "hvac" ||
      parsed.assetComponentType === "plumbing" ||
      parsed.assetComponentType === "electrical" ||
      parsed.assetComponentType === "foundation" ||
      parsed.assetComponentType === "exterior" ||
      parsed.assetComponentType === "interior" ||
      parsed.assetComponentType === "appliance" ||
      parsed.assetComponentType === "permit_document" ||
      parsed.assetComponentType === "other"
    ) {
      setAssetComponentType(parsed.assetComponentType);
    }
    if (typeof parsed.assetComponentId === "string") {
      setAssetComponentId(parsed.assetComponentId.trim());
    }
    if (typeof parsed.assetLabel === "string") {
      setAssetLabel(parsed.assetLabel.trim());
    }
    if (
      parsed.homeContextIntent === "link_existing" ||
      parsed.homeContextIntent === "create_from_request" ||
      parsed.homeContextIntent === "update_from_request" ||
      parsed.homeContextIntent === "skip_for_now"
    ) {
      setHomeContextIntent(parsed.homeContextIntent);
    }
    setDraftAttachmentKeys(Array.from(new Set(parsedAttachmentKeys)).slice(0, 6));
    if (parsed.detailAnswers) {
      setDetailAnswers({
        what: String(parsed.detailAnswers.what || ""),
        where: String(parsed.detailAnswers.where || ""),
        when: String(parsed.detailAnswers.when || ""),
        details: String(parsed.detailAnswers.details || ""),
      });
    }
    clearDirectConnectDraft();
  };

  const persistDirectConnectDraft = (payload: { selectedProviderIds?: string[] } = {}) => {
    if (typeof window === "undefined") return;

    const draft: DirectConnectDraftSnapshot = {
      savedAt: Date.now(),
      returnPath: currentReturnPath(),
      requestType,
      title: title.trim(),
      description: description.trim(),
      budgetMin: budgetMin.trim(),
      budgetMax: budgetMax.trim(),
      showOptional,
      selectedProviderIds: Array.from(
        new Set(
          (payload.selectedProviderIds && Array.isArray(payload.selectedProviderIds)
            ? payload.selectedProviderIds
            : selectedContractorIds
          )
            .filter((item) => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
        )
      ),
      selectedHomeId: selectedHomeId.trim(),
      assetComponentType,
      assetComponentId: assetComponentId.trim(),
      assetLabel: assetLabel.trim(),
      homeContextIntent,
      attachmentKeys: Array.from(
        new Set(
          (draftAttachmentKeys || []).filter((item) => typeof item === "string" && item.trim())
        )
      ),
      detailAnswers: {
        what: String(detailAnswers.what || ""),
        where: String(detailAnswers.where || ""),
        when: String(detailAnswers.when || ""),
        details: String(detailAnswers.details || ""),
      },
    };
    const serialized = JSON.stringify(draft);
    window.sessionStorage.setItem(DIRECT_CONNECT_DRAFT_DRAFT_KEY, serialized);
    window.localStorage.setItem(DIRECT_CONNECT_DRAFT_DRAFT_KEY, serialized);
  };

  const replaceAttachments = (next: DraftAttachment[]) => {
    attachmentsRef.current = next;
    setAttachments(next);
  };

  const clearAttachments = () => {
    attachmentsRef.current.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
    attachmentsRef.current = [];
    setAttachments([]);
  };

  const clearContextualAutofill = () => {
    const snapshot = contextualAutofillSnapshotRef.current;

    if (snapshot.title && title.trim() === snapshot.title.trim()) {
      setTitle("");
      setDetailAnswers((current) => ({
        ...current,
        what: current.what.trim() === snapshot.title?.trim() ? "" : current.what,
      }));
    }

    if (snapshot.description && description.trim() === snapshot.description.trim()) {
      setDescription("");
      setDetailAnswers((current) => ({
        ...current,
        details: current.details.trim() === snapshot.description?.trim() ? "" : current.details,
      }));
    }

    if (snapshot.where && detailAnswers.where.trim() === snapshot.where.trim()) {
      setDetailAnswers((current) => ({ ...current, where: "" }));
    }

    if (snapshot.requestType && requestType === snapshot.requestType) {
      setRequestType("service_request");
    }

    contextualAutofillSnapshotRef.current = {};
    setAutofillSources([]);
  };

  const requestTypeMeta: Record<
    | "service_request"
    | "business_request"
    | "customer_support"
    | "employment"
    | "buy_sell"
    | "other",
    {
      label: string;
      hint: string;
      bestFor: string;
      category: string;
      titlePlaceholder: string;
      descriptionPlaceholder: string;
      budgetLabelMin: string;
      budgetLabelMax: string;
      budgetPlaceholderMin: string;
      budgetPlaceholderMax: string;
    }
  > = {
    service_request: {
      label: "One-time project",
      hint: "Get a local pro to complete a specific job",
      bestFor: "Repairs, installs, upgrades, urgent fixes",
      category: "service_request",
      titlePlaceholder: "Need help with...",
      descriptionPlaceholder: "Describe what needs to be done, where it is, and your timeline.",
      budgetLabelMin: "Budget min (optional)",
      budgetLabelMax: "Budget max (optional)",
      budgetPlaceholderMin: "500",
      budgetPlaceholderMax: "2500",
    },
    business_request: {
      label: "Ongoing service",
      hint: "Set up recurring service for your home or business",
      bestFor: "Weekly or monthly service, maintenance plans, repeat work",
      category: "business_request",
      titlePlaceholder: "Need ongoing service for...",
      descriptionPlaceholder: "Explain ongoing scope, service expectations, and start timeline.",
      budgetLabelMin: "Budget min (optional)",
      budgetLabelMax: "Budget max (optional)",
      budgetPlaceholderMin: "300",
      budgetPlaceholderMax: "5000",
    },
    customer_support: {
      label: "Property or tenant issue",
      hint: "Coordinate service for a tenant, resident, or managed property",
      bestFor: "HOA, landlord, property manager, resident requests",
      category: "customer_support",
      titlePlaceholder: "Property issue at...",
      descriptionPlaceholder: "Describe the issue, property context, who is affected, and urgency.",
      budgetLabelMin: "Budget min (optional)",
      budgetLabelMax: "Budget max (optional)",
      budgetPlaceholderMin: "100",
      budgetPlaceholderMax: "1500",
    },
    employment: {
      label: "Hiring and staffing",
      hint: "Fill a role, shift, or contract position",
      bestFor: "Employees, shift coverage, contract labor",
      category: "employment",
      titlePlaceholder: "Hiring for role or contract...",
      descriptionPlaceholder: "Share role, schedule, required skills, and expected start date.",
      budgetLabelMin: "Pay min (optional)",
      budgetLabelMax: "Pay max (optional)",
      budgetPlaceholderMin: "18",
      budgetPlaceholderMax: "35",
    },
    buy_sell: {
      label: "Materials and equipment",
      hint: "Buy, sell, or source inventory, tools, and equipment",
      bestFor: "Material orders, equipment sourcing, inventory moves",
      category: "buy_sell",
      titlePlaceholder: "Looking to buy or sell...",
      descriptionPlaceholder: "List items, quantity, condition, and needed timeline.",
      budgetLabelMin: "Budget min (optional)",
      budgetLabelMax: "Budget max (optional)",
      budgetPlaceholderMin: "100",
      budgetPlaceholderMax: "1500",
    },
    other: {
      label: "Not sure yet",
      hint: "Start here if your request does not fit the options above",
      bestFor: "Unclear scope, mixed needs, early-stage request",
      category: "other",
      titlePlaceholder: "What do you need help with?",
      descriptionPlaceholder: "Add enough detail so the right people can understand the request.",
      budgetLabelMin: "Budget min (optional)",
      budgetLabelMax: "Budget max (optional)",
      budgetPlaceholderMin: "100",
      budgetPlaceholderMax: "1000",
    },
  };

  const requestTypeOrder: Array<keyof typeof requestTypeMeta> = [
    "service_request",
    "business_request",
    "customer_support",
    "employment",
    "buy_sell",
    "other",
  ];

  const assetComponentTypeOptions: Array<{
    value:
      | "roof"
      | "hvac"
      | "plumbing"
      | "electrical"
      | "foundation"
      | "exterior"
      | "interior"
      | "appliance"
      | "permit_document"
      | "other";
    label: string;
  }> = [
    { value: "roof", label: "Roof" },
    { value: "hvac", label: "HVAC" },
    { value: "plumbing", label: "Plumbing" },
    { value: "electrical", label: "Electrical" },
    { value: "foundation", label: "Foundation" },
    { value: "exterior", label: "Exterior" },
    { value: "interior", label: "Interior" },
    { value: "appliance", label: "Appliance" },
    { value: "permit_document", label: "Permit / Document" },
    { value: "other", label: "Other" },
  ];

  const activeRequestMeta = requestTypeMeta[requestType];

  const selectHomeRecordIntent = (
    nextIntent: "link_existing" | "create_from_request" | "update_from_request" | "skip_for_now",
    source: string
  ) => {
    setHomeContextIntent(nextIntent);
    const userState = user?.id ? "authenticated" : "anonymous";
    if (nextIntent === "skip_for_now") {
      trackDirectConnectHomeRecordSkipped({
        userState,
        source,
        componentType: assetComponentType || undefined,
      });
      homeRecordSkippedRef.current = true;
      return;
    }
    homeRecordSkippedRef.current = false;
    if (nextIntent === "create_from_request") {
      trackDirectConnectHomeRecordCreateSelected({
        userState,
        source,
        componentType: assetComponentType || undefined,
      });
      return;
    }
    trackDirectConnectHomeRecordLinkSelected({
      userState,
      source,
      homeId: selectedHomeId || undefined,
      componentType: assetComponentType || undefined,
    });
  };

  const emitHomeRecordPromptViewed = (sourceOverride?: string) => {
    if (homeRecordPromptViewedRef.current) return;
    homeRecordPromptViewedRef.current = true;
    const userState = user?.id ? "authenticated" : "anonymous";
    trackDirectConnectHomeRecordPromptViewed({
      userState,
      source:
        sourceOverride ||
        (hasExistingHomes
          ? "direct_connect_home_record_prompt_with_saved_home"
          : "direct_connect_home_record_prompt_no_saved_home"),
      homeId: selectedHomeId || undefined,
      componentType: assetComponentType || undefined,
    });
  };

  const markRequestStarted = (
    field: "type" | "title" | "description" | "attachment" | "budget"
  ) => {
    if (requestStartedRef.current) return;
    requestStartedRef.current = true;
    emitHomeRecordPromptViewed("direct_connect_home_record_prompt_request_start");
    const userState = user?.id ? "authenticated" : "anonymous";
    void trackShellEvent({
      type: "direct_connect_request_started",
      category: activeRequestMeta.category,
      field,
      source: prefillSource || null,
      deviceType: getDeviceType(),
      ts: new Date().toISOString(),
    });
    trackDirectConnectRequestStarted({
      userState,
      source: prefillSource || "direct_connect_start",
      homeId: selectedHomeId || undefined,
      componentType: assetComponentType || undefined,
    });
  };

  useEffect(() => {
    markRequestStarted("type");
  }, []);

  const { data: localDirectoryCandidates = [], isLoading: isDirectoryLoading } = useQuery<
    DirectoryCandidate[]
  >({
    queryKey: [
      "/api/business-providers/search",
      "direct-connect-send-selector",
      defaultCountyFips,
      directorySearch,
      title,
      requestType,
      showDispatchSheet,
      (user as any)?.latitude,
      (user as any)?.longitude,
      (user as any)?.preferences?.geo?.homeLocation?.lat,
      (user as any)?.preferences?.geo?.homeLocation?.lng,
    ],
    enabled: showDispatchSheet,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "24");
      if (defaultCountyFips) params.set("county", defaultCountyFips);
      const fallbackQuery = title.trim().length >= 2 ? title.trim() : "";
      const query = directorySearch.trim().length > 0 ? directorySearch.trim() : fallbackQuery;
      if (query) params.set("query", query);
      params.set("sort", "distance");

      const profileLat = Number((user as any)?.latitude);
      const profileLng = Number((user as any)?.longitude);
      const homeLat = Number((user as any)?.preferences?.geo?.homeLocation?.lat);
      const homeLng = Number((user as any)?.preferences?.geo?.homeLocation?.lng);
      const viewerLat = Number.isFinite(profileLat)
        ? profileLat
        : Number.isFinite(homeLat)
          ? homeLat
          : undefined;
      const viewerLng = Number.isFinite(profileLng)
        ? profileLng
        : Number.isFinite(homeLng)
          ? homeLng
          : undefined;

      if (viewerLat != null && viewerLng != null) {
        params.set("lat", String(viewerLat));
        params.set("lng", String(viewerLng));
      }

      try {
        const payload = await apiRequest(
          "GET",
          `/api/business-providers/search?${params.toString()}`
        );
        return Array.isArray(payload) ? (payload as DirectoryCandidate[]) : [];
      } catch (error) {
        trackDirectConnectApiFailure({
          source: "/api/business-providers/search",
          section: "dispatch_selection",
          status: Number((error as any)?.status),
          error,
          blocked: false,
        });
        return [];
      }
    },
  });

  const rankedCandidates = useMemo(() => {
    return [...localDirectoryCandidates].sort((a, b) => {
      // Recommendation-first: CVS score is the composite trust/recommendation
      // signal (recommendations + user activity + trust categories). Location
      // is the tiebreak so equally-trusted providers surface the closest first.
      const cvsDiff = getCandidateCvsScore(b) - getCandidateCvsScore(a);
      if (cvsDiff !== 0) return cvsDiff;
      return (
        getCandidateLocationScore(b, defaultCountyFips) -
        getCandidateLocationScore(a, defaultCountyFips)
      );
    });
  }, [defaultCountyFips, localDirectoryCandidates]);

  const topCountIds = useMemo(
    () => rankedCandidates.slice(0, dispatchCount).map((candidate) => candidate.id),
    [dispatchCount, rankedCandidates]
  );
  const topCountSelectionKey = topCountIds.join("|");

  useEffect(() => {
    if (!showDispatchSheet) return;
    if (dispatchMode === "top_count") {
      setSelectedContractorIds(topCountIds);
      return;
    }
    setSelectedContractorIds([]);
  }, [showDispatchSheet, dispatchMode, topCountSelectionKey]);

  useEffect(() => {
    hydrateDirectConnectDraft();
  }, []);

  useEffect(() => {
    emitHomeRecordPromptViewed();
  }, [assetComponentType, hasExistingHomes, selectedHomeId, user?.id]);

  useEffect(() => {
    if (!hasExistingHomes) return;
    if (selectedHomeId) return;
    if (homeContextIntent !== "skip_for_now") return;
    const firstHomeId = String((homes[0] as any)?.id || "").trim();
    if (!firstHomeId) return;
    setSelectedHomeId(firstHomeId);
    setHomeContextIntent("link_existing");
  }, [hasExistingHomes, homeContextIntent, homes, selectedHomeId]);

  useEffect(() => {
    if (!intentConfig) return;
    if (hasAppliedIntentDefaultsRef.current) return;
    hasAppliedIntentDefaultsRef.current = true;
    setRequestType(intentConfig.requestType);
    setTitle((current) => (current.trim().length > 0 ? current : intentConfig.chips[0] || ""));
    setDescription((current) =>
      current.trim().length > 0
        ? current
        : `${intentConfig.prompt} Share details, timing, and location.`
    );
  }, [intentConfig]);

  useEffect(() => {
    if (contextualAutofillAppliedRef.current) return;
    if (!isAuthenticated) return;
    if (!homesQuery.isFetched || !recentRequestsQuery.isFetched) return;

    const profile = (user as any) || {};
    const home = hasExistingHomes ? (homes[0] as any) : null;

    const profileCity =
      typeof profile.city === "string"
        ? profile.city.trim()
        : typeof profile.preferences?.geo?.homeLocation?.city === "string"
          ? String(profile.preferences.geo.homeLocation.city).trim()
          : "";
    const profileState =
      typeof profile.stateCode === "string"
        ? profile.stateCode.trim().toUpperCase()
        : typeof profile.preferences?.geo?.homeLocation?.state === "string"
          ? String(profile.preferences.geo.homeLocation.state).trim().toUpperCase()
          : "";
    const profileZip =
      typeof profile.zipCode === "string"
        ? profile.zipCode.trim()
        : typeof profile.zip === "string"
          ? profile.zip.trim()
          : typeof profile.preferences?.geo?.homeLocation?.zip === "string"
            ? String(profile.preferences.geo.homeLocation.zip).trim()
            : "";

    const homeCity = typeof home?.city === "string" ? home.city.trim() : "";
    const homeState =
      typeof home?.stateCode === "string" ? String(home.stateCode).trim().toUpperCase() : "";
    const homeZip =
      typeof home?.zipCode === "string"
        ? String(home.zipCode).trim()
        : typeof home?.postalCode === "string"
          ? String(home.postalCode).trim()
          : "";

    const city = homeCity || profileCity;
    const state = homeState || profileState;
    const zip = homeZip || profileZip;

    const countySource =
      defaultCountyFips ||
      (typeof profile.countyFips === "string" ? profile.countyFips : "") ||
      (typeof home?.countyFips === "string" ? home.countyFips : "");
    const countyLabel = countySource ? formatCountyLabel(countySource) : "";

    const locationBits = [
      [city, state].filter(Boolean).join(", "),
      zip,
      countyLabel && countyLabel !== countySource ? countyLabel : "",
    ].filter((part) => typeof part === "string" && part.trim().length > 0);
    const locationSuggestion = locationBits.join(" · ");

    const laneSignal = String(
      profile?.onboarding?.lane ||
        profile?.preferences?.onboarding?.lane ||
        profile?.userIntent ||
        ""
    ).toLowerCase();
    const roleSignal = String(profile?.role || "").toLowerCase();
    const latestTitle = String(latestRequest?.title || "").trim();
    const latestDescription = String(latestRequest?.description || "").trim();

    let suggestedType: RequestType | null = null;
    if (
      /(offer_services|business|provider|contractor)/.test(laneSignal) ||
      /contractor|business/.test(roleSignal)
    ) {
      suggestedType = "business_request";
    } else if (/(hire|job|staff|employment)/.test(laneSignal)) {
      suggestedType = "employment";
    } else if (/(sell|buy|exchange|marketplace|inventory|material)/.test(laneSignal)) {
      suggestedType = "buy_sell";
    } else if (/(property|tenant|hoa|resident)/.test(laneSignal)) {
      suggestedType = "customer_support";
    }

    let changed = false;
    const nextSources: string[] = [];
    const nextSnapshot: {
      title?: string;
      description?: string;
      where?: string;
      requestType?: RequestType;
    } = {};

    if (!title.trim() && latestTitle) {
      setTitle(latestTitle);
      setDetailAnswers((current) => ({
        ...current,
        what: current.what.trim() ? current.what : latestTitle,
      }));
      changed = true;
      nextSources.push("Recent activity");
      nextSnapshot.title = latestTitle;
    }

    if (!description.trim() && latestDescription) {
      const concise = latestDescription.slice(0, 280).trim();
      setDescription(concise);
      setDetailAnswers((current) => ({
        ...current,
        details: current.details.trim() ? current.details : concise,
      }));
      changed = true;
      nextSources.push("Recent activity");
      nextSnapshot.description = concise;
    }

    if (!detailAnswers.where.trim() && locationSuggestion) {
      setDetailAnswers((current) => ({ ...current, where: locationSuggestion }));
      changed = true;
      nextSources.push("Location profile");
      nextSnapshot.where = locationSuggestion;
    }

    if (!prefillSource && requestType === "service_request" && suggestedType) {
      setRequestType(suggestedType);
      changed = true;
      nextSources.push("Onboarding profile");
      nextSnapshot.requestType = suggestedType;
    }

    if (changed) {
      contextualAutofillSnapshotRef.current = nextSnapshot;
      setAutofillSources(Array.from(new Set(nextSources)));
      void trackShellEvent({
        type: "direct_connect_request_started",
        category: activeRequestMeta.category,
        field: "type",
        source: prefillSource || "profile_activity",
        deviceType: getDeviceType(),
        ts: new Date().toISOString(),
      });
    } else {
      contextualAutofillSnapshotRef.current = {};
      setAutofillSources([]);
    }

    contextualAutofillAppliedRef.current = true;
  }, [
    activeRequestMeta.category,
    defaultCountyFips,
    detailAnswers.where,
    description,
    hasExistingHomes,
    homes,
    homesQuery.isFetched,
    isAuthenticated,
    latestRequest?.description,
    latestRequest?.title,
    prefillSource,
    recentRequestsQuery.isFetched,
    requestType,
    title,
    user,
  ]);

  const createMutation = useMutation<any, any, DirectConnectCreateDispatch | undefined>({
    mutationFn: async (dispatch?: DirectConnectCreateDispatch) => {
      const uploadedAttachmentKeys = new Set<string>(draftAttachmentKeys);
      for (const attachment of attachmentsRef.current) {
        const { objectKey } = await uploadPrivateObject(attachment.file);
        uploadedAttachmentKeys.add(objectKey);
      }
      const nextDraftAttachmentKeys = Array.from(uploadedAttachmentKeys).filter(
        (key) => typeof key === "string" && key.trim()
      );
      setDraftAttachmentKeys(Array.from(new Set(nextDraftAttachmentKeys)).slice(0, 8));

      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        category: activeRequestMeta.category,
        ...(nextDraftAttachmentKeys.length > 0
          ? { attachments: nextDraftAttachmentKeys.slice(0, 8) }
          : {}),
      };

      if (defaultCountyFips) payload.countyFips = defaultCountyFips;
      const stateCode =
        typeof (user as any)?.stateCode === "string" ? String((user as any).stateCode) : "";
      if (stateCode.trim().length === 2) payload.stateCode = stateCode.trim().toUpperCase();

      const min = Number(budgetMin);
      const max = Number(budgetMax);
      if (Number.isFinite(min) && min > 0) payload.budgetMin = min;
      if (Number.isFinite(max) && max > 0) payload.budgetMax = max;
      if (prefillTradeId?.trim()) payload.tradeId = prefillTradeId.trim();
      if (dispatch?.targetProviderIds?.length) {
        payload.targetProviderIds = Array.from(new Set(dispatch.targetProviderIds));
        payload.autoRoute = false;
      } else if (typeof dispatch?.autoRoute === "boolean") {
        payload.autoRoute = dispatch.autoRoute;
      }
      if (dispatch?.homeContextIntent && dispatch.homeContextIntent !== "skip_for_now") {
        payload.homeContextIntent = dispatch.homeContextIntent;
      }
      if (dispatch?.homeId?.trim()) payload.homeId = dispatch.homeId.trim();
      if (dispatch?.assetComponentType) payload.assetComponentType = dispatch.assetComponentType;
      if (dispatch?.assetComponentId?.trim())
        payload.assetComponentId = dispatch.assetComponentId.trim();
      if (dispatch?.assetLabel?.trim()) payload.assetLabel = dispatch.assetLabel.trim();

      return apiRequest("POST", "/api/direct-connect/requests", payload);
    },
    onSuccess: (data, variables) => {
      const attachmentCount = attachmentsRef.current.length;
      const selectedCount = Array.isArray(variables?.targetProviderIds)
        ? variables.targetProviderIds.length
        : 0;
      const userState = user?.id ? "authenticated" : "anonymous";
      if (variables?.homeId || variables?.homeContextIntent === "create_from_request") {
        trackDirectConnectHomeIdLinkSelected({
          userState,
          homeId: variables?.homeId || undefined,
          componentType: variables?.assetComponentType || undefined,
          source: variables?.homeContextIntent || "direct_connect_submit",
        });
      }
      if (
        homeRecordSkippedRef.current ||
        variables?.homeContextIntent === "skip_for_now" ||
        (!variables?.homeId && !variables?.homeContextIntent)
      ) {
        trackDirectConnectRequestSubmittedAfterHomeRecordSkip({
          userState,
          source: "direct_connect_submit_after_home_record_skip",
          componentType: variables?.assetComponentType || undefined,
        });
      }
      trackShellEvent({
        type: "scout_query",
        payload: {
          event: "direct_connect_request_created",
          category: activeRequestMeta.category,
          hasBudget: Boolean(budgetMin.trim() || budgetMax.trim()),
          attachmentCount,
          dispatchMode: variables?.dispatchMode || "auto_route",
          dispatchCount: variables?.dispatchCount || null,
          directTargets: selectedCount,
        },
      });
      void trackShellEvent({
        type: "direct_connect_request_submitted",
        category: activeRequestMeta.category,
        hasBudget: Boolean(budgetMin.trim() || budgetMax.trim()),
        attachmentCount,
        dispatchMode: variables?.dispatchMode || "auto_route",
        dispatchCount: variables?.dispatchCount || null,
        directTargets: selectedCount,
        source: prefillSource || null,
        deviceType: getDeviceType(),
        ts: new Date().toISOString(),
      });
      const submittedRequestId = String((data as any)?.id || "");
      const homeIdMemoryCopy = getPostSubmitHomeIdMemoryCopy(hasExistingHomes);
      toast({
        title: "Request sent",
        description: (
          <div className="space-y-1">
            <p>Your request is live.</p>
            <p>{homeIdMemoryCopy.description}</p>
          </div>
        ),
        action: (
          <ToastAction
            altText={homeIdMemoryCopy.actionLabel}
            onClick={() => {
              const params = new URLSearchParams({
                source: "direct_connect_submitted",
              });
              if (submittedRequestId) params.set("requestId", submittedRequestId);
              navigate(`/homes?${params.toString()}`);
            }}
          >
            {homeIdMemoryCopy.actionLabel}
          </ToastAction>
        ),
      });
      setTitle("");
      setDescription("");
      setBudgetMin("");
      setBudgetMax("");
      setShowOptional(false);
      setShowDispatchSheet(false);
      setShowRequestReady(false);
      setDescribeStep(0);
      setDispatchMode("top_count");
      setDispatchCount(3);
      setDirectorySearch("");
      setSelectedContractorIds([]);
      setSelectedHomeId("");
      setAssetComponentType("other");
      setAssetComponentId("");
      setAssetLabel("");
      setHomeContextIntent("skip_for_now");
      homeRecordSkippedRef.current = false;
      requestStartedRef.current = false;
      clearAttachments();
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests", "count"] });
      clearDirectConnectDraft();
      navigate("/direct-connect/inbox");
    },
    onError: (error: any, _variables: DirectConnectCreateDispatch | undefined) => {
      const variables = _variables ?? {};
      trackDirectConnectApiFailure({
        source: "/api/direct-connect/requests",
        section: "submit",
        status: Number(error?.status),
        error,
        blocked: true,
      });
      if (error?.status === 401) {
        trackFrictionEvent("direct_connect_permission_or_role_blocked", {
          source: currentReturnPath(),
          section: "submit",
          reason: "auth_required",
          blocked: true,
        });
        persistDirectConnectDraft({
          selectedProviderIds: variables?.targetProviderIds || selectedContractorIds,
        });
        trackOncePerSession(
          "direct-connect-auth-handoff-submit",
          "direct_connect_auth_handoff_stalled",
          {
            source: currentReturnPath(),
            section: "auth_handoff",
            reason: "auth_required_before_submit",
            blocked: true,
          }
        );
        toast({
          title: "Sign in to send",
          description: "Your request draft is ready. Sign in to review and send it.",
        });
        const next = encodeURIComponent(currentReturnPath());
        navigate(`/pre-scout-setup?mode=signin&next=${next}`);
        return;
      }

      const isVerificationGate =
        error?.status === 428 ||
        String(error?.code || "").toUpperCase() === "VERIFICATION_REQUIRED";
      if (isVerificationGate) {
        trackFrictionEvent("direct_connect_permission_or_role_blocked", {
          source: currentReturnPath(),
          section: "submit",
          reason: "verification_required",
          blocked: true,
        });
        toast({
          title: "Address verification required",
          description: formatUserFacingErrorMessage(
            error,
            "Finish verification before sending a request."
          ),
          variant: "destructive",
        });
        navigate("/verification");
        return;
      }

      toast({
        title: "Could not send request",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const requiredQuestions =
    intentConfig?.detailQuestions?.filter((question) => question.required) || [];
  const completeness = evaluateRequestCompleteness({
    answers: detailAnswers,
    requiredQuestions,
    title,
    description,
  });
  const routingReadiness: DirectConnectRoutingReadiness = evaluateRoutingReadiness({
    category: activeRequestMeta.category,
    answers: detailAnswers,
    description,
    completenessState: completeness.level,
  });
  const reviewCardReady = completeness.level !== "too_vague";
  const reviewTitle = detailAnswers.what.trim() || title.trim() || "Request";
  const reviewSummary =
    detailAnswers.details.trim() || description.trim() || "No extra details yet.";
  const reviewLocation = detailAnswers.where.trim() || "Location pending";
  const reviewTiming = detailAnswers.when.trim() || "Timing pending";
  const canonicalRequest: CanonicalDirectConnectRequest = {
    requestId: "draft",
    intent: directConnectIntent || "unknown",
    requestType,
    category: activeRequestMeta.category,
    county: defaultCountyFips || null,
    cityArea: detailAnswers.where.trim() || null,
    urgency: detailAnswers.when.trim() || null,
    description: description.trim(),
    answers: detailAnswers,
    completenessState: completeness.level,
    routingReadiness,
    visibilityState: showDispatchSheet ? "shared_local" : "review_ready",
    contactGateState: showDispatchSheet ? "request_shared" : "review_required",
    createdAt: new Date().toISOString(),
    sourceSurface: "direct_connect",
  };
  const selectedContractorCount = selectedContractorIds.length;
  const missingLabels = new Set(completeness.missing.map((item) => item.toLowerCase()));
  const isQuestionMissing = (question: {
    label: string;
    key: "what" | "where" | "when" | "details";
    required?: boolean;
  }) =>
    question.required &&
    (detailAnswers[question.key].trim().length < 2 ||
      missingLabels.has(question.label.replace(/\s*\*$/, "").toLowerCase()));
  const showTitleMissingHint =
    !reviewCardReady && title.trim().length < 3 && detailAnswers.what.trim().length < 3;
  const showDescriptionMissingHint =
    !reviewCardReady && description.trim().length < 10 && detailAnswers.details.trim().length < 10;

  const handleAttachmentSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const remaining = Math.max(0, 6 - attachmentsRef.current.length);
    const files = Array.from(event.target.files || []).slice(0, remaining);
    if (!files.length) {
      event.target.value = "";
      return;
    }

    const next = [
      ...attachmentsRef.current,
      ...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ].slice(0, 6);
    replaceAttachments(next);
    event.target.value = "";
  };

  const removeAttachmentAt = (index: number) => {
    const current = attachmentsRef.current[index];
    if (current) {
      URL.revokeObjectURL(current.previewUrl);
    }
    replaceAttachments(attachmentsRef.current.filter((_, currentIndex) => currentIndex !== index));
  };

  const toggleCandidateSelection = (candidateId: string) => {
    setSelectedContractorIds((current) => {
      if (current.includes(candidateId)) {
        return current.filter((id) => id !== candidateId);
      }
      const maxTargets = dispatchMode === "top_count" ? dispatchCount : 3;
      if (current.length >= maxTargets) {
        return [...current.slice(1), candidateId];
      }
      return [...current, candidateId];
    });
  };

  const handleOpenDispatchSheet = () => {
    if (!reviewCardReady || createMutation.isPending) {
      trackFrictionEvent("direct_connect_form_validation_blocked", {
        source: currentReturnPath(),
        section: "dispatch_selection",
        field: "request_details",
        reason: createMutation.isPending ? "submit_pending" : completeness.level,
        blocked: true,
      });
      return;
    }
    if (!isAuthenticated) {
      trackFrictionEvent("direct_connect_permission_or_role_blocked", {
        source: currentReturnPath(),
        section: "dispatch_selection",
        reason: "auth_required",
        blocked: true,
      });
      persistDirectConnectDraft({ selectedProviderIds: selectedContractorIds });
      trackOncePerSession(
        "direct-connect-auth-handoff-dispatch-selection",
        "direct_connect_auth_handoff_stalled",
        {
          source: currentReturnPath(),
          section: "auth_handoff",
          reason: "auth_required_before_dispatch",
          blocked: true,
        }
      );
      toast({
        title: "Create your free account to share this request",
        description: "Your contact information stays private until you approve a contact request.",
      });
      const next = encodeURIComponent(currentReturnPath());
      navigate(`/pre-scout-setup?mode=signin&next=${next}`);
      return;
    }
    setShowDispatchSheet(true);
  };

  const openRequestReadyState = () => {
    if (!reviewCardReady || createMutation.isPending) {
      trackFrictionEvent("direct_connect_form_validation_blocked", {
        source: currentReturnPath(),
        section: "review",
        field: "request_details",
        reason: createMutation.isPending ? "submit_pending" : completeness.level,
        blocked: true,
      });
      return;
    }
    void trackShellEvent({
      type: "direct_connect_request_review_opened",
      category: activeRequestMeta.category,
      hasBudget: Boolean(budgetMin.trim() || budgetMax.trim()),
      attachmentCount: attachments.length,
      homeContextIntent,
      deviceType: getDeviceType(),
      ts: new Date().toISOString(),
    });
    setShowRequestReady(true);
  };

  const handleSendWithSelection = () => {
    trackRepeatedFrictionSignal({
      key: "direct-connect-submit-with-selection",
      type: "direct_connect_repeated_submit_attempt",
      threshold: 2,
      windowMs: DIRECT_CONNECT_REPEATED_SUBMIT_WINDOW_MS,
      payload: {
        source: currentReturnPath(),
        section: "submit",
        field: "send_with_selection",
        blocked: createMutation.isPending,
      },
    });
    const targetProviderIds = Array.from(new Set(selectedContractorIds));
    const userState = user?.id ? "authenticated" : "anonymous";
    if (homeContextIntent === "link_existing" || homeContextIntent === "update_from_request") {
      trackDirectConnectHomeRecordLinkSelected({
        userState,
        source: homeContextIntent,
        homeId: selectedHomeId.trim() || undefined,
        componentType: assetComponentType || undefined,
      });
    } else if (homeContextIntent === "create_from_request") {
      trackDirectConnectHomeRecordCreateSelected({
        userState,
        source: homeContextIntent,
        componentType: assetComponentType || undefined,
      });
    } else {
      trackDirectConnectHomeRecordSkipped({
        userState,
        source: "skip_for_now_send_with_selection",
        componentType: assetComponentType || undefined,
      });
      homeRecordSkippedRef.current = true;
    }
    createMutation.mutate({
      targetProviderIds,
      autoRoute: false,
      dispatchMode,
      dispatchCount: dispatchMode === "top_count" ? dispatchCount : targetProviderIds.length,
      homeId: selectedHomeId.trim() || undefined,
      assetComponentType: assetComponentType || undefined,
      assetComponentId: assetComponentId.trim() || undefined,
      assetLabel: assetLabel.trim() || undefined,
      homeContextIntent,
    });
  };

  const handleSkipAndAutoRoute = () => {
    trackRepeatedFrictionSignal({
      key: "direct-connect-submit-auto-route",
      type: "direct_connect_repeated_submit_attempt",
      threshold: 2,
      windowMs: DIRECT_CONNECT_REPEATED_SUBMIT_WINDOW_MS,
      payload: {
        source: currentReturnPath(),
        section: "submit",
        field: "continue_without_selection",
        blocked: createMutation.isPending,
      },
    });
    const userState = user?.id ? "authenticated" : "anonymous";
    trackDirectConnectHomeRecordSkipped({
      userState,
      source: "skip_for_now_continue_without_selection",
      componentType: assetComponentType || undefined,
    });
    homeRecordSkippedRef.current = true;
    createMutation.mutate({
      targetProviderIds: [],
      autoRoute: true,
      dispatchMode,
      dispatchCount: 0,
      homeId: selectedHomeId.trim() || undefined,
      assetComponentType: assetComponentType || undefined,
      assetComponentId: assetComponentId.trim() || undefined,
      assetLabel: assetLabel.trim() || undefined,
      homeContextIntent,
    });
  };
  const handleDescribeReviewRequest = () => {
    if (!reviewCardReady) {
      setReviewAttempted(true);
      return;
    }
    setReviewAttempted(false);
    setDescribeStep(1);
  };

  return (
    <div
      className="mx-auto w-full max-w-xl space-y-5 px-0 pb-4 md:max-w-3xl"
      data-testid="direct-connect-mobile-composer"
    >
      <div className="space-y-1 px-1">
        <p className="text-sm font-semibold text-[color:var(--theme-accent-primary)]">
          Direct Connect
        </p>
        <h1 className="text-[1.35rem] font-semibold leading-tight text-[color:var(--text-primary)]">
          {describeStep === 0 ? "What do you need done?" : "Review your request"}
        </h1>
        <p className="max-w-[36ch] text-sm leading-5 text-[color:var(--text-secondary)]">
          {describeStep === 0
            ? "Tell local businesses what you need. Add photos on the next step."
            : "Check the details, add photos if useful, then choose who receives it."}
        </p>
      </div>

      <div
        className="flex items-center gap-2 px-1 text-xs font-medium text-[color:var(--text-secondary)]"
        aria-label="Request progress"
      >
        {(["Describe", "Review", "Send"] as const).map((step, index) => {
          const active =
            (showDispatchSheet && index === 2) ||
            (!showDispatchSheet && describeStep === 0 && index === 0) ||
            (!showDispatchSheet && describeStep === 1 && index === 1);
          const complete =
            (!showDispatchSheet && describeStep === 1 && index === 0) ||
            (showDispatchSheet && index < 2);
          return (
            <span
              key={step}
              className={cn(
                "inline-flex items-center gap-1.5",
                active || complete
                  ? "text-[color:var(--text-primary)]"
                  : "text-[color:var(--text-secondary)]/70"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  active
                    ? "bg-ts-orange"
                    : complete
                      ? "bg-[color:var(--text-primary)]"
                      : "bg-[color:var(--text-secondary)]/35"
                )}
              />
              {step}
            </span>
          );
        })}
      </div>

      <div className="space-y-5">
        {describeStep === 0 && autofillSources.length > 0 && (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-[color:var(--text-secondary)]">Autofilled:</span>
              {autofillSources.map((source) => (
                <span
                  key={source}
                  className="inline-flex items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-2.5 py-1 text-[11px] text-[color:var(--text-secondary)]"
                >
                  {source}
                </span>
              ))}
              <button
                type="button"
                onClick={clearContextualAutofill}
                className="text-[11px] font-medium text-[color:var(--theme-accent-primary)] hover:underline"
              >
                Clear autofill
              </button>
            </div>
          </div>
        )}
        {describeStep === 0 && (
          <div className="space-y-5">
            {prefillTargetUserId && (
              <div className="rounded-lg border border-ts-orange/25 bg-ts-orange/10 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-ts-orange">
                  From Community
                </p>
                <p className="mt-1 text-xs text-[color:var(--text-primary)]">
                  This request is scoped to{" "}
                  <span className="font-semibold">{prefillTargetLabel}</span>.
                  {prefillSource === "community_active_now"
                    ? " They will see it in Direct Connect if they are eligible to respond."
                    : " The selected member context has been prefilled for you."}
                </p>
              </div>
            )}
            <div className="space-y-4">
              {intentConfig ? (
                <div className="rounded-lg bg-[color:var(--surface-intermediate)]/35 px-3 py-3">
                  <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">
                    {intentConfig.heading}
                  </h2>
                  <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                    {intentConfig.prompt}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {intentConfig.chips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          markRequestStarted("title");
                          setTitle(chip);
                          setDetailAnswers((current) => ({ ...current, what: chip }));
                        }}
                        className="rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-2.5 py-1 text-[11px] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <label className={REQUEST_LABEL_CLASS}>Project type</label>
              <select
                value={requestType}
                onChange={(event) => {
                  markRequestStarted("type");
                  setRequestType(event.target.value as keyof typeof requestTypeMeta);
                }}
                className={REQUEST_SELECT_CLASS}
              >
                {requestTypeOrder.map((key) => (
                  <option key={key} value={key}>
                    {requestTypeMeta[key].label}
                  </option>
                ))}
              </select>
            </div>
            {intentConfig?.detailQuestions?.map((question) => (
              <div key={question.key} className="space-y-2.5">
                <label className={REQUEST_LABEL_CLASS}>{question.label}</label>
                {question.key === "details" ? (
                  <>
                    <Textarea
                      value={detailAnswers[question.key]}
                      onChange={(event) => {
                        markRequestStarted("description");
                        const next = event.target.value;
                        setDetailAnswers((current) => ({ ...current, [question.key]: next }));
                        setDescription(next);
                      }}
                      placeholder={question.placeholder}
                      rows={4}
                      className={REQUEST_TEXTAREA_CLASS}
                    />
                    {reviewAttempted && isQuestionMissing(question) && (
                      <p className="text-[11px] text-ts-orange">Add one useful detail.</p>
                    )}
                  </>
                ) : (
                  <>
                    <Input
                      value={detailAnswers[question.key]}
                      onChange={(event) => {
                        markRequestStarted("title");
                        const next = event.target.value;
                        setDetailAnswers((current) => ({ ...current, [question.key]: next }));
                        if (question.key === "what") setTitle(next);
                      }}
                      placeholder={question.placeholder}
                      className={REQUEST_FIELD_CLASS}
                    />
                    {reviewAttempted && isQuestionMissing(question) && (
                      <p className="text-[11px] text-ts-orange">Add this detail.</p>
                    )}
                  </>
                )}
              </div>
            ))}
            {!intentConfig && (
              <>
                <div className="space-y-2.5">
                  <label className={REQUEST_LABEL_CLASS}>What do you need help with?</label>
                  <Input
                    value={title}
                    onChange={(event) => {
                      markRequestStarted("title");
                      const next = event.target.value;
                      setTitle(next);
                      setDetailAnswers((current) => ({ ...current, what: next }));
                    }}
                    placeholder="Fix a leaking kitchen faucet"
                    className={REQUEST_FIELD_CLASS}
                  />
                  {reviewAttempted && showTitleMissingHint && (
                    <p className="text-[11px] text-ts-orange">Add what you need.</p>
                  )}
                </div>
                <div className="space-y-2.5">
                  <label className={REQUEST_LABEL_CLASS}>Details</label>
                  <Textarea
                    value={description}
                    onChange={(event) => {
                      markRequestStarted("description");
                      const next = event.target.value;
                      setDescription(next);
                      setDetailAnswers((current) => ({ ...current, details: next }));
                    }}
                    placeholder="What is happening? What have you tried? Any deadline?"
                    rows={4}
                    className={REQUEST_TEXTAREA_CLASS}
                  />
                  {reviewAttempted && showDescriptionMissingHint && (
                    <p className="text-[11px] text-ts-orange">Add one useful detail.</p>
                  )}
                </div>
                <div className="space-y-2.5">
                  <label className={REQUEST_LABEL_CLASS}>Where is the job?</label>
                  <Input
                    value={detailAnswers.where}
                    onChange={(event) => {
                      markRequestStarted("title");
                      setDetailAnswers((current) => ({ ...current, where: event.target.value }));
                    }}
                    placeholder="City, county, ZIP, or service area"
                    className={REQUEST_FIELD_CLASS}
                  />
                </div>
              </>
            )}
            <div className="pt-1">
              <Button
                type="button"
                onClick={handleDescribeReviewRequest}
                aria-disabled={!reviewCardReady}
                className={cn(
                  "h-auto w-full rounded-full py-3.5 text-base font-semibold",
                  reviewCardReady
                    ? "bg-ts-orange text-text-black hover:bg-ts-orange/90"
                    : "bg-[color:var(--surface-intermediate)] text-[color:var(--text-secondary)]"
                )}
              >
                Review request
              </Button>
              <p className="mt-3 text-center text-xs text-[color:var(--text-secondary)]">
                Prefer browsing first?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/direct-connect/pros")}
                  className="font-medium text-[color:var(--theme-accent-primary)] hover:underline"
                >
                  Open directory
                </button>
              </p>
            </div>
          </div>
        )}
        {describeStep === 1 && (
          <div className="space-y-5">
            {reviewCardReady && (
              <div className="rounded-xl border border-[color:var(--theme-accent-primary)]/35 bg-[color:var(--surface-intermediate)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--theme-accent-primary)]">
                      Request details review
                    </p>
                    <h3 className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">
                      {reviewTitle}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-[color:var(--text-secondary)]">
                      {reviewSummary}
                    </p>
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-3 text-xs md:w-[260px]">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
                        Location
                      </p>
                      <p className="mt-1 truncate font-medium text-[color:var(--text-primary)]">
                        {reviewLocation}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
                        Timing
                      </p>
                      <p className="mt-1 truncate font-medium text-[color:var(--text-primary)]">
                        {reviewTiming}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-[color:var(--text-secondary)]">
                  Check the request before you send it. {completeness.message} ·{" "}
                  {reviewCardReady ? "Ready for review" : "Add details to review"}
                </p>
                {completeness.missing.length > 0 && (
                  <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                    Add: {completeness.missing.join(" · ")}
                  </p>
                )}
              </div>
            )}
            {showRequestReady && (
              <div className="space-y-3 rounded-xl border border-[color:var(--theme-accent-primary)]/40 bg-[color:var(--surface-intermediate)] p-3 shadow-[0_14px_42px_rgba(0,0,0,0.2)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
                      Ready to submit
                    </h3>
                    <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                      Your request is ready to review.
                    </p>
                  </div>
                  <Badge className="bg-[color:var(--theme-accent-primary)] text-text-black">
                    Private
                  </Badge>
                </div>
                <div className="grid gap-2.5 text-xs text-[color:var(--text-secondary)] md:grid-cols-2">
                  {[
                    ["Request type", activeRequestMeta.label],
                    ["Location / county", reviewLocation],
                    ["Urgency", reviewTiming],
                    ["Summary", reviewSummary],
                    ["Next step", "Choose who receives it"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
                        {label}
                      </p>
                      <p className="mt-1 text-[color:var(--text-primary)]">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleOpenDispatchSheet}
                    disabled={!reviewCardReady || createMutation.isPending}
                    className="rounded-full bg-ts-orange text-text-black hover:bg-ts-orange/90"
                  >
                    Send when ready
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowRequestReady(false)}
                    className="rounded-full"
                  >
                    Edit request
                  </Button>
                </div>
                <DirectConnectGiveawayDisclosure />
              </div>
            )}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className={REQUEST_LABEL_CLASS}>Request photos</label>
                <span className="rounded-full bg-[color:var(--surface-intermediate)] px-2 py-1 text-[11px] text-[color:var(--text-secondary)]">
                  {attachments.length}/6 added
                </span>
              </div>
              <label className="flex cursor-pointer flex-col gap-3 rounded-lg border border-dashed border-[color:var(--theme-accent-primary)]/35 bg-[color:var(--surface-intermediate)]/45 px-4 py-4 transition-colors hover:border-[color:var(--theme-accent-primary)]/65 hover:bg-[color:var(--surface-intermediate)]/65 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color:var(--theme-accent-primary)]/12 text-[color:var(--theme-accent-primary)]">
                    <UploadCloud className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-medium text-[color:var(--text-primary)]">
                      Add photos to this request
                    </div>
                    <div className={REQUEST_HELPER_CLASS}>
                      Pros respond faster and quote more accurately when they can see the job.
                    </div>
                  </div>
                </div>
                <span className="text-xs font-medium text-[color:var(--text-secondary)]">
                  JPG, PNG, WEBP
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    markRequestStarted("attachment");
                    handleAttachmentSelect(event);
                  }}
                />
              </label>
              {attachments.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {attachments.map((attachment, index) => (
                    <div
                      key={`${attachment.file.name}-${index}`}
                      className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[color:var(--border-subtle)]"
                    >
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.file.name}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
                        onClick={() => removeAttachmentAt(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-3 rounded-lg border border-[color:var(--border-subtle)]/65 bg-[color:var(--surface-intermediate)]/35 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                    Save to HomeID
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--text-secondary)]">
                    Save it so the next repair starts with this history already on file.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-[color:var(--border-subtle)]/80 px-2.5 text-xs text-[color:var(--text-primary)]"
                    onClick={() => setShowHomeRecordDetails((current) => !current)}
                  >
                    {showHomeRecordDetails ? "Hide options" : "Add HomeID details"}
                  </Button>
                  {!showHomeRecordDetails && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-[color:var(--text-secondary)]"
                      onClick={() =>
                        selectHomeRecordIntent("skip_for_now", "home_record_compact_skip_selected")
                      }
                    >
                      Skip for now
                    </Button>
                  )}
                </div>
              </div>
              {showHomeRecordDetails && (
                <div className="grid gap-2 md:grid-cols-3">
                  <Button
                    type="button"
                    variant={homeContextIntent === "link_existing" ? "default" : "outline"}
                    onClick={() => {
                      setShowHomeRecordDetails(true);
                      selectHomeRecordIntent("link_existing", "home_record_compact_link_selected");
                    }}
                    className={
                      homeContextIntent === "link_existing" ? "bg-ts-orange text-text-black" : ""
                    }
                  >
                    Use saved home details
                  </Button>
                  <Button
                    type="button"
                    variant={homeContextIntent === "create_from_request" ? "default" : "outline"}
                    onClick={() => {
                      setShowHomeRecordDetails(true);
                      selectHomeRecordIntent(
                        "create_from_request",
                        "home_record_compact_create_selected"
                      );
                    }}
                    className={
                      homeContextIntent === "create_from_request"
                        ? "bg-ts-orange text-text-black"
                        : ""
                    }
                  >
                    Create a home record
                  </Button>
                  <Button
                    type="button"
                    variant={homeContextIntent === "skip_for_now" ? "default" : "outline"}
                    onClick={() => {
                      setShowHomeRecordDetails(false);
                      selectHomeRecordIntent("skip_for_now", "home_record_compact_skip_selected");
                    }}
                    className={
                      homeContextIntent === "skip_for_now" ? "bg-ts-orange text-text-black" : ""
                    }
                  >
                    Skip for now
                  </Button>
                </div>
              )}
              {showHomeRecordDetails && homeContextIntent === "link_existing" && (
                <div className="space-y-3 rounded-lg border border-[color:var(--border-subtle)]/70 bg-[color:var(--surface-card)]/70 p-3">
                  <div className="space-y-2.5">
                    <label className={REQUEST_LABEL_CLASS}>Use saved home details</label>
                    <select
                      value={selectedHomeId}
                      onChange={(event) => {
                        const nextHomeId = event.target.value;
                        setSelectedHomeId(nextHomeId);
                        const userState = user?.id ? "authenticated" : "anonymous";
                        if (nextHomeId) {
                          selectHomeRecordIntent(
                            "link_existing",
                            "home_record_select_saved_home_auto_link"
                          );
                          trackDirectConnectHomeRecordLinkSelected({
                            userState,
                            source: "home_record_select_saved_home",
                            homeId: nextHomeId,
                            componentType: assetComponentType || undefined,
                          });
                        }
                      }}
                      className={REQUEST_SELECT_CLASS}
                    >
                      <option value="">
                        {hasExistingHomes ? "Select a saved home" : "No saved homes yet"}
                      </option>
                      {homes.map((home: any) => (
                        <option key={String(home?.id || "")} value={String(home?.id || "")}>
                          {toCleanHomeLabel(home)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2.5">
                      <label className={REQUEST_LABEL_CLASS}>System or component</label>
                      <select
                        value={assetComponentType}
                        onChange={(event) =>
                          setAssetComponentType(
                            event.target.value as
                              | "roof"
                              | "hvac"
                              | "plumbing"
                              | "electrical"
                              | "foundation"
                              | "exterior"
                              | "interior"
                              | "appliance"
                              | "permit_document"
                              | "other"
                          )
                        }
                        className={REQUEST_SELECT_CLASS}
                      >
                        {assetComponentTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2.5">
                      <label className={REQUEST_LABEL_CLASS}>Component label</label>
                      <Input
                        value={assetLabel}
                        onChange={(event) => setAssetLabel(event.target.value)}
                        placeholder="Upstairs AC, main panel, etc."
                        className={REQUEST_FIELD_CLASS}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-1 text-xs text-[color:var(--text-secondary)]"
                onClick={() => setShowOptional((current) => !current)}
              >
                {showOptional ? "Hide optional budget" : "Add optional budget"}
              </Button>
              {showOptional && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2.5">
                    <label className={REQUEST_LABEL_CLASS}>
                      {activeRequestMeta.budgetLabelMin}
                    </label>
                    <Input
                      value={budgetMin}
                      onChange={(event) => {
                        markRequestStarted("budget");
                        setBudgetMin(event.target.value);
                      }}
                      inputMode="numeric"
                      placeholder={activeRequestMeta.budgetPlaceholderMin}
                      className={REQUEST_FIELD_CLASS}
                    />
                  </div>
                  <div className="space-y-2.5">
                    <label className={REQUEST_LABEL_CLASS}>
                      {activeRequestMeta.budgetLabelMax}
                    </label>
                    <Input
                      value={budgetMax}
                      onChange={(event) => {
                        markRequestStarted("budget");
                        setBudgetMax(event.target.value);
                      }}
                      inputMode="numeric"
                      placeholder={activeRequestMeta.budgetPlaceholderMax}
                      className={REQUEST_FIELD_CLASS}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-3 rounded-xl border border-[color:var(--border-subtle)]/70 bg-[color:var(--surface-intermediate)]/35 p-3.5">
              <DirectConnectGiveawayDisclosure />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[color:var(--text-secondary)]">
                  Review your request before sending it.
                </p>
                <Button
                  onClick={openRequestReadyState}
                  disabled={createMutation.isPending || !reviewCardReady}
                  className="rounded-full bg-ts-orange text-text-black hover:bg-ts-orange/90"
                >
                  {createMutation.isPending
                    ? "Sending..."
                    : isAuthenticated
                      ? "Review request details"
                      : "Sign in to send"}
                </Button>
              </div>
            </div>
            {!reviewCardReady && (
              <p className="text-xs text-[color:var(--text-secondary)]">
                Add required details to continue:{" "}
                {completeness.missing.length > 0
                  ? completeness.missing.join(" · ")
                  : "request details"}
              </p>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDescribeStep(0)}
              className="w-full text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
            >
              Back to details
            </Button>
          </div>
        )}

        <Sheet open={showDispatchSheet} onOpenChange={setShowDispatchSheet}>
          <SheetContent
            side="right"
            className="w-full overflow-y-auto border-l-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-4 sm:max-w-xl"
          >
            <SheetHeader>
              <SheetTitle>Choose who can receive this request</SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]/70 p-3">
                <p className="text-xs font-medium text-[color:var(--text-primary)]">
                  Request send mode
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setDispatchMode("top_count")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                      dispatchMode === "top_count"
                        ? "border-ts-orange bg-ts-orange/20 text-[color:var(--text-primary)]"
                        : "border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] text-[color:var(--text-secondary)]"
                    )}
                  >
                    <p className="font-medium">Send to top local companies</p>
                    <p className="mt-1 text-[11px]">
                      Pick 1-3 based on local fit and trust checks.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispatchMode("direct_pick")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                      dispatchMode === "direct_pick"
                        ? "border-ts-orange bg-ts-orange/20 text-[color:var(--text-primary)]"
                        : "border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] text-[color:var(--text-secondary)]"
                    )}
                  >
                    <p className="font-medium">Send directly to a company</p>
                    <p className="mt-1 text-[11px]">Choose a company you already have in mind.</p>
                  </button>
                </div>
              </div>

              {dispatchMode === "top_count" && (
                <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]/70 p-3">
                  <p className="text-xs font-medium text-[color:var(--text-primary)]">
                    How many companies should receive this request?
                  </p>
                  <div className="mt-2 flex gap-2">
                    {[1, 2, 3].map((count) => (
                      <Button
                        key={count}
                        type="button"
                        size="sm"
                        variant={dispatchCount === count ? "default" : "outline"}
                        onClick={() => setDispatchCount(count as 1 | 2 | 3)}
                        className={cn(
                          dispatchCount === count
                            ? "bg-ts-orange text-text-black hover:bg-ts-orange/90"
                            : "border-[color:var(--border-subtle)]"
                        )}
                      >
                        {count}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-medium text-[color:var(--text-primary)]">
                  Local Directory shortlist
                </p>
                <Input
                  value={directorySearch}
                  onChange={(event) => setDirectorySearch(event.target.value)}
                  placeholder="Search local companies"
                  className="bg-[color:var(--surface-intermediate)] border-[color:var(--border-subtle)]"
                />
                <p className="text-[11px] text-[color:var(--text-secondary)]">
                  Ordered by local fit first, then trust score.
                </p>
              </div>

              {!defaultCountyFips && (
                <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  County context is missing, so local ranking may be broader than usual.
                </div>
              )}

              <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                {isDirectoryLoading && (
                  <div className="px-1 py-2 text-xs text-[color:var(--text-secondary)]">
                    Finding local businesses...
                  </div>
                )}

                {!isDirectoryLoading && rankedCandidates.length === 0 && (
                  <div className="px-1 py-2 text-xs text-[color:var(--text-secondary)]">
                    No local companies found right now. You can still send this request with none
                    selected.
                  </div>
                )}

                {!isDirectoryLoading &&
                  rankedCandidates.map((candidate, index) => {
                    const isSelected = selectedContractorIds.includes(candidate.id);
                    const distance = parseNumberOrNull(candidate.distanceMiles);
                    const cvsScore = getCandidateCvsScore(candidate);
                    const locationScore = getCandidateLocationScore(candidate, defaultCountyFips);
                    const candidateLabel =
                      candidate.companyName || candidate.name || "Local company";

                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => toggleCandidateSelection(candidate.id)}
                        className={cn(
                          "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                          isSelected
                            ? "border-ts-orange bg-ts-orange/15"
                            : "border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <Avatar className="h-9 w-9 border border-[color:var(--border-subtle)]">
                              <AvatarFallback
                                className={cn(
                                  "text-[11px] font-semibold",
                                  getProviderAvatarClass(candidateLabel)
                                )}
                              >
                                {getProviderInitials(candidateLabel)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-[color:var(--text-primary)]">
                                {index + 1}. {candidateLabel}
                              </p>
                              <p className="text-[11px] text-[color:var(--text-secondary)]">
                                {distance !== null
                                  ? `${distance.toFixed(1)} mi away`
                                  : candidate.serviceAreas?.length
                                    ? candidate.serviceAreas.slice(0, 2).join(", ")
                                    : "Local service area"}
                              </p>
                              <p className="text-[11px] text-[color:var(--text-secondary)]">
                                CVS {Math.round(cvsScore)} • Location score{" "}
                                {Math.round(locationScore)}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={isSelected ? "default" : "outline"}
                            className={cn(
                              "shrink-0 text-[10px]",
                              isSelected
                                ? "bg-ts-orange text-text-black"
                                : "border-[color:var(--border-subtle)]"
                            )}
                          >
                            {isSelected ? "Selected" : "Select"}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
              </div>

              <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]/70 px-3 py-2">
                <p className="text-xs text-[color:var(--text-secondary)]">
                  {selectedContractorCount > 0
                    ? `${selectedContractorCount} compan${selectedContractorCount === 1 ? "y" : "ies"} selected.`
                    : "No companies selected yet. You can still continue, and direct contact stays locked until you approve."}
                </p>
              </div>

              <DirectConnectGiveawayDisclosure />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedContractorIds([])}
                  className="text-xs text-[color:var(--text-secondary)]"
                >
                  Clear selection
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSkipAndAutoRoute}
                    disabled={createMutation.isPending}
                    className="border-[color:var(--border-subtle)] text-xs"
                  >
                    {createMutation.isPending ? "Sending..." : "Continue without selection"}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSendWithSelection}
                    disabled={createMutation.isPending}
                    className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
                  >
                    {createMutation.isPending ? "Sending..." : "Send with my selection"}
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function DirectConnectGiveawayDisclosure() {
  return (
    <p className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-2 text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
      By submitting this request, you acknowledge and agree to the TradeScout Direct Connect
      Giveaway{" "}
      <Link href="/giveaway-rules" className="text-[color:var(--theme-accent-primary)] underline">
        Official Rules
      </Link>{" "}
      and our{" "}
      <Link href="/privacy" className="text-[color:var(--theme-accent-primary)] underline">
        Privacy Policy
      </Link>
      .
    </p>
  );
}

// Quick action card component
function QuickActionCard({
  section,
  label,
  description,
  icon,
  count,
  isActive,
  onClick,
}: {
  section: Section;
  label: string;
  description: string;
  icon: ReactNode;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative h-full overflow-hidden rounded-xl border p-4 transition-all duration-300",
        "hover:scale-105 hover:shadow-lg",
        isActive
          ? "border-[color:var(--theme-accent-primary)] bg-[color:var(--theme-accent-primary)]/10"
          : "border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] hover:border-[color:var(--theme-accent-primary)]/50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 mb-1">
            <div
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg border",
                isActive
                  ? "border-[color:var(--theme-accent-primary)] bg-[color:var(--theme-accent-primary)]/20"
                  : "border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]"
              )}
            >
              {icon}
            </div>
            <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">{label}</h3>
          </div>
          <p className="text-xs text-[color:var(--text-secondary)] line-clamp-1">{description}</p>
        </div>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {count}
          </Badge>
        )}
        <ChevronRight className="h-4 w-4 text-[color:var(--text-secondary)] group-hover:text-[color:var(--theme-accent-primary)] transition-colors" />
      </div>
    </button>
  );
}

// Navigation grid component
function NavigationGrid({
  activeSection,
  onSelect,
  counts,
}: {
  activeSection: Section;
  onSelect: (section: Section) => void;
  counts?: Partial<Record<Section, number>>;
}) {
  return (
    <div className="space-y-4">
      {SECTION_GROUPS.map((group) => (
        <div key={group.title} className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            {group.icon && <div className="text-[color:var(--text-secondary)]">{group.icon}</div>}
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text-secondary)]">
              {group.title}
            </h3>
          </div>
          <div className="grid gap-2">
            {group.sections.map((section) => {
              const count = counts?.[section] ?? 0;
              return (
                <QuickActionCard
                  key={section}
                  section={section}
                  label={SECTION_LABELS[section]}
                  description={SECTION_META[section].description}
                  icon={SECTION_ICONS[section]}
                  count={count}
                  isActive={section === activeSection}
                  onClick={() => onSelect(section)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function DirectConnectInbox() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [whyJobAssignmentId, setWhyJobAssignmentId] = useState<string | null>(null);
  const [declineAssignmentId, setDeclineAssignmentId] = useState<string | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState<string | null>(null);
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);
  const [mobileActionAssignmentId, setMobileActionAssignmentId] = useState<string | null>(null);
  const [archivedAssignmentIds, setArchivedAssignmentIds] = useState<string[]>([]);
  const [availabilityByAssignment, setAvailabilityByAssignment] = useState<Record<string, string>>(
    {}
  );
  const [priceBandByAssignment, setPriceBandByAssignment] = useState<Record<string, string>>({});
  const [scopeNoteByAssignment, setScopeNoteByAssignment] = useState<Record<string, string>>({});
  const [structuredReplyOpenId, setStructuredReplyOpenId] = useState<string | null>(null);
  const firstQualifiedReplyTrackedRef = useRef(false);
  const [inboxFilter, setInboxFilter] = useState<"all" | "suggested" | "accepted" | "declined">(
    "all"
  );

  const { data, isLoading } = useQuery<DirectConnectInboxItem[]>({
    queryKey: ["/api/direct-connect/inbox"],
    queryFn: async () => {
      const res = await fetch("/api/direct-connect/inbox");
      if (!res.ok) {
        trackDirectConnectApiFailure({
          source: "/api/direct-connect/inbox",
          section: "inbox",
          status: res.status,
          blocked: true,
        });
        throw new Error("Failed to load replies");
      }
      return res.json();
    },
    enabled: isAuthenticated,
  });
  const items = useMemo(() => data || [], [data]);
  const normalizeInboxStatus = (status: string | null | undefined) => {
    const value = String(status || "suggested").toLowerCase();
    return value === "invited" ? "suggested" : value;
  };
  const filteredItems = items.filter((i) =>
    inboxFilter === "all" ? true : normalizeInboxStatus(i.assignment.status) === inboxFilter
  );
  const visibleItems = filteredItems.filter(
    (item) => !archivedAssignmentIds.includes(String(item.assignment.id || ""))
  );

  useEffect(() => {
    if (isAuthenticated && user) return;
    trackOncePerSession(
      "direct-connect-inbox-auth-blocked",
      "direct_connect_permission_or_role_blocked",
      {
        source: "/direct-connect/inbox",
        section: "inbox",
        reason: "auth_required",
        blocked: true,
      }
    );
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || isLoading || items.length > 0) return;
    trackOncePerSession("direct-connect-empty-inbox", "direct_connect_empty_state_seen", {
      source: "/direct-connect/inbox",
      section: "inbox",
      reason: "no_replies",
      blocked: false,
    });
  }, [isAuthenticated, isLoading, items.length]);

  const respondMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      decision: "accept" | "decline";
      reason?: string;
      availabilityWindow?: string;
      priceBand?: "budget" | "standard" | "premium" | "custom_quote";
      scopeNote?: string;
    }) => {
      return apiRequest("POST", `/api/direct-connect/assignments/${payload.id}/respond`, {
        decision: payload.decision,
        reason: payload.reason,
        availabilityWindow: payload.availabilityWindow,
        priceBand: payload.priceBand,
        scopeNote: payload.scopeNote,
      });
    },
    onSuccess: (data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      // After accepting, navigate to the conversation thread so both parties can communicate
      if (variables?.decision === "accept" && data?.conversationId) {
        window.location.href = `/messages?thread=${encodeURIComponent(String(data.conversationId))}`;
      }
    },
    onError: (error: any, variables: any) => {
      trackDirectConnectApiFailure({
        source: "/api/direct-connect/assignments/:id/respond",
        section: "contractor_action",
        status: Number(error?.status),
        error,
        requestId: variables?.id ? String(variables.id) : undefined,
        blocked: true,
      });
    },
  });
  const handleRespond = async (
    assignmentId: string,
    decision: "accept" | "decline",
    reason?: string
  ) => {
    await respondMutation.mutateAsync({ id: assignmentId, decision, reason });
  };

  useEffect(() => {
    if (firstQualifiedReplyTrackedRef.current) return;
    const firstQualified = (items || []).find((item) => {
      const status = normalizeInboxStatus(item.assignment.status);
      const id = String(item.assignment.id || "");
      return status === "suggested" && !id.startsWith("request-");
    });
    if (!firstQualified) return;
    trackShellEvent({
      type: "scout_query",
      payload: {
        event: "direct_connect_first_qualified_reply",
        assignmentId: String(firstQualified.assignment.id || ""),
        requestId: String(firstQualified.assignment.workRequestId || ""),
      },
    });
    firstQualifiedReplyTrackedRef.current = true;
  }, [items]);

  if (!isAuthenticated || !user) {
    return (
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="p-6 md:p-8 text-center text-sm text-[color:var(--text-secondary)]">
          Sign in to view your inbox.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="space-y-3 p-4 md:p-6">
          <div className="h-4 w-52 rounded bg-[color:var(--surface-intermediate)]" />
          <div className="h-24 rounded bg-[color:var(--surface-intermediate)]" />
          <div className="h-24 rounded bg-[color:var(--surface-intermediate)]" />
        </CardContent>
      </Card>
    );
  }

  if (!items.length) {
    return (
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="p-6 md:p-8 text-center text-sm text-[color:var(--text-secondary)]">
          No inbox items yet.
        </CardContent>
      </Card>
    );
  }

  const currentWhyJobSnapshot = items.find((i) => i.assignment.id === whyJobAssignmentId)
    ?.assignment.scoreSnapshot;
  const currentAcceptedForInvoice = items.find((i) => i.assignment.id === creatingInvoice);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {(["all", "suggested", "accepted", "declined"] as const).map((f) => {
          const count =
            f === "all"
              ? items.length
              : items.filter((i) => normalizeInboxStatus(i.assignment.status) === f).length;
          const active = inboxFilter === f;
          const filterLabel = f === "all" ? "All" : getDirectConnectInboxStatusLabel(f);
          return (
            <button
              key={f}
              type="button"
              onClick={() => setInboxFilter(f)}
              className="shrink-0 rounded-xl border px-3.5 text-[13px] font-medium transition-all h-10"
              style={{
                borderColor: active ? "var(--theme-accent-primary)" : "var(--border-subtle)",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                backgroundColor: active
                  ? "color-mix(in oklab, var(--theme-accent-primary) 10%, transparent)"
                  : "var(--surface-intermediate)",
              }}
            >
              {filterLabel} ({count})
            </button>
          );
        })}
      </div>
      <Card className="overflow-hidden border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        {visibleItems.map((item) => {
          const { assignment, request } = item;
          const assignmentStatusRaw = String(assignment.status || "suggested").toLowerCase();
          const canRespond =
            assignmentStatusRaw === "suggested" || assignmentStatusRaw === "invited";
          const actionableAssignment =
            canRespond && !String(assignment.id || "").startsWith("request-");
          const status = assignmentStatusRaw;
          const snapshot = assignment.scoreSnapshot || undefined;
          const createdAt = assignment.createdAt || request?.createdAt;
          const isExpanded = expandedAssignmentId === assignment.id;
          const isMobileActionOpen = mobileActionAssignmentId === assignment.id;
          const isStructuredReplyOpen = structuredReplyOpenId === assignment.id;
          const availabilityWindow = availabilityByAssignment[assignment.id] || "";
          const priceBand = priceBandByAssignment[assignment.id] || "";
          const scopeNote = scopeNoteByAssignment[assignment.id] || "";
          const canSubmitStructuredAccept =
            availabilityWindow.trim().length >= 3 &&
            scopeNote.trim().length >= 10 &&
            ["budget", "standard", "premium", "custom_quote"].includes(priceBand);
          const inboxNextStepCopy = getDirectConnectInboxNextStepCopy({
            assignmentStatus: status,
            requestStatus: request?.status ?? null,
            conversationThreadId: item.conversationThreadId ?? null,
            actionableAssignment,
            isStructuredReplyOpen,
          });
          const inboxDisplay = buildDirectConnectInboxDisplay({
            status,
            timestamp: createdAt,
            scoreSnapshot: snapshot,
          });

          return (
            <div
              key={assignment.id}
              className="border-b border-[color:var(--border-subtle)]/60 last:border-b-0 hover:bg-[color:var(--surface-intermediate)]/40 transition-colors"
            >
              <div className="space-y-3 p-3 md:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                      {inboxNextStepCopy.label}
                    </p>
                    <h3 className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                      {request?.title || "New opportunity"}
                    </h3>
                    <p className="line-clamp-1 text-xs text-[color:var(--text-secondary)] md:line-clamp-2">
                      {request?.description || "Request details."}
                    </p>
                    <p className="text-[11px] text-[color:var(--text-secondary)]/90">
                      {inboxNextStepCopy.summary}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge
                      variant="outline"
                      className={cn("uppercase text-[10px]", statusTone(status))}
                    >
                      {inboxDisplay.statusLabel}
                    </Badge>
                    {(() => {
                      const a = assignment as any;
                      if (a.workerId)
                        return (
                          <Badge variant="secondary" className="text-[9px] uppercase tracking-wide">
                            Worker
                          </Badge>
                        );
                      if (a.responderUserId && !a.contractorId)
                        return (
                          <Badge variant="secondary" className="text-[9px] uppercase tracking-wide">
                            Business
                          </Badge>
                        );
                      if (a.contractorId)
                        return (
                          <Badge variant="secondary" className="text-[9px] uppercase tracking-wide">
                            Provider
                          </Badge>
                        );
                      return null;
                    })()}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] text-[color:var(--text-secondary)]">
                  <span className="min-w-0 truncate">
                    {[
                      request?.status
                        ? `Request ${String(request.status).replace("_", " ")}`
                        : null,
                      request?.tradeId ? `Trade ${request.tradeId}` : null,
                      request?.countyFips
                        ? formatCountyLabel(request.countyFips, request?.stateCode)
                        : null,
                      inboxDisplay.timeLabel,
                    ]
                      .filter(Boolean)
                      .join(" • ") || "Local match"}
                  </span>
                  {inboxDisplay.detailRows.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 px-2 text-[11px]"
                      onClick={() =>
                        setExpandedAssignmentId((current) =>
                          current === assignment.id ? null : assignment.id
                        )
                      }
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? "Hide details" : inboxDisplay.detailsLabel}
                    </Button>
                  )}
                </div>

                {isExpanded && inboxDisplay.detailRows.length > 0 && (
                  <div className="space-y-1 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]/55 p-3 text-[11px] text-[color:var(--text-secondary)]">
                    <p className="font-medium uppercase tracking-[0.16em] text-[color:var(--text-primary)]">
                      {inboxDisplay.detailsHeading}
                    </p>
                    {inboxDisplay.detailRows.map((detail) => (
                      <div key={`${assignment.id}-${detail}`}>{detail}</div>
                    ))}
                  </div>
                )}

                {request?.id && request.attachmentCount ? (
                  <RequestAttachmentStrip
                    requestId={request.id}
                    attachmentCount={request.attachmentCount}
                  />
                ) : null}

                {actionableAssignment && isStructuredReplyOpen && (
                  <div className="space-y-2 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]/55 p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-secondary)]">
                      Structured reply
                    </p>
                    <Input
                      value={availabilityWindow}
                      onChange={(event) =>
                        setAvailabilityByAssignment((current) => ({
                          ...current,
                          [assignment.id]: event.target.value,
                        }))
                      }
                      placeholder="Availability window (e.g., this week, weekdays after 3pm)"
                      className="bg-[color:var(--surface-card)]"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "budget", label: "Budget" },
                        { value: "standard", label: "Standard" },
                        { value: "premium", label: "Premium" },
                        { value: "custom_quote", label: "Custom quote" },
                      ].map((option) => {
                        const active = priceBand === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              setPriceBandByAssignment((current) => ({
                                ...current,
                                [assignment.id]: option.value,
                              }))
                            }
                            className={cn(
                              "rounded-md border px-2 py-1.5 text-xs text-left transition-colors",
                              active
                                ? "border-ts-orange bg-ts-orange/20 text-white"
                                : "border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] text-[color:var(--text-secondary)]"
                            )}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    <Textarea
                      value={scopeNote}
                      onChange={(event) =>
                        setScopeNoteByAssignment((current) => ({
                          ...current,
                          [assignment.id]: event.target.value,
                        }))
                      }
                      rows={2}
                      placeholder="Scope note (what you can handle and next recommended step)"
                      className="bg-[color:var(--surface-card)]"
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {actionableAssignment && (
                    <Button
                      size="sm"
                      className="h-8 px-2 text-xs bg-ts-orange text-text-black hover:bg-ts-orange/90"
                      disabled={
                        respondMutation.isPending ||
                        (isStructuredReplyOpen && !canSubmitStructuredAccept)
                      }
                      onClick={async () => {
                        if (!isStructuredReplyOpen) {
                          setStructuredReplyOpenId(assignment.id);
                          return;
                        }
                        const result = await respondMutation.mutateAsync({
                          id: assignment.id,
                          decision: "accept",
                          availabilityWindow,
                          priceBand: priceBand as
                            | "budget"
                            | "standard"
                            | "premium"
                            | "custom_quote",
                          scopeNote,
                        });
                        trackShellEvent({
                          type: "scout_query",
                          payload: {
                            event: "direct_connect_reply_accepted",
                            assignmentId: assignment.id,
                            requestId: assignment.workRequestId,
                          },
                        });
                        if (result?.conversationId) {
                          trackShellEvent({
                            type: "scout_query",
                            payload: {
                              event: "direct_connect_moved_to_conversation",
                              assignmentId: assignment.id,
                              requestId: assignment.workRequestId,
                              conversationId: String(result.conversationId),
                            },
                          });
                        }
                        setStructuredReplyOpenId(null);
                      }}
                    >
                      {inboxNextStepCopy.actionHint}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      const threadId = item.conversationThreadId;
                      if (threadId) {
                        window.location.href = `/messages?thread=${encodeURIComponent(String(threadId))}`;
                        return;
                      }
                      window.location.href = request?.id
                        ? `/messages?tab=requests&requestId=${encodeURIComponent(String(request.id))}`
                        : "/messages?tab=requests";
                    }}
                  >
                    {inboxNextStepCopy.contactUnlocked ? "Open conversation" : "Ask follow-up"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs border-rose-500/60 text-rose-200 hover:bg-rose-500/10"
                    disabled={respondMutation.isPending}
                    onClick={async () => {
                      if (actionableAssignment) {
                        await respondMutation.mutateAsync({
                          id: assignment.id,
                          decision: "decline",
                          reason: "Archived from inbox",
                        });
                      }
                      setArchivedAssignmentIds((current) => [...current, assignment.id]);
                    }}
                  >
                    Archive
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function MyDirectConnectRequests() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [mobileActionRequestId, setMobileActionRequestId] = useState<string | null>(null);
  const [requestFilter, setRequestFilter] = useState<RequestFilter>("all");
  const [showRouteSheet, setShowRouteSheet] = useState(false);
  const [routeDispatchMode, setRouteDispatchMode] = useState<DispatchMode>("top_count");
  const [routeDispatchCount, setRouteDispatchCount] = useState<1 | 2 | 3>(3);
  const [routeDirectorySearch, setRouteDirectorySearch] = useState("");
  const [selectedRouteRequestId, setSelectedRouteRequestId] = useState<string | null>(null);
  const [selectedRouteContractorIds, setSelectedRouteContractorIds] = useState<string[]>([]);
  const { toast } = useToast();
  const { data: requestsData, isLoading } = useQuery<DirectConnectRequest[]>({
    queryKey: ["/api/direct-connect/requests"],
    queryFn: async () => {
      const res = await fetch("/api/direct-connect/requests?scope=all");
      if (!res.ok) {
        trackDirectConnectApiFailure({
          source: "/api/direct-connect/requests?scope=all",
          section: "engagements",
          status: res.status,
          blocked: true,
        });
        return [];
      }
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const filteredRequests = useMemo(() => {
    if (!requestsData) return [];
    return requestsData
      .filter((request) => !looksLikeHiddenOrTestRequest(request))
      .filter((request) => isCurrentRequest(request))
      .filter((request) => matchesRequestFilter(request, requestFilter))
      .sort((a, b) => {
        const aTs = new Date(a.dcLastEventAt || a.updatedAt || a.createdAt || 0).getTime();
        const bTs = new Date(b.dcLastEventAt || b.updatedAt || b.createdAt || 0).getTime();
        return bTs - aTs;
      });
  }, [requestsData, requestFilter]);

  const activeRouteRequest = useMemo(
    () => filteredRequests.find((request) => request.id === selectedRouteRequestId) || null,
    [filteredRequests, selectedRouteRequestId]
  );

  useEffect(() => {
    if (isAuthenticated && user) return;
    trackOncePerSession(
      "direct-connect-engagements-auth-blocked",
      "direct_connect_permission_or_role_blocked",
      {
        source: "/direct-connect/engagements",
        section: "engagements",
        reason: "auth_required",
        blocked: true,
      }
    );
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || isLoading || filteredRequests.length > 0) return;
    trackOncePerSession("direct-connect-empty-engagements", "direct_connect_empty_state_seen", {
      source: "/direct-connect/engagements",
      section: "engagements",
      reason: "no_requests",
      blocked: false,
    });
  }, [filteredRequests.length, isAuthenticated, isLoading]);

  const { data: routeCandidates = [], isLoading: routeCandidatesLoading } = useQuery<
    DirectoryCandidate[]
  >({
    queryKey: [
      "/api/business-providers/search",
      "direct-connect-reroute-selector",
      activeRouteRequest?.id || null,
      activeRouteRequest?.countyFips || null,
      activeRouteRequest?.tradeId || null,
      routeDirectorySearch,
      showRouteSheet,
      (user as any)?.latitude,
      (user as any)?.longitude,
      (user as any)?.preferences?.geo?.homeLocation?.lat,
      (user as any)?.preferences?.geo?.homeLocation?.lng,
    ],
    enabled: showRouteSheet && Boolean(activeRouteRequest?.id),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "24");
      if (activeRouteRequest?.countyFips)
        params.set("county", String(activeRouteRequest.countyFips));
      if (activeRouteRequest?.tradeId) params.set("trade", String(activeRouteRequest.tradeId));
      const query = routeDirectorySearch.trim();
      if (query) params.set("query", query);
      params.set("sort", "distance");

      const profileLat = Number((user as any)?.latitude);
      const profileLng = Number((user as any)?.longitude);
      const homeLat = Number((user as any)?.preferences?.geo?.homeLocation?.lat);
      const homeLng = Number((user as any)?.preferences?.geo?.homeLocation?.lng);
      const viewerLat = Number.isFinite(profileLat)
        ? profileLat
        : Number.isFinite(homeLat)
          ? homeLat
          : undefined;
      const viewerLng = Number.isFinite(profileLng)
        ? profileLng
        : Number.isFinite(homeLng)
          ? homeLng
          : undefined;

      if (viewerLat != null && viewerLng != null) {
        params.set("lat", String(viewerLat));
        params.set("lng", String(viewerLng));
      }

      try {
        const payload = await apiRequest(
          "GET",
          `/api/business-providers/search?${params.toString()}`
        );
        return Array.isArray(payload) ? (payload as DirectoryCandidate[]) : [];
      } catch (error) {
        trackDirectConnectApiFailure({
          source: "/api/business-providers/search",
          section: "engagements_route_selection",
          status: Number((error as any)?.status),
          error,
          requestId: activeRouteRequest?.id,
          blocked: false,
        });
        return [];
      }
    },
  });

  const rankedRouteCandidates = useMemo(() => {
    return [...routeCandidates].sort((a, b) => {
      // Recommendation-first (CVS composite), location as tiebreak. Mirrors the
      // primary composer ranking so both entry points order providers the same way.
      const cvsDiff = getCandidateCvsScore(b) - getCandidateCvsScore(a);
      if (cvsDiff !== 0) return cvsDiff;
      return (
        getCandidateLocationScore(b, activeRouteRequest?.countyFips || undefined) -
        getCandidateLocationScore(a, activeRouteRequest?.countyFips || undefined)
      );
    });
  }, [activeRouteRequest?.countyFips, routeCandidates]);

  const topRouteIds = useMemo(
    () => rankedRouteCandidates.slice(0, routeDispatchCount).map((candidate) => candidate.id),
    [rankedRouteCandidates, routeDispatchCount]
  );
  const topRouteKey = topRouteIds.join("|");

  useEffect(() => {
    if (!showRouteSheet) return;
    if (routeDispatchMode === "top_count") {
      setSelectedRouteContractorIds(topRouteIds);
      return;
    }
    setSelectedRouteContractorIds([]);
  }, [showRouteSheet, routeDispatchMode, topRouteKey]);

  const routeMutation = useMutation({
    mutationFn: async (payload: {
      requestId: string;
      targetProviderIds?: string[];
      autoRoute?: boolean;
    }) => {
      return apiRequest("POST", `/api/direct-connect/requests/${payload.requestId}/route`, {
        targetProviderIds: payload.targetProviderIds,
        autoRoute: payload.autoRoute,
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      const excludedCount = Array.isArray(result?.excludedTargets)
        ? result.excludedTargets.length
        : 0;
      toast({
        title: "Routing updated",
        description:
          excludedCount > 0
            ? `${excludedCount} business${excludedCount === 1 ? "" : "es"} were excluded for verification requirements.`
            : "Request sharing saved.",
      });
      setShowRouteSheet(false);
      setSelectedRouteRequestId(null);
      setRouteDirectorySearch("");
      setSelectedRouteContractorIds([]);
    },
  });

  const expandMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/route?expand=true`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      toast({ title: "Request shared with more pros" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      toast({ title: "Request paused" });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/reopen`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      toast({ title: "Request ready for replies" });
    },
  });

  const markPendingOutcomeMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/mark-pending-outcome`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      toast({
        title: "Marked as pending outcome",
        description: "Confirm with your provider to close this request.",
      });
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      toast({ title: "Request closed", description: "Great work. This request is now closed." });
    },
  });

  const shareLandingMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/direct-connect/requests/${requestId}/share`);
    },
  });

  const contactGateMutation = useMutation({
    mutationFn: async (payload: { requestId: string; nextState: string }) =>
      apiRequest("POST", `/api/direct-connect/requests/${payload.requestId}/contact-gate`, {
        nextState: payload.nextState,
      }),
    onSuccess: (_result: any, payload) => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] });
      const title =
        payload.nextState === "released"
          ? "Contact released"
          : payload.nextState === "user_approved"
            ? "Contact approved"
            : payload.nextState === "denied"
              ? "Contact denied"
              : "Contact updated";
      toast({ title });
    },
  });

  const openRouteSheetForRequest = (requestId: string) => {
    setSelectedRouteRequestId(requestId);
    setRouteDispatchMode("top_count");
    setRouteDispatchCount(3);
    setRouteDirectorySearch("");
    setSelectedRouteContractorIds([]);
    setShowRouteSheet(true);
  };

  const toggleRouteCandidate = (candidateId: string) => {
    setSelectedRouteContractorIds((current) => {
      if (current.includes(candidateId)) {
        return current.filter((id) => id !== candidateId);
      }
      const max = routeDispatchMode === "top_count" ? routeDispatchCount : 3;
      if (current.length >= max) {
        return [...current.slice(1), candidateId];
      }
      return [...current, candidateId];
    });
  };

  const handleSendRouteSelection = () => {
    if (!activeRouteRequest?.id) return;
    routeMutation.mutate({
      requestId: activeRouteRequest.id,
      targetProviderIds: Array.from(new Set(selectedRouteContractorIds)),
      autoRoute: false,
    });
  };

  const handleSkipAndAutoRoute = () => {
    if (!activeRouteRequest?.id) return;
    routeMutation.mutate({
      requestId: activeRouteRequest.id,
      targetProviderIds: [],
      autoRoute: true,
    });
  };

  if (isLoading) {
    return (
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="space-y-3 p-4 md:p-6">
          <div className="h-4 w-52 rounded bg-[color:var(--surface-intermediate)]" />
          <div className="h-24 rounded bg-[color:var(--surface-intermediate)]" />
        </CardContent>
      </Card>
    );
  }

  if (!filteredRequests.length) {
    return (
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardContent className="space-y-4 p-6 text-center md:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--theme-accent-primary)]/25 bg-[color:var(--theme-accent-primary)]/10 text-[color:var(--theme-accent-primary)]">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-[color:var(--text-primary)]">
              No requests in this view
            </p>
            <p className="text-sm text-[color:var(--text-secondary)]">
              Start a request and it will show up here with updates, photos, and next steps.
            </p>
          </div>
          <div className="flex justify-center">
            <Button
              className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
              onClick={() => navigate("/direct-connect")}
            >
              Start request
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {!isAuthenticated && (
        <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardContent className="space-y-2 p-4 text-center text-sm text-[color:var(--text-secondary)]">
            <p>You're viewing requests from this device session.</p>
            <p>Sign in anytime to save and sync your requests.</p>
          </CardContent>
        </Card>
      )}
      <div className="space-y-2 px-1">
        <p className="text-sm text-[color:var(--text-secondary)]">
          Each request moves through one clear stage at a time: ready to send, waiting on pros, or
          in conversation.
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {REQUEST_FILTERS.map((f) => {
            const count =
              requestsData?.filter((request) => matchesRequestFilter(request, f)).length || 0;
            const active = requestFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setRequestFilter(f)}
                className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  borderColor: active ? "var(--theme-accent-primary)" : "var(--border-subtle)",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  backgroundColor: active
                    ? "color-mix(in oklab, var(--theme-accent-primary) 10%, transparent)"
                    : "var(--surface-intermediate)",
                }}
              >
                {getRequestFilterLabel(f)} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <Card className="overflow-hidden border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        {filteredRequests.map((r) => {
          const status = String(r.status || "open").toLowerCase();
          const interpreted = interpretWorkRequestStateForScout(r as unknown as WorkRequest);
          const stage = getRequestWorkflowStage(r);
          const hasAccepted = stage === "active_conversation" || stage === "completed";
          const canSend = stage === "ready_to_send";
          const canExpand = stage === "waiting_on_pros";
          const canMessage = Boolean(r.dcConversationThreadId) || stage === "active_conversation";
          const canCancel =
            stage === "ready_to_send" ||
            stage === "waiting_on_pros" ||
            stage === "active_conversation";
          const canMarkPendingOutcome = stage === "active_conversation";
          const canMarkComplete = stage === "pending_outcome" || stage === "active_conversation";
          const canReopen = stage === "cancelled";
          const canShare = stage !== "cancelled" && stage !== "completed";
          const nextStepCopy = getDirectConnectNextStepCopy(r);
          const isExpanded = expandedRequestId === r.id;
          const isMobileActionOpen = mobileActionRequestId === r.id;
          const timelineStamp = r.dcLastEventAt || r.createdAt;
          const displayTitle = getDisplayRequestTitle(r);
          const displayDescription = getDisplayRequestDescription(r);
          const displayLatestStatus = getDisplayLatestStatus(r);
          const statusFacts = [
            r.tradeId ? `Trade ${r.tradeId}` : null,
            r.countyFips ? formatCountyLabel(r.countyFips, r.stateCode) : null,
            typeof r.dcSuggestedCount === "number" && r.dcSuggestedCount > 0
              ? `${r.dcSuggestedCount} routed`
              : null,
            typeof r.responseCount === "number" && r.responseCount > 0
              ? `${r.responseCount} response${r.responseCount === 1 ? "" : "s"}`
              : null,
            typeof r.contactRequestCount === "number" && r.contactRequestCount > 0
              ? `${r.contactRequestCount} contact request${r.contactRequestCount === 1 ? "" : "s"}`
              : null,
            typeof r.attachmentCount === "number" && r.attachmentCount > 0
              ? `${r.attachmentCount} photos`
              : null,
          ].filter(Boolean);
          const contactGateState = String(r.contactGateState || "locked");
          const canApproveContact = contactGateState === "contractor_requested";
          const canDenyContact = contactGateState === "contractor_requested";
          const canReleaseContact = contactGateState === "user_approved";
          const contactPanelState = normalizeDirectConnectContactState(r.contactGateState);
          const contactPanelActions: DecisionContactGateAction[] = [
            canApproveContact ? { label: "Approve contact" } : null,
            canDenyContact ? { label: "Decline contact" } : null,
            canReleaseContact ? { label: "Release contact" } : null,
          ].filter((action): action is DecisionContactGateAction => Boolean(action));

          const handleOpenRequest = async () => {
            void trackShellEvent({
              type: "scout_query",
              payload: {
                event: "direct_connect_next_step_card_opened",
                requestId: r.id,
                stage,
                label: nextStepCopy.label,
                actionHint: nextStepCopy.actionHint,
                contactUnlocked: nextStepCopy.contactUnlocked,
                ts: new Date().toISOString(),
              },
            });

            if (canShare) {
              try {
                let shareUrl = String(r.dcMiniLandingUrl || "").trim();
                if (!shareUrl) {
                  const payload = await shareLandingMutation.mutateAsync(r.id);
                  shareUrl = String(payload?.shareUrl || "").trim();
                }
                if (shareUrl) {
                  window.location.href = shareUrl;
                  return;
                }
              } catch {
                // fall through to non-share behavior
              }
            }

            if (canMessage) {
              const threadId = r.dcConversationThreadId;
              window.location.href = threadId
                ? `/messages?thread=${encodeURIComponent(String(threadId))}`
                : r.id
                  ? `/messages?tab=requests&requestId=${encodeURIComponent(String(r.id))}`
                  : "/messages?tab=requests";
              return;
            }
            setExpandedRequestId((current) => (current === r.id ? null : r.id));
          };

          return (
            <div
              key={r.id}
              className="border-b border-[color:var(--border-subtle)]/60 last:border-b-0 transition-colors hover:bg-[color:var(--surface-intermediate)]/30"
            >
              <div className="space-y-4 p-4 md:p-5">
                <button
                  type="button"
                  onClick={handleOpenRequest}
                  className="w-full text-left"
                  aria-label={`Open request ${displayTitle}`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                          {nextStepCopy.label}
                        </p>
                        {timelineStamp && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--text-secondary)]">
                            <Clock3 className="h-3 w-3" />
                            {formatDistanceToNow(new Date(timelineStamp), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-semibold text-[color:var(--text-primary)] md:text-lg">
                        {displayTitle}
                      </h3>
                      <p className="text-sm text-[color:var(--text-secondary)]">
                        {interpreted.primaryPhrase}
                      </p>
                      {interpreted.secondaryPhrase && (
                        <p className="text-xs text-[color:var(--text-secondary)]/90">
                          {interpreted.secondaryPhrase}
                        </p>
                      )}
                      {canApproveContact && (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2">
                          <p className="text-xs font-medium text-emerald-100">
                            A local business responded
                          </p>
                          <p className="mt-1 text-[11px] text-emerald-200/90">
                            They are asking to contact you
                          </p>
                        </div>
                      )}
                      {displayLatestStatus && (
                        <div className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-2.5 py-2">
                          <p className="text-xs font-medium text-[color:var(--text-primary)]">
                            {displayLatestStatus}
                          </p>
                          {typeof r.unreadStatusCount === "number" && r.unreadStatusCount > 0 && (
                            <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">
                              {r.unreadStatusCount} new request update
                              {r.unreadStatusCount === 1 ? "" : "s"}
                            </p>
                          )}
                        </div>
                      )}
                      <p className="text-[11px] text-ts-orange/90">{nextStepCopy.actionHint}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("h-fit uppercase text-[10px]", statusTone(status))}
                    >
                      {status.replace("_", " ")}
                    </Badge>
                  </div>
                </button>

                <div className="space-y-2">
                  <p className="text-sm text-[color:var(--text-primary)]">{displayDescription}</p>
                  {statusFacts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--text-secondary)]">
                      {statusFacts.map((fact) => (
                        <span
                          key={fact}
                          className="rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-2.5 py-1"
                        >
                          {fact}
                        </span>
                      ))}
                    </div>
                  )}
                  <RequestLifecycleRail stage={stage} />
                </div>

                <DecisionContactGatePanel
                  contactState={contactPanelState}
                  viewerRole="requester"
                  nextActor={getDirectConnectContactGateNextActor(contactPanelState)}
                  nextRequiredAction={getDirectConnectContactGateNextAction(contactPanelState)}
                  safeSummary={getDirectConnectContactGateSummary(r)}
                  releasedContact={getDirectConnectReleasedContactForPanel(r, contactPanelState)}
                  actions={contactPanelActions}
                  className="shadow-none"
                />

                <RequestAttachmentStrip requestId={r.id} attachmentCount={r.attachmentCount} />

                <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]/65 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                        What happens now
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--text-primary)]">
                        {nextStepCopy.summary}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        setExpandedRequestId((current) => (current === r.id ? null : r.id));
                      }}
                    >
                      {isExpanded ? "Hide details" : "Show details"}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 sm:hidden">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMobileActionRequestId((current) => (current === r.id ? null : r.id));
                    }}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {isExpanded && (
                  <div className="grid gap-2 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]/55 p-3 text-sm text-[color:var(--text-secondary)] md:grid-cols-2">
                    {(stage === "active_conversation" ||
                      stage === "pending_outcome" ||
                      stage === "completed") &&
                      r.dcAcceptedResponseSummary && (
                        <div className="md:col-span-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                            Provider Response
                          </p>
                          {r.dcAcceptedResponseSummary.availabilityWindow && (
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--text-secondary)]">
                                Availability
                              </p>
                              <p className="mt-0.5 text-sm text-[color:var(--text-primary)]">
                                {r.dcAcceptedResponseSummary.availabilityWindow}
                              </p>
                            </div>
                          )}
                          {r.dcAcceptedResponseSummary.priceBand && (
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--text-secondary)]">
                                Price Band
                              </p>
                              <p className="mt-0.5 text-sm text-[color:var(--text-primary)] capitalize">
                                {r.dcAcceptedResponseSummary.priceBand.replace("_", " ")}
                              </p>
                            </div>
                          )}
                          {r.dcAcceptedResponseSummary.scopeNote && (
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--text-secondary)]">
                                Scope Note
                              </p>
                              <p className="mt-0.5 text-sm text-[color:var(--text-primary)]">
                                {r.dcAcceptedResponseSummary.scopeNote}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                        Status
                      </p>
                      <p className="mt-1 text-[color:var(--text-primary)]">
                        {getRequestStageLabel(stage)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                        Conversation
                      </p>
                      <p className="mt-1 text-[color:var(--text-primary)]">
                        {canMessage
                          ? "You can open the thread now."
                          : "Messaging unlocks after a pro engages."}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-secondary)]">
                        Other actions
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {canExpand && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs"
                            disabled={expandMutation.isPending}
                            onClick={() => expandMutation.mutate(r.id)}
                          >
                            Widen search
                          </Button>
                        )}
                        {canSend && (
                          <Button
                            size="sm"
                            className="h-8 px-2 text-xs bg-ts-orange text-text-black hover:bg-ts-orange/90"
                            disabled={routeMutation.isPending}
                            onClick={() => openRouteSheetForRequest(r.id)}
                          >
                            Send to more pros
                          </Button>
                        )}
                        {canMarkPendingOutcome && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs border-amber-500/60 text-amber-200 hover:bg-amber-500/10"
                            data-testid="dc-mark-pending-outcome-btn"
                            disabled={markPendingOutcomeMutation.isPending}
                            onClick={() => markPendingOutcomeMutation.mutate(r.id)}
                          >
                            Mark pending outcome
                          </Button>
                        )}
                        {canMarkComplete && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
                            data-testid="dc-mark-complete-btn"
                            disabled={markCompleteMutation.isPending}
                            onClick={() => markCompleteMutation.mutate(r.id)}
                          >
                            Mark complete
                          </Button>
                        )}
                        {canCancel && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs border-rose-500/60 text-rose-200 hover:bg-rose-500/10"
                            disabled={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate(r.id)}
                          >
                            Cancel request
                          </Button>
                        )}
                        {canReopen && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
                            disabled={reopenMutation.isPending}
                            onClick={() => reopenMutation.mutate(r.id)}
                          >
                            Reopen request
                          </Button>
                        )}
                        {canApproveContact && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
                            disabled={contactGateMutation.isPending}
                            onClick={() =>
                              contactGateMutation.mutate({
                                requestId: String(r.id),
                                nextState: "user_approved",
                              })
                            }
                          >
                            Approve contact
                          </Button>
                        )}
                        {canReleaseContact && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
                            disabled={contactGateMutation.isPending}
                            onClick={() =>
                              contactGateMutation.mutate({
                                requestId: String(r.id),
                                nextState: "released",
                              })
                            }
                          >
                            Release contact
                          </Button>
                        )}
                        {canDenyContact && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs border-rose-500/60 text-rose-200 hover:bg-rose-500/10"
                            disabled={contactGateMutation.isPending}
                            onClick={() =>
                              contactGateMutation.mutate({
                                requestId: String(r.id),
                                nextState: "denied",
                              })
                            }
                          >
                            Decline
                          </Button>
                        )}
                        {!canMessage && <WhyLink to={getHelpLink("messaging")} />}
                      </div>
                    </div>
                  </div>
                )}

                <div className="hidden flex-wrap items-center justify-end gap-1.5 sm:flex">
                  {canSend && (
                    <Button
                      size="sm"
                      className="h-8 px-2 text-xs bg-ts-orange text-text-black hover:bg-ts-orange/90"
                      disabled={routeMutation.isPending}
                      onClick={() => openRouteSheetForRequest(r.id)}
                    >
                      Send to more pros
                    </Button>
                  )}
                  {stage === "waiting_on_pros" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs"
                      onClick={() => navigate("/direct-connect/inbox")}
                    >
                      Review replies
                    </Button>
                  )}
                  {canMessage && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        const threadId = r.dcConversationThreadId;
                        window.location.href = threadId
                          ? `/messages?thread=${encodeURIComponent(String(threadId))}`
                          : r.id
                            ? `/messages?tab=requests&requestId=${encodeURIComponent(String(r.id))}`
                            : "/messages?tab=requests";
                      }}
                    >
                      Open inbox
                    </Button>
                  )}
                  {canMarkPendingOutcome && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs border-amber-500/60 text-amber-200 hover:bg-amber-500/10"
                      data-testid="dc-mark-pending-outcome-btn"
                      disabled={markPendingOutcomeMutation.isPending}
                      onClick={() => markPendingOutcomeMutation.mutate(r.id)}
                    >
                      Mark pending outcome
                    </Button>
                  )}
                  {canMarkComplete && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
                      data-testid="dc-mark-complete-btn"
                      disabled={markCompleteMutation.isPending}
                      onClick={() => markCompleteMutation.mutate(r.id)}
                    >
                      Mark complete
                    </Button>
                  )}
                  {canReopen && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
                      disabled={reopenMutation.isPending}
                      onClick={() => reopenMutation.mutate(r.id)}
                    >
                      Reopen request
                    </Button>
                  )}
                  {canApproveContact && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
                      disabled={contactGateMutation.isPending}
                      onClick={() =>
                        contactGateMutation.mutate({
                          requestId: String(r.id),
                          nextState: "user_approved",
                        })
                      }
                    >
                      Approve contact
                    </Button>
                  )}
                  {canReleaseContact && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
                      disabled={contactGateMutation.isPending}
                      onClick={() =>
                        contactGateMutation.mutate({
                          requestId: String(r.id),
                          nextState: "released",
                        })
                      }
                    >
                      Release contact
                    </Button>
                  )}
                  {canDenyContact && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-xs border-rose-500/60 text-rose-200 hover:bg-rose-500/10"
                      disabled={contactGateMutation.isPending}
                      onClick={() =>
                        contactGateMutation.mutate({
                          requestId: String(r.id),
                          nextState: "denied",
                        })
                      }
                    >
                      Decline
                    </Button>
                  )}
                </div>

                {isMobileActionOpen && (
                  <div className="flex flex-wrap items-center justify-end gap-1.5 sm:hidden">
                    {canSend && (
                      <Button
                        size="sm"
                        className="h-8 px-2 text-xs bg-ts-orange text-text-black hover:bg-ts-orange/90"
                        disabled={routeMutation.isPending}
                        onClick={() => openRouteSheetForRequest(r.id)}
                      >
                        Send to more pros
                      </Button>
                    )}
                    {stage === "waiting_on_pros" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs"
                        onClick={() => navigate("/direct-connect/inbox")}
                      >
                        Review replies
                      </Button>
                    )}
                    {canMessage && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs"
                        onClick={() => {
                          const threadId = r.dcConversationThreadId;
                          window.location.href = threadId
                            ? `/messages?thread=${encodeURIComponent(String(threadId))}`
                            : r.id
                              ? `/messages?tab=requests&requestId=${encodeURIComponent(String(r.id))}`
                              : "/messages?tab=requests";
                        }}
                      >
                        <MessageCircle className="mr-1 h-3.5 w-3.5" />
                        Open inbox
                      </Button>
                    )}
                    {canMarkPendingOutcome && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs border-amber-500/60 text-amber-200 hover:bg-amber-500/10"
                        data-testid="dc-mark-pending-outcome-btn"
                        disabled={markPendingOutcomeMutation.isPending}
                        onClick={() => markPendingOutcomeMutation.mutate(r.id)}
                      >
                        Mark pending outcome
                      </Button>
                    )}
                    {canMarkComplete && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
                        data-testid="dc-mark-complete-btn"
                        disabled={markCompleteMutation.isPending}
                        onClick={() => markCompleteMutation.mutate(r.id)}
                      >
                        Mark complete
                      </Button>
                    )}
                    {canReopen && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/10"
                        disabled={reopenMutation.isPending}
                        onClick={() => reopenMutation.mutate(r.id)}
                      >
                        Reopen request
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      <Sheet
        open={showRouteSheet}
        onOpenChange={(open) => {
          setShowRouteSheet(open);
          if (!open) {
            setSelectedRouteRequestId(null);
            setRouteDirectorySearch("");
            setSelectedRouteContractorIds([]);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-l-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-4 sm:max-w-xl"
        >
          <SheetHeader>
            <SheetTitle>Route this request</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]/70 p-3">
              <p className="text-xs font-medium text-[color:var(--text-primary)]">Routing mode</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRouteDispatchMode("top_count")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                    routeDispatchMode === "top_count"
                      ? "border-ts-orange bg-ts-orange/20 text-[color:var(--text-primary)]"
                      : "border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] text-[color:var(--text-secondary)]"
                  )}
                >
                  <p className="font-medium">Top local businesses</p>
                  <p className="mt-1 text-[11px]">Preselect top matches by location + CVS.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setRouteDispatchMode("direct_pick")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                    routeDispatchMode === "direct_pick"
                      ? "border-ts-orange bg-ts-orange/20 text-[color:var(--text-primary)]"
                      : "border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] text-[color:var(--text-secondary)]"
                  )}
                >
                  <p className="font-medium">Direct pick</p>
                  <p className="mt-1 text-[11px]">Choose exactly who should get this request.</p>
                </button>
              </div>
            </div>

            {routeDispatchMode === "top_count" && (
              <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]/70 p-3">
                <p className="text-xs font-medium text-[color:var(--text-primary)]">
                  How many businesses should this route to?
                </p>
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3].map((count) => (
                    <Button
                      key={count}
                      type="button"
                      size="sm"
                      variant={routeDispatchCount === count ? "default" : "outline"}
                      onClick={() => setRouteDispatchCount(count as 1 | 2 | 3)}
                      className={cn(
                        routeDispatchCount === count
                          ? "bg-ts-orange text-text-black hover:bg-ts-orange/90"
                          : "border-[color:var(--border-subtle)]"
                      )}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-[color:var(--text-primary)]">
                Local Directory shortlist
              </p>
              <Input
                value={routeDirectorySearch}
                onChange={(event) => setRouteDirectorySearch(event.target.value)}
                placeholder="Search local businesses"
                className="bg-[color:var(--surface-intermediate)] border-[color:var(--border-subtle)]"
              />
              <p className="text-[11px] text-[color:var(--text-secondary)]">
                Ordered by location fit first, then CVS score.
              </p>
            </div>

            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {routeCandidatesLoading && (
                <div className="px-1 py-2 text-xs text-[color:var(--text-secondary)]">
                  Finding local businesses...
                </div>
              )}

              {!routeCandidatesLoading && rankedRouteCandidates.length === 0 && (
                <div className="px-1 py-2 text-xs text-[color:var(--text-secondary)]">
                  No businesses found right now. We will manually route this to a reputable local
                  company, and you will still approve before contact is unlocked.
                </div>
              )}

              {!routeCandidatesLoading &&
                rankedRouteCandidates.map((candidate, index) => {
                  const selected = selectedRouteContractorIds.includes(candidate.id);
                  const distance = parseNumberOrNull(candidate.distanceMiles);
                  const cvs = getCandidateCvsScore(candidate);
                  const location = getCandidateLocationScore(
                    candidate,
                    activeRouteRequest?.countyFips || undefined
                  );
                  const candidateLabel =
                    candidate.companyName || candidate.name || "Local business";
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => toggleRouteCandidate(candidate.id)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                        selected
                          ? "border-ts-orange bg-ts-orange/15"
                          : "border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <Avatar className="h-9 w-9 border border-[color:var(--border-subtle)]">
                            <AvatarFallback
                              className={cn(
                                "text-[11px] font-semibold",
                                getProviderAvatarClass(candidateLabel)
                              )}
                            >
                              {getProviderInitials(candidateLabel)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-[color:var(--text-primary)]">
                              {index + 1}. {candidateLabel}
                            </p>
                            <p className="text-[11px] text-[color:var(--text-secondary)]">
                              {distance !== null
                                ? `${distance.toFixed(1)} mi away`
                                : candidate.serviceAreas?.length
                                  ? candidate.serviceAreas.slice(0, 2).join(", ")
                                  : "Local service area"}
                            </p>
                            <p className="text-[11px] text-[color:var(--text-secondary)]">
                              CVS {Math.round(cvs)} • Location score {Math.round(location)}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={selected ? "default" : "outline"}
                          className={cn(
                            "shrink-0 text-[10px]",
                            selected
                              ? "bg-ts-orange text-text-black"
                              : "border-[color:var(--border-subtle)]"
                          )}
                        >
                          {selected ? "Selected" : "Select"}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
            </div>

            <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]/70 px-3 py-2">
              <p className="text-xs text-[color:var(--text-secondary)]">
                {selectedRouteContractorIds.length > 0
                  ? `${selectedRouteContractorIds.length} business${selectedRouteContractorIds.length === 1 ? "" : "es"} selected.`
                  : "No businesses selected yet. We will manually route this to a reputable local company, and you still approve before contact is unlocked."}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-[color:var(--text-secondary)]"
                onClick={() => setSelectedRouteContractorIds([])}
              >
                Clear selection
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-[color:var(--border-subtle)] text-xs"
                  onClick={handleSkipAndAutoRoute}
                  disabled={routeMutation.isPending}
                >
                  {routeMutation.isPending ? "Sending..." : "Continue without selection"}
                </Button>
                <Button
                  type="button"
                  className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
                  onClick={handleSendRouteSelection}
                  disabled={routeMutation.isPending}
                >
                  {routeMutation.isPending ? "Sending..." : "Send with my selection"}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function DirectConnectShell() {
  const [location, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const firstUseUserState = isAuthenticated ? "authenticated" : "anonymous";
  const pathOnly = useMemo(() => getPathOnly(location), [location]);
  const directConnectEntry = useMemo(() => getDirectConnectEntry(location), [location]);
  const activeSection = useMemo<Section>(() => getSectionFromPath(location), [location]);
  const activeFlowMode = useMemo<FlowMode>(() => getFlowMode(activeSection), [activeSection]);

  const requestPrefill = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const countyFips = params.get("county") || undefined;
    const targetUserId = params.get("target") || undefined;
    const targetName = params.get("targetName") || undefined;
    const source = params.get("source") || undefined;
    const title = params.get("title") || undefined;
    const description = params.get("description") || undefined;
    const budgetMin = params.get("budgetMin") || undefined;
    const budgetMax = params.get("budgetMax") || undefined;
    const tradeId = params.get("trade") || params.get("tradeId") || undefined;
    return {
      countyFips,
      targetUserId,
      targetName,
      source,
      title,
      description,
      budgetMin,
      budgetMax,
      tradeId,
    };
  }, [location]);
  const defaultCountyFips = requestPrefill?.countyFips;
  const isPensacolaLaunchPath = defaultCountyFips === PENSACOLA_COUNTY_CODE;
  const createPensacolaAccountHref = useMemo(() => {
    const nextPath = encodeURIComponent(location || "/direct-connect");
    return `/create-account?source=pensacola-direct-connect&county=${PENSACOLA_COUNTY_CODE}&next=${nextPath}`;
  }, [location]);

  useEffect(() => {
    void trackShellEvent({
      type: "direct_connect_landed",
      section: activeSection,
      entry: directConnectEntry,
      deviceType: getDeviceType(),
      isAuthenticated,
      hasCountyFips: Boolean(defaultCountyFips || (user as any)?.countyFips),
      ts: new Date().toISOString(),
    });
  }, [activeSection, defaultCountyFips, directConnectEntry, isAuthenticated, user]);

  const navigateSection = (section: Section) => {
    trackRepeatedFrictionSignal({
      key: `direct-connect-tab:${section}`,
      type: "direct_connect_repeated_cta_click",
      threshold: 3,
      windowMs: DIRECT_CONNECT_REPEATED_CTA_WINDOW_MS,
      payload: {
        source: location || "/direct-connect",
        section,
        reason: "tab_navigation",
        blocked: false,
      },
    });
    void trackShellEvent({
      type: "direct_connect_tab_selected",
      fromSection: activeSection,
      toSection: section,
      entry: directConnectEntry,
      deviceType: getDeviceType(),
      ts: new Date().toISOString(),
    });
    navigate(buildHref(section));
  };

  const { data: inboxData, isLoading: isInboxCountLoading } = useQuery<DirectConnectInboxItem[]>({
    queryKey: ["/api/direct-connect/inbox", "count"],
    queryFn: async () => {
      const res = await fetch("/api/direct-connect/inbox");
      if (!res.ok) {
        trackDirectConnectApiFailure({
          source: "/api/direct-connect/inbox",
          section: "inbox_count",
          status: res.status,
          blocked: false,
        });
        return [];
      }
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: requestsData, isLoading: isRequestCountLoading } = useQuery<DirectConnectRequest[]>(
    {
      queryKey: ["/api/direct-connect/requests", "count"],
      queryFn: async () => {
        const res = await fetch("/api/direct-connect/requests");
        if (!res.ok) {
          trackDirectConnectApiFailure({
            source: "/api/direct-connect/requests",
            section: "request_count",
            status: res.status,
            blocked: false,
          });
          return [];
        }
        return res.json();
      },
      enabled: isAuthenticated,
    }
  );

  const { data: homesData } = useQuery<{ homes?: Array<{ id: string }> }>({
    queryKey: ["/api/homes", "first-use-context"],
    queryFn: async () => {
      const res = await fetch("/api/homes");
      if (!res.ok) {
        trackDirectConnectApiFailure({
          source: "/api/homes",
          section: "home_context",
          status: res.status,
          blocked: false,
        });
        return { homes: [] };
      }
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const hasHomeIdContext = Boolean(Array.isArray(homesData?.homes) && homesData.homes.length > 0);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const replyViewedEventKeyRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const userRole = String((user as any)?.role || "").toLowerCase();
  const notificationRole = ["contractor", "business", "worker", "provider"].includes(userRole)
    ? "business"
    : "requester";

  const notificationsQueryKey = useMemo(
    () => ["/api/direct-connect/notifications", notificationRole] as const,
    [notificationRole]
  );

  const {
    data: notificationsPayload,
    isLoading: notificationsLoading,
    isError: notificationsError,
  } = useQuery<{
    notifications: DirectConnectNotification[];
    unreadDirectConnectNotificationCount: number;
    latestNotification: DirectConnectNotification | null;
    pendingActionKey: string | null;
  }>({
    queryKey: notificationsQueryKey,
    queryFn: async () => {
      const res = await fetch(`/api/direct-connect/notifications?role=${notificationRole}`);
      if (!res.ok) {
        trackDirectConnectApiFailure({
          source: "/api/direct-connect/notifications",
          section: "notifications",
          status: res.status,
          blocked: false,
        });
        throw new Error("Failed to load Direct Connect notifications");
      }
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const notifications = notificationsPayload?.notifications || [];
  const activeNotifications = notifications.filter((n) => n.status !== "archived");
  const unreadDirectConnectNotificationCount = activeNotifications.filter(
    (n) => n.status === "unread"
  ).length;

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(
        `/api/direct-connect/notifications/${encodeURIComponent(notificationId)}/read?role=${notificationRole}`,
        { method: "POST" }
      );
      if (!response.ok) throw new Error("Failed to mark notification as read");
      return response.json();
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notificationsQueryKey });
      const previous = queryClient.getQueryData(notificationsQueryKey);
      queryClient.setQueryData(notificationsQueryKey, (current: any) => {
        if (!current?.notifications) return current;
        return {
          ...current,
          notifications: current.notifications.map((item: DirectConnectNotification) =>
            item.id === notificationId ? { ...item, status: "read" } : item
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notificationsQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/direct-connect/notifications/read-all?role=${notificationRole}`,
        {
          method: "POST",
        }
      );
      if (!response.ok) throw new Error("Failed to mark all notifications as read");
      return response.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationsQueryKey });
      const previous = queryClient.getQueryData(notificationsQueryKey);
      queryClient.setQueryData(notificationsQueryKey, (current: any) => {
        if (!current?.notifications) return current;
        return {
          ...current,
          notifications: current.notifications.map((item: DirectConnectNotification) =>
            item.status === "unread" ? { ...item, status: "read" } : item
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notificationsQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(
        `/api/direct-connect/notifications/${encodeURIComponent(notificationId)}/archive?role=${notificationRole}`,
        { method: "POST" }
      );
      if (!response.ok) throw new Error("Failed to archive notification");
      return response.json();
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notificationsQueryKey });
      const previous = queryClient.getQueryData(notificationsQueryKey);
      queryClient.setQueryData(notificationsQueryKey, (current: any) => {
        if (!current?.notifications) return current;
        return {
          ...current,
          notifications: current.notifications.map((item: DirectConnectNotification) =>
            item.id === notificationId ? { ...item, status: "archived" } : item
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notificationsQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
  });

  const navCounts: Partial<Record<Section, number>> = useMemo(
    () => ({
      inbox: (inboxData || []).filter((i) => i.assignment.status === "suggested").length,
      engagements: (requestsData || []).filter((r) => r.status !== "cancelled").length,
    }),
    [inboxData, requestsData]
  );
  const requestSummary = useMemo(
    () => ({
      readyToSend: countRequestsByStage(requestsData, "ready_to_send"),
      waitingOnPros: countRequestsByStage(requestsData, "waiting_on_pros"),
      inConversation: countRequestsByStage(requestsData, "active_conversation"),
    }),
    [requestsData]
  );

  useEffect(() => {
    if (!isAuthenticated || activeSection !== "inbox" || isInboxCountLoading) return;
    const actionableReplies = (inboxData || []).filter(
      (item) => item.assignment.status === "suggested"
    );
    if (actionableReplies.length === 0) return;

    const firstRequestId =
      actionableReplies[0]?.request?.id || actionableReplies[0]?.assignment.workRequestId;
    const eventKey = `${firstRequestId || "unknown"}:${actionableReplies.length}`;
    if (replyViewedEventKeyRef.current === eventKey) return;
    replyViewedEventKeyRef.current = eventKey;

    void trackShellEvent({
      type: "direct_connect_requester_reply_viewed",
      surface: "direct_connect",
      userState: "authenticated",
      viewport: getDeviceType(),
      source: "direct_connect_inbox",
      requestId: firstRequestId || undefined,
      replyCount: actionableReplies.length,
      ts: new Date().toISOString(),
    });
  }, [activeSection, inboxData, isAuthenticated, isInboxCountLoading]);

  const directConnectFirstTaskPrompt = useMemo(
    () =>
      resolveDirectConnectFirstUseTaskPrompt({
        requestCount: requestsData?.length || 0,
        hasHomeIdContext,
      }),
    [hasHomeIdContext, requestsData]
  );

  useEffect(() => {
    trackFirstUseGuidanceViewed("direct_connect", firstUseUserState);
  }, [firstUseUserState]);

  useEffect(() => {
    trackFirstUseTaskPromptViewed({
      surface: "direct_connect",
      promptMessage: directConnectFirstTaskPrompt.message,
      ctaLabel: directConnectFirstTaskPrompt.ctaLabel,
      userState: firstUseUserState,
    });
  }, [
    directConnectFirstTaskPrompt.ctaLabel,
    directConnectFirstTaskPrompt.message,
    firstUseUserState,
  ]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (pathOnly !== "/direct-connect") return;
    if (!shouldResolveDirectConnectEntry(directConnectEntry)) return;
    if (isInboxCountLoading || isRequestCountLoading) return;

    const replyCount = directConnectEntry === "default" ? 0 : (navCounts.inbox ?? 0);
    const openRequestCount = directConnectEntry === "default" ? 0 : (navCounts.engagements ?? 0);
    const targetSection: Section =
      replyCount > 0 ? "inbox" : openRequestCount > 0 ? "engagements" : "post";
    const reason =
      targetSection === "inbox"
        ? "replies"
        : targetSection === "engagements"
          ? "open_requests"
          : "new_request";

    void trackShellEvent({
      type: "direct_connect_entry_resolved",
      entry: directConnectEntry,
      fromSection: activeSection,
      toSection: targetSection,
      reason,
      deviceType: getDeviceType(),
      replyCount,
      openRequestCount,
      ts: new Date().toISOString(),
    });

    if (targetSection !== activeSection) {
      navigate(buildHref(targetSection));
    }
  }, [
    activeSection,
    directConnectEntry,
    isAuthenticated,
    isInboxCountLoading,
    isRequestCountLoading,
    navCounts.engagements,
    navCounts.inbox,
    navigate,
    pathOnly,
  ]);
  const sectionMeta = SECTION_META[activeSection];
  const mobileTitle = activeSection === "post" ? "Post a request" : sectionMeta.title;

  let centerContent: ReactNode = null;
  switch (activeSection) {
    case "post":
      centerContent = (
        <DirectConnectRequestComposer
          defaultCountyFips={defaultCountyFips}
          prefillTargetUserId={requestPrefill?.targetUserId}
          prefillTargetName={requestPrefill?.targetName}
          prefillSource={requestPrefill?.source}
          prefillTitle={requestPrefill?.title}
          prefillDescription={requestPrefill?.description}
          prefillBudgetMin={requestPrefill?.budgetMin}
          prefillBudgetMax={requestPrefill?.budgetMax}
          prefillTradeId={requestPrefill?.tradeId}
        />
      );
      break;
    case "board":
      centerContent = (
        <TasksHub defaultCountyFips={defaultCountyFips} embedded defaultTab="browse" />
      );
      break;
    case "employment":
      centerContent = <EmploymentBoard defaultCountyFips={defaultCountyFips} />;
      break;
    case "inbox":
      centerContent = <DirectConnectInbox />;
      break;
    case "pros":
      centerContent = <DirectConnectPros />;
      break;
    case "engagements":
      centerContent = <MyDirectConnectRequests />;
      break;
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <SEOHelmet
        title="Direct Connect | Request Local Help and Manage Replies"
        description="Use TradeScout Direct Connect to post local requests, review replies, and choose the next step."
        canonical="https://www.thetradescout.com/direct-connect"
        structuredData={DIRECT_CONNECT_STRUCTURED_DATA}
      />
      <div className="mx-auto w-full max-w-6xl space-y-2.5 px-2.5 py-3 sm:px-3 sm:py-4 md:space-y-3 md:px-6 md:py-6">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-end md:justify-between">
          {activeSection !== "post" && (
            <h1 className="text-2xl font-bold text-[color:var(--text-primary)] md:text-3xl">
              <span className="md:hidden">{mobileTitle}</span>
              <span className="hidden md:inline">Direct Connect</span>
            </h1>
          )}

          <div className="hidden flex-wrap justify-end gap-2 md:flex">
            <button
              type="button"
              onClick={() => setShowNotificationCenter(true)}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-1.5 text-sm"
            >
              <Bell className="h-4 w-4 text-[color:var(--theme-accent-primary)]" />
              <span className="text-[color:var(--text-secondary)]">Notifications</span>
              <span className="font-semibold text-[color:var(--text-primary)]">
                {unreadDirectConnectNotificationCount}
              </span>
            </button>
            {activeFlowMode === "manage" ? (
              <>
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-1.5 text-sm">
                  <Zap className="h-4 w-4 text-[color:var(--theme-accent-primary)]" />
                  <span className="text-[color:var(--text-secondary)]">Open</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">
                    {requestSummary.readyToSend}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-1.5 text-sm">
                  <Inbox className="h-4 w-4 text-[color:var(--theme-accent-primary)]" />
                  <span className="text-[color:var(--text-secondary)]">Waiting</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">
                    {requestSummary.waitingOnPros}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-1.5 text-sm">
                  <MessageCircle className="h-4 w-4 text-[color:var(--theme-accent-primary)]" />
                  <span className="text-[color:var(--text-secondary)]">Conversation</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">
                    {requestSummary.inConversation}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-1.5 text-sm">
                  <Inbox className="h-4 w-4 text-[color:var(--theme-accent-primary)]" />
                  <span className="text-[color:var(--text-secondary)]">Replies</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">
                    {navCounts.inbox || 0}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-1.5 text-sm">
                  <TrendingUp className="h-4 w-4 text-[color:var(--theme-accent-primary)]" />
                  <span className="text-[color:var(--text-secondary)]">Requests</span>
                  <span className="font-semibold text-[color:var(--text-primary)]">
                    {navCounts.engagements || 0}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={cn(activeSection === "post" ? "hidden md:block" : "")}>
          <FirstUseGuidanceCard
            title="Start your request."
            description={DIRECT_CONNECT_GUIDANCE_TEXT}
          />
        </div>
        <Card
          className={cn(
            "border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]",
            activeSection === "post" ? "hidden md:block" : ""
          )}
        >
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <p className="text-sm text-[color:var(--text-primary)]">
              {directConnectFirstTaskPrompt.message}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="border-[color:var(--border-subtle)]"
              onClick={() => {
                let targetRoute = "/direct-connect";
                trackRepeatedFrictionSignal({
                  key: `direct-connect-first-task:${directConnectFirstTaskPrompt.ctaLabel}`,
                  type: "direct_connect_repeated_cta_click",
                  threshold: 3,
                  windowMs: DIRECT_CONNECT_REPEATED_CTA_WINDOW_MS,
                  payload: {
                    source: location || "/direct-connect",
                    section: "first_task_prompt",
                    reason: directConnectFirstTaskPrompt.ctaLabel,
                    blocked: false,
                  },
                });
                if (directConnectFirstTaskPrompt.ctaLabel === "Link HomeID") {
                  targetRoute = "/homes";
                  trackFirstUseTaskPromptClicked({
                    surface: "direct_connect",
                    promptMessage: directConnectFirstTaskPrompt.message,
                    ctaLabel: directConnectFirstTaskPrompt.ctaLabel,
                    targetRoute,
                    userState: firstUseUserState,
                  });
                  navigate("/homes");
                  return;
                }
                if (directConnectFirstTaskPrompt.ctaLabel === "Review requests") {
                  targetRoute = "/direct-connect/engagements";
                  trackFirstUseTaskPromptClicked({
                    surface: "direct_connect",
                    promptMessage: directConnectFirstTaskPrompt.message,
                    ctaLabel: directConnectFirstTaskPrompt.ctaLabel,
                    targetRoute,
                    userState: firstUseUserState,
                  });
                  navigate("/direct-connect/engagements");
                  return;
                }
                trackFirstUseTaskPromptClicked({
                  surface: "direct_connect",
                  promptMessage: directConnectFirstTaskPrompt.message,
                  ctaLabel: directConnectFirstTaskPrompt.ctaLabel,
                  targetRoute,
                  userState: firstUseUserState,
                });
                navigate("/direct-connect");
              }}
            >
              {directConnectFirstTaskPrompt.ctaLabel}
            </Button>
          </CardContent>
        </Card>

        {!isAuthenticated && isPensacolaLaunchPath ? (
          <div className="rounded-lg border border-ts-orange/35 bg-ts-orange/10 px-3 py-2.5 md:px-4 md:py-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-[color:var(--text-primary)] md:text-sm">
                Create your free account to save this request path and keep replies in one place.
              </p>
              <Button
                size="sm"
                aria-label="Pensacola launch flow account setup"
                className="w-fit bg-ts-orange text-text-black hover:bg-ts-orange/90"
                onClick={() => navigate(createPensacolaAccountHref)}
              >
                Create account
              </Button>
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "rounded-lg border border-transparent bg-transparent p-0",
            activeSection === "post" ? "hidden" : ""
          )}
        >
          <div className="grid grid-cols-3 gap-1 md:flex md:items-center md:gap-1.5">
            {DIRECT_CONNECT_TABS.map((section) => {
              const active = section === activeSection;
              const count = navCounts[section] ?? 0;
              return (
                <button
                  key={section}
                  type="button"
                  onClick={() => navigateSection(section)}
                  className={cn(
                    "inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-[13px] font-medium transition-colors md:flex-1 md:gap-2 md:px-3 md:text-sm",
                    active
                      ? "border-[color:var(--theme-accent-primary)] bg-[color:var(--theme-accent-primary)]/12 text-[color:var(--text-primary)]"
                      : "border-[color:var(--border-subtle)]/60 bg-[color:var(--surface-card)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-intermediate)] hover:text-[color:var(--text-primary)]"
                  )}
                >
                  <span className="text-[color:var(--theme-accent-primary)] [&>svg]:h-3.5 [&>svg]:w-3.5 md:[&>svg]:h-4 md:[&>svg]:w-4">
                    {SECTION_ICONS[section]}
                  </span>
                  <span className="truncate md:hidden">{SECTION_SHORT_LABELS[section]}</span>
                  <span className="hidden truncate md:inline">{SECTION_LABELS[section]}</span>
                  {count > 0 && (
                    <Badge variant="secondary" className="hidden text-[10px] md:inline-flex">
                      {count}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 space-y-3">{centerContent}</div>
        <Sheet open={showNotificationCenter} onOpenChange={setShowNotificationCenter}>
          <SheetContent
            side="right"
            className="w-full max-w-md border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] text-[color:var(--text-primary)]"
          >
            <SheetHeader>
              <SheetTitle>Direct Connect notifications</SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-[color:var(--text-secondary)]">
                {unreadDirectConnectNotificationCount} unread
              </p>
              <Button
                size="sm"
                variant="outline"
                className="border-[color:var(--border-subtle)]"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending || unreadDirectConnectNotificationCount < 1}
              >
                Mark reviewed
              </Button>
            </div>
            <div className="mt-3 space-y-2 overflow-y-auto pr-1 max-h-[74vh]">
              {!isAuthenticated ? (
                <div className="px-1 py-2 text-xs text-[color:var(--text-secondary)]">
                  Sign in to view Direct Connect notifications.
                </div>
              ) : notificationsLoading ? (
                <div className="px-1 py-2 text-xs text-[color:var(--text-secondary)]">
                  Loading Direct Connect updates...
                </div>
              ) : notificationsError ? (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-3 text-xs text-rose-200">
                  Could not load notifications right now.
                </div>
              ) : activeNotifications.length < 1 ? (
                <div className="px-1 py-2 text-xs text-[color:var(--text-secondary)]">
                  No Direct Connect updates yet.
                </div>
              ) : (
                activeNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "rounded-xl border px-3 py-3",
                      notification.status === "unread"
                        ? "border-ts-orange/45 bg-ts-orange/10"
                        : "border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{notification.title}</p>
                        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          notification.status === "unread"
                            ? "border-ts-orange/40 text-ts-orange"
                            : "border-[color:var(--border-subtle)] text-[color:var(--text-secondary)]"
                        )}
                      >
                        {notification.status === "unread" ? "Unread" : "Read"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {notification.status === "unread" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 border-[color:var(--border-subtle)] text-[11px]"
                          onClick={() => markReadMutation.mutate(notification.id)}
                          disabled={markReadMutation.isPending}
                        >
                          Mark read
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-[color:var(--border-subtle)] text-[11px]"
                        onClick={() => archiveMutation.mutate(notification.id)}
                        disabled={archiveMutation.isPending}
                      >
                        Hide update
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
