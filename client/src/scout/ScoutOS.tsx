import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
// Note: navigation is handled via AppShell top/bottom nav; ScoutOS focuses on chat.
import { useAuth } from "../hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "../hooks/useIsMobile";
import { useScoutController } from "./useScoutController";
import ScoutThread from "./ScoutThread";
import { ScoutDirectConnectPanel } from "./ScoutDirectConnectPanel";
import { ScoutHasDonePanel } from "./ScoutHasDonePanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ScoutToolsDrawer from "./ScoutToolsDrawer";
import { apiBase, sendToScout, logScoutInsight, type ScoutLocality, type ScoutMode } from "./api";
import { executeScoutActions } from "./ScoutActionRouter";
import { resolveLatestScoutTurnActionTruth, scoutAllowedActionToAction } from "./actionValidation";
import { ROUTES } from "@/lib/routes";
import type { ScoutAction, ScoutMessage } from "./state";
import { useSession } from "../contexts/SessionContext";
import {
  getRecentActivity,
  recordActivity,
  getSeenAdIds,
  hasSeenFirstAnswer,
  markFirstAnswerSeen,
} from "../agent/activity";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  BadgeInfo,
  BarChart3,
  ChevronDown,
  Database,
  Car,
  FolderOpen,
  Home,
  MessageSquareText,
  PackageSearch,
  Route,
  Search,
  Sparkles,
  ClipboardList,
  Users2,
  Wrench,
} from "lucide-react";
import { ScoutInputRow } from "./ScoutInputRow";
import ScoutSearchDock from "./ScoutSearchDock";
import { scoutActionTiles } from "./scoutActionTiles";
import { resolveAllTiles } from "./resolveScoutTiles";
import type { ScoutTileContext } from "./scoutActionTiles";
import { buildScoutContextCards, type ScoutContextCardKind } from "./scoutContextCards";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { formatCityOnly } from "@/utils/locationDisplay";
import { openFloatingNote } from "@/lib/floatingNotes";
import { ScoutWorkAreaSheet } from "./ScoutWorkAreaSheet";
import { canOpenScoutWorkArea } from "./scoutWorkAreas";
import { hasAdminUiAccess } from "@/lib/roleChecks";
import { inferContextRoles } from "./contextRoles";
import { useScoutOnboarding } from "./useScoutOnboarding";
import { ClaimConfirmationCard as ClaimConfirmationCardComponent } from "./ClaimConfirmationCard";
import { buildScoutProvenance } from "./provenance";
import type { ClaimType } from "./claimTypes";
import type { ProfileDraft } from "@/types/profileDraft";
import { useScoutMode } from "./useScoutMode";
import { PostOnboardingActionCard } from "./PostOnboardingActionCard";
import { resolvePostOnboardingActions } from "./resolvePostOnboardingActions";
import { resolveQuickActionIntent } from "./localIntents";
import { persistScoutLearningSignalLocally } from "./scoutLearningOptions";
import { type ScoutSourceSignalSnapshot } from "./scoutExperience";
import ObjectiveChip from "./ObjectiveChip";
import ObjectiveOnboardingFlow from "./ObjectiveOnboardingFlow";
import { ScoutHome } from "./ScoutHome";
import WatchdogInterventionBanner from "./WatchdogInterventionBanner";
import type { Objective } from "@shared/types/objective";
import { trackDemandEvent } from "@/lib/demandEngine";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { trackShellEvent } from "@/lib/analytics";
import {
  trackScoutHomeIdActionCardClicked,
  trackScoutHomeIdContextViewed,
} from "@/lib/coreProductAnalytics";
import {
  LIVE_READINESS_QUICK_START_PROMPT,
  SCOUT_QUICK_START_PROMPTS,
} from "./scoutQuickStartPrompts";
import { ScoutLaunchContextCard } from "./ScoutLaunchContextCard";
import { parseScoutLaunchLocation } from "@shared/scoutLaunchContext";
import {
  clearOnboardingResultPrompt,
  readOnboardingResultPrompt,
} from "@/lib/onboardingResultHandoff";

const COUNTY_EXPLAINED_KEY = "scout:county_explained:v1";
const COUNTY_EXPLAINED_AT_KEY = "scout:county_explained_at";
const COUNTY_EXPLAINED_FOLLOWUP_KEY = "scout:county_explained_followup_recorded";

const AUTO_ROUTE_ENABLED_KEY = "scout:auto_route_enabled:v1";
const SCOUT_VIEW_MODE_KEY = "scout:view_mode:v1";
const SCOUT_SAVED_THREADS_VERSION = 1;
const SCOUT_SAVED_THREADS_LIMIT = 8;
const SCOUT_SAVED_THREAD_MESSAGE_LIMIT = 40;
const SCOUT_SAVED_THREAD_CONTENT_LIMIT = 4000;
const AUTO_ROUTE_DEFAULT_ENABLED = false;
const AUTO_ROUTE_MIN_CONFIDENCE = 0.85;
const AUTO_ROUTE_DELAY_MS = 1600;

export function cancelScheduledScoutAutoRoute(timerRef: { current: number | null }): void {
  if (timerRef.current === null) return;
  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}

const OBJECTIVES_ENABLED = String(import.meta.env.VITE_OBJECTIVES_ENABLED ?? "true") === "true";
const SCOUT_EVOLUTION_SURFACES_ENABLED =
  String(import.meta.env.VITE_SCOUT_EVOLUTION_SURFACES_ENABLED ?? "false") === "true";
// Search saved conversations
// Related to
// Open related view
// cluster.primaryAction
// ...(Array.isArray(cluster.actions) ? cluster.actions : [])
// projectId
// surface: "home_project"
// contactId
// data.relatedTo
// projectLabelFromPayload
// homeLabelFromPayload
// vehicleLabelFromPayload
// clientLabelFromPayload
// /homes?homeId=
// &projectId=
// /vehicles?vehicleId=
// countyFips

type SavedScoutThreadRelatedTo = {
  kind: "project" | "home" | "vehicle" | "client" | "generic";
  id?: string;
  label?: string;
  homeId?: string;
  surface?: "home_project" | "commercial_project";
};

type SavedScoutThread = {
  id: string;
  title: string;
  preview: string;
  summary?: string;
  intent?: string | null;
  relatedLabel?: string;
  relatedPath?: string;
  relatedTo?: SavedScoutThreadRelatedTo;
  searchText?: string;
  countyFips?: string | null;
  stateCode?: string | null;
  updatedAt: string;
  messageCount: number;
  messages: ScoutMessage[];
};

type SavedScoutSurfaceFilter =
  | "all"
  | "project"
  | "home"
  | "vehicle"
  | "client"
  | "materials"
  | "prices";

const SAVED_SCOUT_SURFACE_FILTERS: Array<{
  value: SavedScoutSurfaceFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "project", label: "Projects" },
  { value: "home", label: "Homes" },
  { value: "vehicle", label: "Vehicles" },
  { value: "client", label: "Clients" },
  { value: "materials", label: "Materials" },
  { value: "prices", label: "Prices" },
];

const BANNED_TERMS = ["fuck", "shit", "bitch", "asshole", "cunt", "slut", "whore"];

type ScoutHomeIdDashboardResponse = {
  completionScore?: number;
  requestPrompts?: Array<{ id?: string; reason?: string }>;
  overview?: {
    recentEvents?: Array<{ id?: string; title?: string; createdAt?: string }>;
  };
};

type HomeIdMaintenanceSuggestionType =
  | "missing_info"
  | "maintenance_check"
  | "evidence_prompt"
  | "request_packet_prompt"
  | "seasonal_basic";

type HomeIdMaintenanceSuggestion = {
  id: string;
  type: HomeIdMaintenanceSuggestionType;
  title: string;
  reason: string;
  actionLabel: string;
};

type HomeIdSimilarLocalSignal = {
  id: string;
  category: string;
  componentType: string;
  sampleCount: number;
  title: string;
  reason: string;
  actionLabel: string;
};

type HomeIdActionCardType =
  | "add_missing_fact"
  | "review_component"
  | "attach_evidence"
  | "create_request_packet"
  | "resume_request_packet"
  | "view_homeid"
  | "view_component";

type HomeIdActionCard = {
  id: string;
  title: string;
  reason: string;
  source: "context" | "maintenance_suggestion" | "similar_home_signal";
  actionType: HomeIdActionCardType;
  targetHomeId: string;
  targetComponentId?: string;
  targetPacketId?: string;
  ctaLabel: string;
  href: string;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function evaluateHomeIdMaintenanceSuggestions(args: {
  monthIndex: number;
  propertyDetails: Array<Record<string, unknown>>;
  components: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  requestPackets: Array<Record<string, unknown>>;
  recentActivity: Array<{ title: string }>;
}): HomeIdMaintenanceSuggestion[] {
  const suggestions: HomeIdMaintenanceSuggestion[] = [];
  const seenIds = new Set<string>();
  const add = (item: HomeIdMaintenanceSuggestion) => {
    if (seenIds.has(item.id)) return;
    seenIds.add(item.id);
    suggestions.push(item);
  };

  const detailsByCategory = new Set(
    args.propertyDetails
      .map((detail) =>
        String(detail.category || "")
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
  );
  const componentList = args.components.map((component) => ({
    id: String(component.id || "").trim(),
    type: String(component.type || "")
      .trim()
      .toLowerCase(),
    label: String(component.label || "").trim(),
    status: String(component.status || "")
      .trim()
      .toLowerCase(),
  }));
  const evidenceList = args.evidence.map((entry) => ({
    type: String(entry.evidenceType || "")
      .trim()
      .toLowerCase(),
    componentId: String(entry.componentId || "").trim(),
  }));
  const hasCompletedWork = args.recentActivity.some((event) =>
    /completed_work|completed/i.test(event.title || "")
  );
  const hasReceiptOrInvoiceEvidence = evidenceList.some(
    (entry) => entry.type === "receipt" || entry.type === "invoice"
  );

  for (const component of componentList) {
    if (component.status === "needs_review") {
      add({
        id: `review_${component.id || component.type || "component"}`,
        type: "missing_info",
        title: `Review ${component.label || component.type || "component"} details`,
        reason: "This component is marked needs_review in HomeID.",
        actionLabel: "Review in HomeID",
      });
    }
  }

  const roofComponent = componentList.find((component) => component.type === "roof");
  if (roofComponent) {
    const hasRoofEvidence = evidenceList.some(
      (entry) => entry.componentId === roofComponent.id || entry.type === "photo"
    );
    if (!hasRoofEvidence && !detailsByCategory.has("roof")) {
      add({
        id: "roof_missing_info",
        type: "missing_info",
        title: "Add roof details if known",
        reason: "Roof component exists without supporting roof detail or evidence.",
        actionLabel: "Add roof detail",
      });
    }
  }

  const hvacComponent = componentList.find((component) => component.type === "hvac");
  if (hvacComponent) {
    const hasHvacServiceDetail =
      detailsByCategory.has("hvac") ||
      args.recentActivity.some((event) => /hvac|service/i.test(event.title || ""));
    if (!hasHvacServiceDetail) {
      add({
        id: "hvac_maintenance_check",
        type: "maintenance_check",
        title: "Review HVAC service history",
        reason: "HVAC component exists without clear service history in HomeID.",
        actionLabel: "Add HVAC service detail",
      });
    }
  }

  const waterHeaterComponent = componentList.find((component) => component.type === "water_heater");
  if (waterHeaterComponent && !detailsByCategory.has("water_heater")) {
    add({
      id: "water_heater_install_info",
      type: "missing_info",
      title: "Add water heater install details if known",
      reason: "Water heater component exists without install detail in HomeID.",
      actionLabel: "Add water heater detail",
    });
  }

  if (hasCompletedWork && !hasReceiptOrInvoiceEvidence) {
    add({
      id: "completed_work_evidence_prompt",
      type: "evidence_prompt",
      title: "Attach receipt or invoice evidence",
      reason: "Completed work exists but no receipt/invoice evidence is attached.",
      actionLabel: "Add evidence",
    });
  }

  const hasNeedsReviewComponent = componentList.some(
    (component) => component.status === "needs_review"
  );
  const hasOpenPacket = args.requestPackets.some((packet) => {
    const status = String(packet.status || "")
      .trim()
      .toLowerCase();
    return status === "draft" || status === "needs_info";
  });
  if (hasNeedsReviewComponent && !hasOpenPacket) {
    add({
      id: "request_packet_prompt",
      type: "request_packet_prompt",
      title: "Prepare a request packet for unresolved components",
      reason: "At least one component needs review and no open request packet exists.",
      actionLabel: "Open request packets",
    });
  }

  if (args.monthIndex >= 2 && args.monthIndex <= 7) {
    add({
      id: "seasonal_hvac_cooling",
      type: "seasonal_basic",
      title: "Review HVAC readiness",
      reason: "Consider reviewing HVAC readiness before peak cooling season.",
      actionLabel: "Check HomeID",
    });
  } else {
    add({
      id: "seasonal_heating_seal",
      type: "seasonal_basic",
      title: "Review heater and weather sealing readiness",
      reason: "Consider reviewing heating and sealing readiness for colder months.",
      actionLabel: "Check HomeID",
    });
  }

  return suggestions.slice(0, 6);
}

function mapSignalComponentType(
  value: string,
  knownComponentTypes: Set<string>
): { componentType: string; category: string } | null {
  const normalized = String(value || "").toLowerCase();
  const match = (
    key: string,
    aliases: string[],
    category: string
  ): { componentType: string; category: string } | null => {
    if (aliases.some((alias) => normalized.includes(alias)) || knownComponentTypes.has(key)) {
      return { componentType: key, category };
    }
    return null;
  };
  return (
    match("hvac", ["hvac", "ac", "air", "cooling", "heating", "furnace"], "maintenance") ||
    match("roof", ["roof", "roofing"], "inspection") ||
    match("water_heater", ["water heater", "heater"], "repair") ||
    match("plumbing", ["plumbing", "pipe", "leak"], "repair") ||
    match("electrical", ["electrical", "panel", "wiring"], "inspection") ||
    match("exterior", ["exterior", "siding", "gutter"], "maintenance")
  );
}

function evaluateHomeIdSimilarLocalSignals(args: {
  components: Array<Record<string, unknown>>;
  trendingPrompts: Array<Record<string, unknown>>;
  minimumSampleCount: number;
}): HomeIdSimilarLocalSignal[] {
  const signals: HomeIdSimilarLocalSignal[] = [];
  const seen = new Set<string>();
  const knownComponentTypes = new Set(
    args.components
      .map((component) =>
        String(component.type || "")
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
  );

  for (const prompt of args.trendingPrompts) {
    const text = String(prompt.text || "").trim();
    const category = String(prompt.category || "").trim();
    const intent = String(prompt.intent || "").trim();
    const count = Number(prompt.count || 0);
    if (!text || !Number.isFinite(count) || count < args.minimumSampleCount) continue;
    const combined = `${text} ${category} ${intent}`.toLowerCase();
    const mapped = mapSignalComponentType(combined, knownComponentTypes);
    if (!mapped) continue;
    const id = `${mapped.componentType}_${count}_${intent || "signal"}`;
    if (seen.has(id)) continue;
    seen.add(id);
    signals.push({
      id,
      category: mapped.category,
      componentType: mapped.componentType,
      sampleCount: Math.floor(count),
      title: `${mapped.componentType.replace("_", " ")} requests are active in your area`,
      reason: `Local aggregate request activity reached ${Math.floor(
        count
      )} similar signals. This is aggregate-only and privacy-safe.`,
      actionLabel: "Prepare request packet",
    });
  }

  return signals.slice(0, 3);
}

function buildHomeIdActionCards(args: {
  homeId: string;
  components: Array<Record<string, unknown>>;
  requestPackets: Array<Record<string, unknown>>;
  maintenanceSuggestions: HomeIdMaintenanceSuggestion[];
  similarSignals: HomeIdSimilarLocalSignal[];
  missingCriticalInfoCount: number;
}): HomeIdActionCard[] {
  const cards: HomeIdActionCard[] = [];
  const seen = new Set<string>();
  const add = (card: HomeIdActionCard) => {
    if (seen.has(card.id)) return;
    seen.add(card.id);
    cards.push(card);
  };

  const firstNeedsReviewComponent = args.components.find(
    (component) =>
      String(component.status || "")
        .trim()
        .toLowerCase() === "needs_review"
  );
  if (firstNeedsReviewComponent) {
    const componentId = String(firstNeedsReviewComponent.id || "").trim();
    add({
      id: `review_component_${componentId || "first"}`,
      title: `Review ${String(firstNeedsReviewComponent.label || "component")} details`,
      reason: "This component is marked needs_review in HomeID.",
      source: "context",
      actionType: "review_component",
      targetHomeId: args.homeId,
      targetComponentId: componentId || undefined,
      ctaLabel: "Review component",
      href: `/homes?homeId=${encodeURIComponent(args.homeId)}`,
    });
  }

  const openPacket = args.requestPackets.find((packet) => {
    const status = String(packet.status || "")
      .trim()
      .toLowerCase();
    return status === "draft" || status === "needs_info";
  });
  if (openPacket) {
    const packetId = String(openPacket.id || "").trim();
    add({
      id: `resume_packet_${packetId || "open"}`,
      title: "Resume open request packet",
      reason: "You have an open HomeID request packet that can be completed.",
      source: "context",
      actionType: "resume_request_packet",
      targetHomeId: args.homeId,
      targetPacketId: packetId || undefined,
      ctaLabel: "Resume packet",
      href: `/homes?homeId=${encodeURIComponent(args.homeId)}`,
    });
  }

  if (args.missingCriticalInfoCount > 0) {
    add({
      id: "add_missing_fact",
      title: "Add missing HomeID facts",
      reason: `${args.missingCriticalInfoCount} critical HomeID detail(s) are still missing.`,
      source: "context",
      actionType: "add_missing_fact",
      targetHomeId: args.homeId,
      ctaLabel: "Update HomeID",
      href: `/homes?homeId=${encodeURIComponent(args.homeId)}`,
    });
  }

  for (const suggestion of args.maintenanceSuggestions) {
    if (suggestion.type === "evidence_prompt") {
      add({
        id: `evidence_${suggestion.id}`,
        title: suggestion.title,
        reason: suggestion.reason,
        source: "maintenance_suggestion",
        actionType: "attach_evidence",
        targetHomeId: args.homeId,
        ctaLabel: "Add evidence",
        href: `/homes?homeId=${encodeURIComponent(args.homeId)}`,
      });
      continue;
    }
    if (suggestion.type === "request_packet_prompt") {
      add({
        id: `packet_${suggestion.id}`,
        title: suggestion.title,
        reason: suggestion.reason,
        source: "maintenance_suggestion",
        actionType: "create_request_packet",
        targetHomeId: args.homeId,
        ctaLabel: "Create packet",
        href: `/homes?homeId=${encodeURIComponent(args.homeId)}`,
      });
      continue;
    }
    if (suggestion.type === "missing_info" || suggestion.type === "maintenance_check") {
      add({
        id: `fact_${suggestion.id}`,
        title: suggestion.title,
        reason: suggestion.reason,
        source: "maintenance_suggestion",
        actionType: "add_missing_fact",
        targetHomeId: args.homeId,
        ctaLabel: "Update HomeID",
        href: `/homes?homeId=${encodeURIComponent(args.homeId)}`,
      });
    }
  }

  for (const signal of args.similarSignals) {
    add({
      id: `signal_${signal.id}`,
      title: `Prepare ${signal.componentType.replace("_", " ")} request packet`,
      reason: signal.reason,
      source: "similar_home_signal",
      actionType: "create_request_packet",
      targetHomeId: args.homeId,
      ctaLabel: "Create packet",
      href: `/homes?homeId=${encodeURIComponent(args.homeId)}`,
    });
  }

  if (cards.length === 0) {
    add({
      id: "view_homeid",
      title: "Open HomeID dashboard",
      reason: "Review your property record and choose your next update.",
      source: "context",
      actionType: "view_homeid",
      targetHomeId: args.homeId,
      ctaLabel: "View HomeID",
      href: `/homes?homeId=${encodeURIComponent(args.homeId)}`,
    });
  }

  return cards.slice(0, 6);
}

function containsProfanity(text: string) {
  const lower = text.toLowerCase();
  return BANNED_TERMS.some((term) => lower.includes(term));
}

function censorProfanity(text: string) {
  let cleaned = text;
  for (const term of BANNED_TERMS) {
    const re = new RegExp(term, "gi");
    cleaned = cleaned.replace(re, `${term[0]}***`);
  }
  return cleaned;
}

function savedScoutThreadsKey(userId?: string | null): string {
  return `scout:saved_threads:v${SCOUT_SAVED_THREADS_VERSION}:${userId || "guest"}`;
}

function firstThreadUserMessage(messages: ScoutMessage[]): ScoutMessage | undefined {
  return messages.find((message) => message.role === "user" && message.content.trim().length > 0);
}

function summarizeThreadText(value: string, fallback: string): string {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return fallback;
  return clean.length > 72 ? `${clean.slice(0, 69)}...` : clean;
}

function sanitizeRelatedId(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/[#?].*$/, "");
  return trimmed ? trimmed.slice(0, 120) : undefined;
}

function getRouteMatchId(route: string, pattern: RegExp): string | undefined {
  const match = route.match(pattern);
  if (!match?.[1]) return undefined;
  return sanitizeRelatedId(decodeURIComponent(match[1]));
}

function cleanRelatedLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, 80) : undefined;
}

function firstPayloadLabel(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const label = cleanRelatedLabel(data[key]);
    if (label) return label;
  }
  return undefined;
}

function homeLabelFromPayload(data: Record<string, unknown>, fallbackId?: string): string {
  const nickname = firstPayloadLabel(data, ["homeName", "homeTitle", "nickname", "label", "title"]);
  if (nickname) return nickname;

  const address = [
    cleanRelatedLabel(data.address1) || cleanRelatedLabel(data.address),
    cleanRelatedLabel(data.city),
    cleanRelatedLabel(data.stateCode) || cleanRelatedLabel(data.state),
  ]
    .filter(Boolean)
    .join(", ");
  if (address) return address;

  return fallbackId ? `Home ${fallbackId}` : "Home";
}

function vehicleLabelFromPayload(data: Record<string, unknown>, fallbackId?: string): string {
  const nickname = firstPayloadLabel(data, [
    "vehicleName",
    "vehicleTitle",
    "nickname",
    "label",
    "title",
  ]);
  if (nickname) return nickname;

  const details = [
    data.year == null ? undefined : cleanRelatedLabel(String(data.year)),
    cleanRelatedLabel(data.make),
    cleanRelatedLabel(data.model),
    cleanRelatedLabel(data.trim),
  ]
    .filter(Boolean)
    .join(" ");
  if (details) return details;

  return fallbackId ? `Vehicle ${fallbackId}` : "Vehicle";
}

function projectLabelFromPayload(data: Record<string, unknown>, fallbackId?: string): string {
  return (
    firstPayloadLabel(data, [
      "projectName",
      "projectTitle",
      "jobName",
      "jobTitle",
      "name",
      "title",
      "label",
    ]) || (fallbackId ? `Project ${fallbackId}` : "Project")
  );
}

function clientLabelFromPayload(data: Record<string, unknown>, fallbackId?: string): string {
  return (
    firstPayloadLabel(data, [
      "clientName",
      "customerName",
      "contactName",
      "name",
      "title",
      "label",
    ]) || (fallbackId ? `Client ${fallbackId}` : "Client work")
  );
}

function inferRelatedFromRoute(route: string): SavedScoutThreadRelatedTo | undefined {
  const clean = route.trim();
  if (!clean) return undefined;

  if (/\/project-tracker/.test(clean) || /\/finances\/jobs?/.test(clean)) {
    const jobId =
      getRouteMatchId(clean, /[?&]jobId=([^&/#?]+)/) || getRouteMatchId(clean, /\/jobs\/([^/?#]+)/);
    return {
      kind: "project",
      id: jobId,
      label: jobId ? `Project ${jobId}` : "Project",
    };
  }

  if (/\/homes/.test(clean)) {
    const homeId =
      getRouteMatchId(clean, /[?&](?:homeId|id)=([^&/#?]+)/) ||
      getRouteMatchId(clean, /\/homes\/([^/?#]+)/);
    const projectId = getRouteMatchId(clean, /[?&]projectId=([^&/#?]+)/);
    if (projectId) {
      return {
        kind: "project",
        id: projectId,
        homeId,
        surface: "home_project",
        label: `Home project ${projectId}`,
      };
    }
    return {
      kind: "home",
      id: homeId,
      label: homeId ? `Home ${homeId}` : "Home",
    };
  }

  if (/\/vehicles/.test(clean)) {
    const vehicleId =
      getRouteMatchId(clean, /[?&](?:vehicleId|id)=([^&/#?]+)/) ||
      getRouteMatchId(clean, /\/vehicles\/([^/?#]+)/);
    return {
      kind: "vehicle",
      id: vehicleId,
      label: vehicleId ? `Vehicle ${vehicleId}` : "Vehicle",
    };
  }

  if (/\/direct-connect/.test(clean)) {
    const clientId = getRouteMatchId(clean, /[?&](?:clientId|jobId)=([^&/#?]+)/);
    return {
      kind: "client",
      id: clientId,
      label: clientId ? `Client ${clientId}` : "Client work",
    };
  }

  return undefined;
}

function resolveRelatedFromPayload(payload: unknown): SavedScoutThreadRelatedTo | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const data = payload as Record<string, unknown>;

  if (typeof data.jobId === "string" && data.jobId.trim()) {
    const id = sanitizeRelatedId(data.jobId);
    return { kind: "project", id, label: projectLabelFromPayload(data, id) };
  }

  if (typeof data.projectId === "string" && data.projectId.trim()) {
    const id = sanitizeRelatedId(data.projectId);
    const homeId = typeof data.homeId === "string" ? sanitizeRelatedId(data.homeId) : undefined;
    return {
      kind: "project",
      id,
      homeId,
      surface: homeId ? "home_project" : "commercial_project",
      label: projectLabelFromPayload(data, id),
    };
  }

  if (typeof data.homeId === "string" && data.homeId.trim()) {
    const id = sanitizeRelatedId(data.homeId);
    return { kind: "home", id, label: homeLabelFromPayload(data, id) };
  }

  if (typeof data.vehicleId === "string" && data.vehicleId.trim()) {
    const id = sanitizeRelatedId(data.vehicleId);
    return { kind: "vehicle", id, label: vehicleLabelFromPayload(data, id) };
  }

  if (typeof data.clientId === "string" && data.clientId.trim()) {
    const id = sanitizeRelatedId(data.clientId);
    return { kind: "client", id, label: clientLabelFromPayload(data, id) };
  }

  if (typeof data.contactId === "string" && data.contactId.trim()) {
    const id = sanitizeRelatedId(data.contactId);
    return { kind: "client", id, label: clientLabelFromPayload(data, id) };
  }

  const nestedRelatedTo =
    data.relatedTo && typeof data.relatedTo === "object" && !Array.isArray(data.relatedTo)
      ? (data.relatedTo as Record<string, unknown>)
      : null;
  if (nestedRelatedTo) {
    const type = nestedRelatedTo.type || nestedRelatedTo.kind;
    const id =
      typeof nestedRelatedTo.id === "string" ? sanitizeRelatedId(nestedRelatedTo.id) : undefined;
    const label =
      cleanRelatedLabel(nestedRelatedTo.label) || cleanRelatedLabel(nestedRelatedTo.name);
    if (type === "project") {
      const homeId =
        typeof nestedRelatedTo.homeId === "string"
          ? sanitizeRelatedId(nestedRelatedTo.homeId)
          : undefined;
      const surface = nestedRelatedTo.surface === "home_project" ? "home_project" : undefined;
      return {
        kind: "project",
        id,
        homeId,
        surface,
        label: label || projectLabelFromPayload(data, id),
      };
    }
    if (type === "home")
      return { kind: "home", id, label: label || homeLabelFromPayload(data, id) };
    if (type === "vehicle") {
      return { kind: "vehicle", id, label: label || vehicleLabelFromPayload(data, id) };
    }
    if (type === "client" || type === "contact") {
      return { kind: "client", id, label: label || clientLabelFromPayload(data, id) };
    }
  }

  return undefined;
}

function relatedLabelFromKind(kind: SavedScoutThreadRelatedTo["kind"]): string {
  if (kind === "project") return "Project";
  if (kind === "home") return "Home";
  if (kind === "vehicle") return "Vehicle";
  if (kind === "client") return "Client work";
  return "Saved work";
}

function savedThreadSurface(thread: SavedScoutThread): SavedScoutSurfaceFilter {
  const kind = thread.relatedTo?.kind;
  if (kind === "project" || kind === "home" || kind === "vehicle" || kind === "client") {
    return kind;
  }

  const intent = String(thread.intent || "").toLowerCase();
  const label = `${thread.relatedLabel || ""} ${thread.relatedTo?.label || ""}`.toLowerCase();
  if (intent === "materials" || label.includes("material")) return "materials";
  if (intent === "prices" || label.includes("price")) return "prices";
  return "all";
}

function savedConversationQueryUrl(query: string, surface: SavedScoutSurfaceFilter): string {
  const params = new URLSearchParams();
  if (query.trim().length >= 2) params.set("q", query.trim());
  if (surface !== "all") params.set("surface", surface);
  const suffix = params.toString();
  return suffix ? `/api/scout/conversations?${suffix}` : "/api/scout/conversations";
}

function isSavedScoutThreadRelatedKind(kind: unknown): kind is SavedScoutThreadRelatedTo["kind"] {
  return (
    kind === "project" ||
    kind === "home" ||
    kind === "vehicle" ||
    kind === "client" ||
    kind === "generic"
  );
}

function relatedPathFromRelatedTo(relatedTo: SavedScoutThreadRelatedTo): string | undefined {
  if (relatedTo.kind === "project" && relatedTo.id) {
    if (relatedTo.surface === "home_project" && relatedTo.homeId) {
      return `/homes?homeId=${encodeURIComponent(relatedTo.homeId)}&projectId=${encodeURIComponent(
        relatedTo.id
      )}`;
    }
    return `/project-tracker?jobId=${encodeURIComponent(relatedTo.id)}`;
  }
  if (relatedTo.kind === "home" && relatedTo.id) {
    return `/homes?homeId=${encodeURIComponent(relatedTo.id)}`;
  }
  if (relatedTo.kind === "vehicle" && relatedTo.id) {
    return `/vehicles?vehicleId=${encodeURIComponent(relatedTo.id)}`;
  }
  if (relatedTo.kind === "client" && relatedTo.id) {
    return `/direct-connect?clientId=${encodeURIComponent(relatedTo.id)}`;
  }
  return undefined;
}

function labelForRelatedRoute(route: string): string {
  const relatedFromRoute = inferRelatedFromRoute(route);
  if (relatedFromRoute?.label) return relatedFromRoute.label;
  return "Saved work";
}

function relatedFromAction(action: ScoutAction | undefined):
  | {
      relatedTo: SavedScoutThreadRelatedTo;
      relatedPath: string;
    }
  | undefined {
  if (!action) return undefined;

  const relatedFromPayload = resolveRelatedFromPayload(action.payload);
  if (relatedFromPayload) {
    return {
      relatedTo: relatedFromPayload,
      relatedPath:
        relatedPathFromRelatedTo(relatedFromPayload) ||
        action.to ||
        action.path ||
        "/direct-connect",
    };
  }

  const route =
    typeof action.to === "string" && action.to.trim()
      ? action.to
      : typeof action.path === "string" && action.path.trim()
        ? action.path
        : "";
  if (!route) return undefined;

  const relatedFromRoute = inferRelatedFromRoute(route);
  if (!relatedFromRoute) return undefined;

  return {
    relatedTo: relatedFromRoute,
    relatedPath: relatedPathFromRelatedTo(relatedFromRoute) || route,
  };
}

function buildSavedThreadSummary(messages: ScoutMessage[]): string {
  const userMessage = firstThreadUserMessage(messages);
  const assistantMessage = messages.find(
    (message) => message.role === "assistant" && message.content.trim().length > 0
  );
  const source = assistantMessage?.content || userMessage?.content || "";
  return summarizeThreadText(source, "Saved Scout conversation");
}

function inferSavedThreadIntent(messages: ScoutMessage[]): {
  intent: string;
  relatedLabel: string;
  relatedPath: string;
  relatedTo?: SavedScoutThreadRelatedTo;
} {
  const latestFirst = messages.slice().reverse();

  for (const message of latestFirst) {
    if (typeof message.navTarget === "string" && message.navTarget.trim()) {
      const relatedFromNav = inferRelatedFromRoute(message.navTarget);
      if (relatedFromNav) {
        return {
          intent: relatedFromNav.kind === "project" ? "client_work" : "local_help",
          relatedLabel: relatedFromNav.label || labelForRelatedRoute(message.navTarget),
          relatedPath: relatedPathFromRelatedTo(relatedFromNav) || message.navTarget,
          relatedTo: relatedFromNav,
        };
      }
    }

    const memoryJobId = message.memoryDelta?.lastJobId;
    if (typeof memoryJobId === "string" && memoryJobId.trim()) {
      const id = sanitizeRelatedId(memoryJobId);
      if (id) {
        const relatedTo: SavedScoutThreadRelatedTo = {
          kind: "project",
          id,
          label: `Project ${id}`,
        };
        return {
          intent: "client_work",
          relatedLabel: relatedTo.label || "Project",
          relatedPath: `/project-tracker?jobId=${encodeURIComponent(id)}`,
          relatedTo,
        };
      }
    }

    if (Array.isArray(message.clusters)) {
      for (const cluster of message.clusters) {
        const actionsToScan = [
          cluster.primaryAction,
          ...(Array.isArray(cluster.actions) ? cluster.actions : []),
        ];

        for (const action of actionsToScan) {
          const related = relatedFromAction(action);
          if (!related) continue;
          const relatedTo = related.relatedTo;
          return {
            intent: relatedTo.kind === "project" ? "client_work" : "local_help",
            relatedLabel: relatedTo.label || relatedLabelFromKind(relatedTo.kind),
            relatedPath: related.relatedPath,
            relatedTo,
          };
        }
      }
    }
  }

  const text = messages
    .map((message) => message.content)
    .join(" ")
    .toLowerCase();

  if (
    /\b(material|materials|supplier|suppliers|lumber|concrete|decking|parts?|supply run)\b/.test(
      text
    )
  ) {
    return {
      intent: "materials",
      relatedLabel: "Materials",
      relatedPath: "/utilities/supply-run",
    };
  }

  if (/\b(price|prices|cost|costs|estimate|quote|bid|range|deal|deals)\b/.test(text)) {
    return {
      intent: "prices",
      relatedLabel: "Prices",
      relatedPath: "/finances/materials",
    };
  }

  if (/\b(client|customer|invoice|invoices|job|quote|contract|business)\b/.test(text)) {
    return {
      intent: "client_work",
      relatedLabel: "Client work",
      relatedPath: "/direct-connect",
    };
  }

  if (/\b(vehicle|car|truck|trailer|boat|motorcycle|atv)\b/.test(text)) {
    return {
      intent: "vehicle",
      relatedLabel: "Vehicle",
      relatedPath: "/vehicles",
    };
  }

  if (/\b(home|house|roof|plumbing|electrical|hvac|ac|deck|fence|driveway|yard)\b/.test(text)) {
    return {
      intent: "home",
      relatedLabel: "Home",
      relatedPath: "/homes",
    };
  }

  return {
    intent: "local_help",
    relatedLabel: "Local help",
    relatedPath: "/direct-connect",
  };
}

function compactSavedScoutMessages(messages: ScoutMessage[]): ScoutMessage[] {
  return messages.slice(-SCOUT_SAVED_THREAD_MESSAGE_LIMIT).map((message) => ({
    ...message,
    content:
      message.content.length > SCOUT_SAVED_THREAD_CONTENT_LIMIT
        ? `${message.content.slice(0, SCOUT_SAVED_THREAD_CONTENT_LIMIT - 3)}...`
        : message.content,
  }));
}

function buildSavedScoutThread(
  messages: ScoutMessage[],
  existingId?: string | null,
  location?: { countyFips?: string | null; stateCode?: string | null }
): SavedScoutThread | null {
  const firstUserMessage = firstThreadUserMessage(messages);
  if (!firstUserMessage) return null;

  const lastMessage = [...messages].reverse().find((message) => message.content.trim().length > 0);
  const updatedAt = new Date().toISOString();
  const threadIntent = inferSavedThreadIntent(messages);
  const summary = buildSavedThreadSummary(messages);
  const searchText = [
    firstUserMessage.content,
    lastMessage?.content,
    summary,
    threadIntent.relatedLabel,
    threadIntent.relatedTo?.label,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    id: existingId || `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: summarizeThreadText(firstUserMessage.content, "Scout conversation"),
    preview: summarizeThreadText(
      lastMessage?.content || firstUserMessage.content,
      "Saved Scout conversation"
    ),
    summary,
    intent: threadIntent.intent,
    relatedLabel: threadIntent.relatedLabel,
    relatedPath: threadIntent.relatedPath,
    relatedTo: threadIntent.relatedTo,
    searchText,
    countyFips: location?.countyFips || null,
    stateCode: location?.stateCode || null,
    updatedAt,
    messageCount: messages.length,
    messages: compactSavedScoutMessages(messages),
  };
}

function normalizeSavedScoutThreads(input: unknown): SavedScoutThread[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is SavedScoutThread => {
      return (
        item &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        Array.isArray(item.messages)
      );
    })
    .map((item) => ({
      ...item,
      summary: typeof item.summary === "string" ? item.summary : item.preview || "",
      intent: typeof item.intent === "string" ? item.intent : null,
      relatedTo: (() => {
        const candidate =
          item.relatedTo && typeof item.relatedTo === "object" && !Array.isArray(item.relatedTo)
            ? (item.relatedTo as Record<string, unknown>)
            : (item as any).metadata?.relatedTo;

        if (
          candidate &&
          typeof candidate === "object" &&
          !Array.isArray(candidate) &&
          typeof (candidate as Record<string, unknown>).kind === "string"
        ) {
          const fromMetadata = candidate as Record<string, unknown>;
          const kind = fromMetadata.kind;
          if (isSavedScoutThreadRelatedKind(kind)) {
            const id =
              typeof fromMetadata.id === "string" ? sanitizeRelatedId(fromMetadata.id) : undefined;
            const surface: SavedScoutThreadRelatedTo["surface"] =
              fromMetadata.surface === "home_project" ||
              fromMetadata.surface === "commercial_project"
                ? fromMetadata.surface
                : undefined;
            return {
              kind,
              id,
              label: typeof fromMetadata.label === "string" ? fromMetadata.label : undefined,
              homeId:
                typeof fromMetadata.homeId === "string"
                  ? sanitizeRelatedId(fromMetadata.homeId)
                  : undefined,
              surface,
            };
          }
        }

        const candidatePath =
          typeof item.relatedPath === "string"
            ? item.relatedPath
            : typeof (item as any).metadata?.relatedPath === "string"
              ? (item as any).metadata.relatedPath
              : "";
        if (candidatePath) {
          const inferred = inferRelatedFromRoute(candidatePath);
          if (inferred) {
            return inferred;
          }
        }

        return undefined;
      })(),
      relatedLabel:
        typeof item.relatedLabel === "string"
          ? item.relatedLabel
          : typeof (item as any).metadata?.relatedLabel === "string"
            ? (item as any).metadata.relatedLabel
            : "Saved",
      relatedPath:
        typeof item.relatedPath === "string"
          ? item.relatedPath
          : typeof (item as any).metadata?.relatedPath === "string"
            ? (item as any).metadata.relatedPath
            : "/scout",
      searchText:
        typeof item.searchText === "string"
          ? item.searchText
          : typeof (item as any).metadata?.searchText === "string"
            ? (item as any).metadata.searchText
            : [item.title, item.preview, item.summary].filter(Boolean).join(" "),
      countyFips: typeof item.countyFips === "string" ? item.countyFips : null,
      stateCode: typeof item.stateCode === "string" ? item.stateCode : null,
      messages: compactSavedScoutMessages(item.messages),
      messageCount:
        typeof item.messageCount === "number" ? item.messageCount : item.messages.length,
    }))
    .slice(0, SCOUT_SAVED_THREADS_LIMIT);
}

function readSavedScoutThreads(userId?: string | null): SavedScoutThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(savedScoutThreadsKey(userId));
    if (!raw) return [];
    return normalizeSavedScoutThreads(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeSavedScoutThreads(userId: string | null | undefined, threads: SavedScoutThread[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      savedScoutThreadsKey(userId),
      JSON.stringify(threads.slice(0, SCOUT_SAVED_THREADS_LIMIT))
    );
  } catch {
    // Local saves are a convenience layer; failing here should not block Scout.
  }
}

function upsertSavedScoutThread(
  userId: string | null | undefined,
  messages: ScoutMessage[],
  existingId?: string | null,
  location?: { countyFips?: string | null; stateCode?: string | null }
): SavedScoutThread | null {
  const nextThread = buildSavedScoutThread(messages, existingId, location);
  if (!nextThread) return null;
  const threads = readSavedScoutThreads(userId);
  const next = [nextThread, ...threads.filter((thread) => thread.id !== nextThread.id)].slice(
    0,
    SCOUT_SAVED_THREADS_LIMIT
  );
  writeSavedScoutThreads(userId, next);
  return nextThread;
}

function removeSavedScoutThread(
  userId: string | null | undefined,
  threadId: string
): SavedScoutThread[] {
  const next = readSavedScoutThreads(userId).filter((thread) => thread.id !== threadId);
  writeSavedScoutThreads(userId, next);
  return next;
}

function mergeSavedScoutThreads(
  primary: SavedScoutThread[],
  secondary: SavedScoutThread[]
): SavedScoutThread[] {
  const seen = new Set<string>();
  const merged: SavedScoutThread[] = [];
  for (const thread of [...primary, ...secondary]) {
    if (seen.has(thread.id)) continue;
    seen.add(thread.id);
    merged.push(thread);
  }
  return merged
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, SCOUT_SAVED_THREADS_LIMIT);
}

function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeActionKey(input: string): string {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeScoutActions(actions?: ScoutAction[]): ScoutAction[] {
  if (!Array.isArray(actions) || actions.length === 0) return [];

  const seen = new Set<string>();
  const deduped: ScoutAction[] = [];

  for (const action of actions) {
    const target =
      action.type === "NAVIGATE"
        ? String(action.to || action.path || "")
        : action.type === "ASK_SCOUT"
          ? String(action.prompt || "")
          : String(action.type || "");
    const key = `${action.type}::${normalizeActionKey(action.label || "")}::${normalizeActionKey(target)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(action);
  }

  return deduped;
}

const DOCTRINE_SENTENCE_PATTERNS = [
  /these trust signals come from people in your community/i,
  /they.?re visible and accountable,? not anonymous reviews/i,
  /visibility does not equal access/i,
  /awareness\s*[!=]+\s*authority/i,
  /no pay[-\s]?to[-\s]?play/i,
  /without lead spam or pay[-\s]?to[-\s]?play ranking/i,
];

function stripDoctrineSpeak(input: string): string {
  const sentences = input
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!sentences.length) return input;

  const filtered = sentences.filter(
    (sentence) => !DOCTRINE_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentence))
  );

  if (!filtered.length) {
    return "Here is the fastest next step I can run for you right now.";
  }

  return filtered.join(" ");
}

function tokenOverlapScore(query: string, candidate: string): number {
  const q = normalizeForMatch(query);
  const c = normalizeForMatch(candidate);
  if (!q || !c) return 0;
  if (c.includes(q)) return 0.98;

  const qTokens = new Set(q.split(" ").filter(Boolean));
  const cTokens = new Set(c.split(" ").filter(Boolean));
  if (qTokens.size === 0 || cTokens.size === 0) return 0;

  let intersect = 0;
  qTokens.forEach((t) => {
    if (cTokens.has(t)) intersect += 1;
  });
  const union = qTokens.size + cTokens.size - intersect;
  const jaccard = union > 0 ? intersect / union : 0;

  // Penalize very short / generic queries
  const lengthBoost = Math.min(1, q.length / 12);
  return Math.max(0, Math.min(0.95, jaccard * 0.9 + lengthBoost * 0.1));
}

function tryRecordCountyExplanationFollowup(
  kind: "navigate" | "scout_message" | "gated_query_success",
  path: string
) {
  try {
    if (typeof window === "undefined") return;

    if (window.localStorage.getItem(COUNTY_EXPLAINED_FOLLOWUP_KEY) === "1") {
      return;
    }

    const raw = window.localStorage.getItem(COUNTY_EXPLAINED_AT_KEY);
    if (!raw) return;

    const explainedAt = Number(raw);
    if (!Number.isFinite(explainedAt)) return;

    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    if (now - explainedAt > fiveMinutes) {
      return;
    }

    recordActivity({
      type: "county_explained_followup_action",
      ts: new Date().toISOString(),
      path,
      meta: { kind },
    });

    window.localStorage.setItem(COUNTY_EXPLAINED_FOLLOWUP_KEY, "1");
  } catch {
    // Ignore storage/telemetry failures; never affect UX.
  }
}

function buildOnboardingIntentSeed(
  user: any,
  profileDraft?: ProfileDraft,
  localityCounty?: string | null
) {
  const parts: string[] = [];

  if (profileDraft?.presenceType === "represent_business") {
    parts.push("I represent a business.");
  } else if (profileDraft?.presenceType === "personal") {
    parts.push("I am here for personal/local needs.");
  }

  const businessName =
    profileDraft?.businessName ||
    (typeof user?.businessName === "string" ? user.businessName : undefined);
  if (businessName) {
    parts.push(`Business name: ${businessName}.`);
  }

  const businessCategory =
    profileDraft?.businessCategory ||
    (typeof user?.businessCategory === "string" ? user.businessCategory : undefined);
  if (businessCategory) {
    parts.push(`Business category: ${businessCategory}.`);
  }

  const county =
    profileDraft?.countyName ||
    (typeof user?.countyName === "string" ? user.countyName : null) ||
    (typeof user?.county === "string" ? user.county : null) ||
    localityCounty ||
    null;
  if (county) {
    parts.push(`Primary local area container: ${county}.`);
  }

  const role = typeof user?.role === "string" ? user.role : null;
  if (role) {
    parts.push(`Role context: ${role}.`);
  }

  parts.push("Please infer my best starting focus and practical next steps.");
  return parts.join(" ");
}

/**
 * CRITICAL: Strip internal reasoning from Scout responses before rendering.
 * Internal fields like intent, thought_flow, reasoning must NEVER be visible to users.
 * This is a response sanitation contract - Scout output must be user-facing only.
 */
function sanitizeScoutMessage(raw: unknown): string {
  if (typeof raw !== "string") return "";

  const trimmed = raw.trim();

  const fallback =
    "Let's keep this practical and local. Pick a next step and I'll help from there.";

  // If response looks like JSON, recover user-facing message fields.
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      const candidate =
        (typeof parsed?.message === "string" && parsed.message) ||
        (typeof parsed?.answer === "string" && parsed.answer) ||
        (typeof parsed?.response === "string" && parsed.response) ||
        "";
      if (candidate.trim()) return sanitizeScoutMessage(candidate);
      return fallback;
    } catch {
      return fallback;
    }
  }

  const markdownStripped = trimmed
    .replace(/```[a-zA-Z0-9_-]*\n?/g, "")
    .replace(/```/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1");

  const internalSpecDump =
    /recommended by this analysis|trigger examples\s*:|implementation trust signals|auto-persist|safe path|ownership pressure|increases drop-?off|phase\s+\d+\s*:/i.test(
      markdownStripped
    ) ||
    ((markdownStripped.match(/:/g) || []).length >= 7 && markdownStripped.length > 260);
  if (internalSpecDump) return fallback;

  const internalLinePattern =
    /^(source:|knowledge base:|available knowledge base:|reasoning:|analysis:|thought[_\s-]*flow:|decision:|render order:|state injection\b|ui emphasis\b)/i;

  const withoutInternal = markdownStripped
    .split("\n")
    .filter((line) => {
      const text = line.trim();
      if (!text) return true;
      if (/\[(docs?|source)\]/i.test(text)) return false;
      if (/\b[\w/-]+\.md\b/i.test(text)) return false;
      if (/\bbehavioral_center\.md\b/i.test(text)) return false;
      if (/\bbehavioral\s+center\b/i.test(text)) return false;
      if (/^admins?$/i.test(text)) return false;
      if (/pick\s+a\s+button\s+below/i.test(text)) return false;
      if (/for\s*90%\+\s*of\s*users/i.test(text)) return false;
      return !internalLinePattern.test(text);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  const withoutDoctrine = stripDoctrineSpeak(withoutInternal);
  return withoutDoctrine || fallback;
}

function objectiveStatusToOnboardingStatus(
  status: Objective["status"]
): "pending" | "in_progress" | "completed" | "skipped" {
  if (status === "completed") return "completed";
  if (status === "active") return "in_progress";
  if (status === "paused") return "pending";
  return "skipped";
}

function objectiveStatusToProgress(status: Objective["status"]): number {
  if (status === "completed") return 100;
  if (status === "paused") return 20;
  if (status === "active") return 45;
  return 0;
}

function readScoutBrowserLocation(fallback: string): string {
  return typeof window === "undefined"
    ? fallback
    : `${window.location.pathname}${window.location.search}`;
}

export default function ScoutOS() {
  const { user, isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();
  const isMobile = useIsMobile();
  const [scoutBrowserLocation, setScoutBrowserLocation] = useState(() =>
    readScoutBrowserLocation(location)
  );
  const scoutLaunch = useMemo(
    () => parseScoutLaunchLocation(scoutBrowserLocation),
    [scoutBrowserLocation]
  );
  const [onboardingOutcomePrompt] = useState(() =>
    scoutLaunch.context?.source === "onboarding_result" ? readOnboardingResultPrompt() : ""
  );
  const hasExplicitScoutLaunch = Boolean(scoutLaunch.context || scoutLaunch.prompt);
  const appliedLaunchPromptRef = useRef<string | null>(null);
  const consumedOutcomeLaunchRef = useRef<string | null>(null);

  useEffect(() => {
    const syncBrowserLocation = () => setScoutBrowserLocation(readScoutBrowserLocation(location));
    syncBrowserLocation();
    window.addEventListener("popstate", syncBrowserLocation);
    return () => window.removeEventListener("popstate", syncBrowserLocation);
  }, [location]);

  const [toolsOpen, setToolsOpen] = useState(false);
  const [workAreaOpen, setWorkAreaOpen] = useState(false);
  const [workAreaUrl, setWorkAreaUrl] = useState<string | null>(null);
  const [workAreaTitle, setWorkAreaTitle] = useState<string | null>(null);
  const [prefillKey, setPrefillKey] = useState(0);
  const [activeMissionPanel, setActiveMissionPanel] = useState<
    "nearby" | "people" | "market" | "rules"
  >("nearby");
  const [missionType, setMissionType] = useState<"around_me" | "help" | "prices" | "events">(
    "around_me"
  );
  const [missionUrgency, setMissionUrgency] = useState<"today" | "this_week" | "exploring">(
    "this_week"
  );
  const [enabledMissionSources, setEnabledMissionSources] = useState({
    knowledge: true,
    county: true,
    live: true,
  });
  const [activeMode, setActiveMode] = useState<ScoutMode>("default");
  const [hasGuestInteracted, setHasGuestInteracted] = useState(false);
  const [overridePendingScope, setOverridePendingScope] = useState<string | null>(null);
  const [autoRouteEnabled, setAutoRouteEnabled] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return AUTO_ROUTE_DEFAULT_ENABLED;
      const raw = window.localStorage.getItem(AUTO_ROUTE_ENABLED_KEY);
      if (raw === "0") return false;
      if (raw === "1") return true;
      return AUTO_ROUTE_DEFAULT_ENABLED;
    } catch {
      return AUTO_ROUTE_DEFAULT_ENABLED;
    }
  });
  const [autoRoutePending, setAutoRoutePending] = useState<null | {
    to: string;
    label: string;
    confidence: number;
    why?: string;
  }>(null);
  const [activeObjective, setActiveObjective] = useState<Objective | null>(null);
  const [objectiveBusy, setObjectiveBusy] = useState(false);
  const [objectiveOnboardingBundle, setObjectiveOnboardingBundle] = useState<any | null>(null);
  const [watchdogResult, setWatchdogResult] = useState<any | null>(null);
  const [dismissedWatchdogId, setDismissedWatchdogId] = useState<string | null>(null);

  const [dcConfirmOpen, setDcConfirmOpen] = useState(false);
  const [dcDraft, setDcDraft] = useState<null | {
    title: string;
    description: string;
    countyFips?: string;
    stateCode?: string;
    tradeId?: string;
    budgetMin?: number;
    budgetMax?: number;
  }>(null);
  const [dcBusy, setDcBusy] = useState(false);
  const [savedScoutThreads, setSavedScoutThreads] = useState<SavedScoutThread[]>([]);
  const [activeSavedThreadId, setActiveSavedThreadId] = useState<string | null>(null);
  const [savedScoutSearch, setSavedScoutSearch] = useState("");
  const [savedScoutSurfaceFilter, setSavedScoutSurfaceFilter] =
    useState<SavedScoutSurfaceFilter>("all");
  const [scoutViewMode, setScoutViewMode] = useState<"chat_only" | "chat_plus_controller">(() => {
    try {
      if (typeof window === "undefined") return "chat_only";
      const raw = window.localStorage.getItem(SCOUT_VIEW_MODE_KEY);
      if (raw === "chat_only") return "chat_only";
      if (raw === "chat_plus_controller") return "chat_plus_controller";
      return "chat_only";
    } catch {
      return "chat_only";
    }
  });
  const autoRouteTimerRef = useRef<number | null>(null);
  const { sessionRole } = useSession();

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("ts-scout-active");
    return () => {
      document.body.classList.remove("ts-scout-active");
    };
  }, []);

  const {
    state,
    recordUserMessage,
    applyServerResponse,
    setError,
    setStatus,
    loadMessages,
    reset,
  } = useScoutController();

  // KPI: Track time-to-action from render to first action execution
  const renderStartRef = useRef<number | null>(null);
  const hasLoggedIntroRef = useRef<boolean>(false);
  const hasLoggedConfusionRef = useRef<boolean>(false);
  const trackedUrlIntentRef = useRef<string | null>(null);

  const cancelAutoRoute = useCallback(() => {
    cancelScheduledScoutAutoRoute(autoRouteTimerRef);
    setAutoRoutePending(null);
  }, []);

  const queueAutoRoute = useCallback(
    (candidate: { to: string; label: string; confidence: number; why?: string } | null) => {
      if (!candidate) return;
      cancelAutoRoute();
      setAutoRoutePending(candidate);

      if (!autoRouteEnabled) return;
      if (candidate.confidence < AUTO_ROUTE_MIN_CONFIDENCE) return;

      autoRouteTimerRef.current = window.setTimeout(() => {
        autoRouteTimerRef.current = null;
        setAutoRoutePending(null);
        navigate(candidate.to);
      }, AUTO_ROUTE_DELAY_MS);
    },
    [autoRouteEnabled, cancelAutoRoute, navigate]
  );

  // One-time init guard (keeps animations / welcome seed from re-running).
  // Removed client-side injected welcome message to avoid collision
  // with auto-typing demo. Scout should not speak until the user (or
  // auto demo) sends the first message.

  const locationCtx = useLocationContext();
  const countyCommitted = hasCountyContext(locationCtx);

  const locality: ScoutLocality = useMemo(() => {
    const countyName = countyCommitted
      ? locationCtx.countyName || (locationCtx as any).county
      : undefined;
    const stateCode = countyCommitted ? locationCtx.stateCode : undefined;

    return {
      county: countyName,
      countyName,
      countyFips: countyCommitted ? locationCtx.countyFips : undefined,
      state: stateCode,
      stateCode,
      // zip is still sourced from the user profile when present.
      zip: user?.zip,
      lat: locationCtx.lat,
      lng: locationCtx.lng,
    };
  }, [
    countyCommitted,
    (locationCtx as any).county,
    locationCtx.countyFips,
    locationCtx.countyName,
    locationCtx.stateCode,
    locationCtx.lat,
    locationCtx.lng,
    user?.zip,
  ]);

  const scoutSourceSignalsQuery = useQuery<ScoutSourceSignalSnapshot | null>({
    queryKey: [
      "/api/scout/home-snapshot",
      locality.county || "",
      locality.stateCode || "",
      locality.countyFips || "",
    ],
    enabled: Boolean(locality.county || locality.stateCode || locality.countyFips),
    staleTime: 60_000,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (locality.county) params.set("county", String(locality.county));
      if (locality.stateCode) params.set("state", String(locality.stateCode));
      if (locality.countyFips) params.set("fips", String(locality.countyFips));
      const response = await fetch(`/api/scout/home-snapshot?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) return null;
      const data = await response.json();
      return {
        countyName: data?.snapshot?.countyName,
        stateName: data?.snapshot?.stateName,
        activeListings: data?.snapshot?.activeListings,
        verifiedPros: data?.snapshot?.verifiedPros,
        eventsThisWeek: data?.snapshot?.eventsThisWeek,
        communityMembers: data?.snapshot?.communityMembers,
        priceSignals: Array.isArray(data?.priceSignals) ? data.priceSignals : [],
        opportunityMoves: Array.isArray(data?.opportunityMoves) ? data.opportunityMoves : [],
        trendingPrompts: Array.isArray(data?.trendingPrompts) ? data.trendingPrompts : [],
        recentActivity: Array.isArray(data?.recentActivity) ? data.recentActivity : [],
      };
    },
  });

  const hasMessages = state.messages.length > 0;
  const showThreadRegion =
    hasMessages ||
    state.status === "resolving_context" ||
    state.status === "checking_documents" ||
    state.status === "executing_action";
  const scoutSaveUserId =
    isAuthenticated && typeof user?.id === "string" && user.id.trim().length > 0 ? user.id : null;
  const remoteSavedScoutThreads = useMemo(
    () => normalizeSavedScoutThreads((user as any)?.preferences?.scout?.savedThreads),
    [user]
  );

  useEffect(() => {
    let cancelled = false;
    const localThreads = readSavedScoutThreads(scoutSaveUserId);
    const merged = mergeSavedScoutThreads(localThreads, remoteSavedScoutThreads);
    writeSavedScoutThreads(scoutSaveUserId, merged);
    setSavedScoutThreads(merged);

    if (!user) return;

    void fetch(savedConversationQueryUrl("", savedScoutSurfaceFilter), {
      method: "GET",
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        const serverThreads = normalizeSavedScoutThreads(data.conversations);
        const next = mergeSavedScoutThreads(serverThreads, readSavedScoutThreads(scoutSaveUserId));
        writeSavedScoutThreads(scoutSaveUserId, next);
        setSavedScoutThreads(next);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [remoteSavedScoutThreads, savedScoutSurfaceFilter, scoutSaveUserId, user]);

  useEffect(() => {
    if (!user) return;
    const query = savedScoutSearch.trim();
    if (query.length < 2) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetch(savedConversationQueryUrl(query, savedScoutSurfaceFilter), {
        method: "GET",
        credentials: "include",
      })
        .then(async (response) => {
          if (!response.ok) return null;
          return response.json();
        })
        .then((data) => {
          if (cancelled || !data) return;
          const serverThreads = normalizeSavedScoutThreads(data.conversations);
          const next = mergeSavedScoutThreads(
            serverThreads,
            readSavedScoutThreads(scoutSaveUserId)
          );
          writeSavedScoutThreads(scoutSaveUserId, next);
          setSavedScoutThreads(next);
        })
        .catch(() => undefined);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [savedScoutSearch, savedScoutSurfaceFilter, scoutSaveUserId, user]);

  const persistSavedScoutThreadRemote = useCallback(
    async (thread: SavedScoutThread) => {
      if (!user) return;
      try {
        const response = await fetch("/api/scout/conversations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: thread.id,
            title: thread.title,
            preview: thread.preview,
            summary: thread.summary,
            intent: thread.intent,
            countyFips: thread.countyFips || locationCtx.countyFips || undefined,
            stateCode: thread.stateCode || locationCtx.stateCode || undefined,
            messageCount: thread.messageCount,
            messages: thread.messages,
            metadata: {
              source: "scout_os",
              relatedLabel: thread.relatedLabel,
              relatedPath: thread.relatedPath,
              relatedTo: thread.relatedTo,
              searchText: thread.searchText,
            },
          }),
        });
        if (!response.ok) return;
        const data = await response.json();
        const saved = normalizeSavedScoutThreads([data?.conversation])[0];
        if (!saved) return;
        const next = mergeSavedScoutThreads([saved], readSavedScoutThreads(scoutSaveUserId));
        writeSavedScoutThreads(scoutSaveUserId, next);
        setSavedScoutThreads(next);
        setActiveSavedThreadId((current) => (current === thread.id ? saved.id : current));
      } catch {
        // Remote saves are best-effort; the local saved thread remains available.
      }
    },
    [locationCtx.countyFips, locationCtx.stateCode, scoutSaveUserId, user]
  );

  useEffect(() => {
    const hasUserThread = state.messages.some(
      (message) => message.role === "user" && message.content.trim().length > 0
    );
    if (!hasUserThread) return;

    const timer = window.setTimeout(() => {
      const saved = upsertSavedScoutThread(scoutSaveUserId, state.messages, activeSavedThreadId, {
        countyFips: locationCtx.countyFips,
        stateCode: locationCtx.stateCode,
      });
      if (!saved) return;
      setActiveSavedThreadId(saved.id);
      setSavedScoutThreads(readSavedScoutThreads(scoutSaveUserId));
      void persistSavedScoutThreadRemote(saved);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    activeSavedThreadId,
    locationCtx.countyFips,
    locationCtx.stateCode,
    persistSavedScoutThreadRemote,
    scoutSaveUserId,
    state.messages,
  ]);

  // Log a lightweight "intro_shown" event the first time the Scout surface
  // renders without any prior messages. Keep hasMessages above this effect to
  // avoid TDZ issues in production builds.
  useEffect(() => {
    if (!hasMessages && !hasLoggedIntroRef.current) {
      recordActivity({
        type: "intro_shown",
        ts: new Date().toISOString(),
        path: location,
        label: "scout_intro_hero",
      });
      hasLoggedIntroRef.current = true;
    }
  }, [hasMessages, location]);

  useEffect(() => {
    return () => {
      cancelAutoRoute();
    };
  }, [cancelAutoRoute]);

  const handleToggleAutoRoute = useCallback(
    (enabled: boolean) => {
      setAutoRouteEnabled(enabled);
      cancelAutoRoute();

      try {
        window.localStorage.setItem(AUTO_ROUTE_ENABLED_KEY, enabled ? "1" : "0");
      } catch {
        // ignore
      }

      // Best-effort persist for authed users (safe to ignore failures).
      if (user) {
        void fetch("/api/agent/preferences/scout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scout: { autoRouteEnabled: enabled } }),
        }).catch(() => undefined);
      }
    },
    [cancelAutoRoute, user]
  );

  const persistScoutResume = useCallback(
    async (delta: any) => {
      if (!user) return;
      try {
        await fetch("/api/agent/preferences/scout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scout: delta }),
        });
      } catch {
        // best-effort only
      }
    },
    [user]
  );

  const openWorkArea = useCallback(
    (opts: { url: string; title?: string }) => {
      const url = typeof opts.url === "string" ? opts.url.trim() : "";
      if (!url.startsWith("/")) return;

      setWorkAreaUrl(url);
      setWorkAreaTitle(typeof opts.title === "string" ? opts.title : null);
      setWorkAreaOpen(true);

      recordActivity({
        type: "open_work_area",
        ts: new Date().toISOString(),
        path: location,
        to: url,
        label: opts.title || "Page",
      } as any);
    },
    [location]
  );

  const maybeOpenWorkAreaForRoute = useCallback(
    (to: string | null | undefined, label?: string) => {
      const raw = typeof to === "string" ? to : "";
      if (!canOpenScoutWorkArea(raw)) return false;

      openWorkArea({ url: raw, title: label });
      return true;
    },
    [openWorkArea]
  );

  // Ephemeral, derived context roles per message/page for tone + defaults
  const getContextRoles = useCallback(
    (message: string): string[] => {
      const roles = inferContextRoles({
        message,
        pagePath: location,
        recentActions: state.lastActions.map((a) => a.type),
        inferredCapabilities: (user as any)?.capabilities ?? [],
      });
      return roles;
    },
    [location, state.lastActions, user]
  );

  const userRoles = (user as any)?.roles as string[] | undefined;
  const isGuest = !isAuthenticated;

  const isBusy =
    state.status === "resolving_context" ||
    state.status === "checking_documents" ||
    state.status === "executing_action";

  // Watchdog: force idle state if still busy past the normal API timeout window.
  // Keep this > client API timeout to avoid false triggers in slow-but-successful requests.
  useEffect(() => {
    if (!isBusy) return;

    const timeout = setTimeout(() => {
      console.warn("[ScoutOS] Watchdog triggered - forcing idle state after 28s");
      setStatus("idle");
    }, 28000);

    return () => clearTimeout(timeout);
  }, [isBusy, setStatus]);

  const hasUserMessages = useMemo(
    () => state.messages.some((m) => m.role === "user"),
    [state.messages]
  );
  const savedThreadMatches = useMemo(() => {
    const query = savedScoutSearch.trim().toLowerCase();
    return savedScoutThreads.filter((thread) => {
      if (
        savedScoutSurfaceFilter !== "all" &&
        savedThreadSurface(thread) !== savedScoutSurfaceFilter
      ) {
        return false;
      }
      if (!query) return true;
      const haystack = [
        thread.title,
        thread.preview,
        thread.summary,
        thread.relatedLabel,
        thread.relatedTo?.kind,
        thread.relatedTo?.id,
        thread.relatedTo?.label,
        thread.searchText,
        ...thread.messages.map((message) => message.content),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [savedScoutSearch, savedScoutSurfaceFilter, savedScoutThreads]);
  const savedThreadPreview = savedThreadMatches.slice(0, isMobile ? 2 : 3);

  const handleLoadSavedThread = useCallback(
    (thread: SavedScoutThread) => {
      setActiveSavedThreadId(thread.id);
      setHasGuestInteracted(true);
      loadMessages(thread.messages);
      recordActivity({
        type: "ask_scout",
        ts: new Date().toISOString(),
        path: location,
        label: "load_saved_scout_thread",
      });
    },
    [loadMessages, location]
  );

  const handleStartNewScoutThread = useCallback(() => {
    setActiveSavedThreadId(null);
    reset();
    setHasGuestInteracted(false);
    setOverridePendingScope(null);
    cancelAutoRoute();
  }, [cancelAutoRoute, reset]);

  const handleSaveScoutThreadNow = useCallback(() => {
    const saved = upsertSavedScoutThread(scoutSaveUserId, state.messages, activeSavedThreadId, {
      countyFips: locationCtx.countyFips,
      stateCode: locationCtx.stateCode,
    });
    if (!saved) return;
    setActiveSavedThreadId(saved.id);
    setSavedScoutThreads(readSavedScoutThreads(scoutSaveUserId));
    void persistSavedScoutThreadRemote(saved);
  }, [
    activeSavedThreadId,
    locationCtx.countyFips,
    locationCtx.stateCode,
    persistSavedScoutThreadRemote,
    scoutSaveUserId,
    state.messages,
  ]);

  const handleDeleteSavedThread = useCallback(
    (threadId: string) => {
      const next = removeSavedScoutThread(scoutSaveUserId, threadId);
      setSavedScoutThreads(next);

      if (activeSavedThreadId === threadId) {
        handleStartNewScoutThread();
      }

      if (user) {
        void fetch(`/api/scout/conversations/${encodeURIComponent(threadId)}`, {
          method: "DELETE",
          credentials: "include",
        }).catch(() => undefined);
      }
    },
    [activeSavedThreadId, handleStartNewScoutThread, scoutSaveUserId, user]
  );

  // First-time guest state: controls the calm intro + auto-demo gating.
  const isFirstGuestVisit = isGuest && !hasGuestInteracted && !hasUserMessages;

  const latestTurnActionTruth = useMemo(() => {
    return resolveLatestScoutTurnActionTruth({
      messages: state.messages,
      lastActions: state.lastActions,
      status: state.status,
    });
  }, [state.lastActions, state.messages, state.status]);

  const latestUserQuery = useMemo(() => {
    for (let i = state.messages.length - 1; i >= 0; i -= 1) {
      const msg = state.messages[i];
      if (msg?.role === "user") return msg.content;
    }
    return "";
  }, [state.messages]);

  const activeSavedThread = useMemo(
    () =>
      activeSavedThreadId
        ? savedScoutThreads.find((thread) => thread.id === activeSavedThreadId) || null
        : null,
    [activeSavedThreadId, savedScoutThreads]
  );
  const currentTaskTitle = useMemo(() => {
    const firstUserMessage = firstThreadUserMessage(state.messages);
    return (
      activeSavedThread?.title ||
      summarizeThreadText(firstUserMessage?.content || latestUserQuery, "Current Scout task")
    );
  }, [activeSavedThread?.title, latestUserQuery, state.messages]);
  const currentTaskState = useMemo(() => {
    if (state.status === "resolving_context") return "Understanding what you need.";
    if (state.status === "checking_documents") return "Checking the useful local details.";
    if (state.status === "executing_action") return "Completing the step you chose.";
    if (state.status === "error") return "That step needs another try.";

    const latestAssistant = [...state.messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.content.trim().length > 0);
    return summarizeThreadText(
      latestAssistant?.content || latestUserQuery,
      "Add the next detail below."
    );
  }, [latestUserQuery, state.messages, state.status]);
  const primaryNextAction = latestTurnActionTruth.dominantAction;

  const setViewMode = useCallback((nextMode: "chat_only" | "chat_plus_controller") => {
    setScoutViewMode(nextMode);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SCOUT_VIEW_MODE_KEY, nextMode);
      }
    } catch {
      // ignore persistence errors
    }
  }, []);

  // Keep the Scout surface feeling like a modern chat: shortcuts are available,
  // but they shouldn't crowd the thread once a conversation has started.
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useEffect(() => {
    if (hasUserMessages) {
      setShortcutsOpen(false);
    }
  }, [hasUserMessages]);

  const refreshObjective = useCallback(async () => {
    if (!OBJECTIVES_ENABLED || !isAuthenticated) {
      setActiveObjective(null);
      return;
    }

    try {
      const res = await fetch("/api/objectives/active", {
        credentials: "include",
      });
      if (!res.ok) {
        setActiveObjective(null);
        return;
      }

      const payload = (await res.json()) as { objective?: Objective | null };
      setActiveObjective(payload?.objective ?? null);
    } catch {
      setActiveObjective(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshObjective();
  }, [refreshObjective]);

  const updateObjective = useCallback(
    async (patch: Partial<Pick<Objective, "title" | "status">>) => {
      if (!OBJECTIVES_ENABLED || !activeObjective?.id) return;
      setObjectiveBusy(true);
      try {
        await fetch(`/api/objectives/${encodeURIComponent(String(activeObjective.id))}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
      } finally {
        await refreshObjective();
        setObjectiveBusy(false);
      }
    },
    [activeObjective?.id, refreshObjective]
  );

  const deleteObjective = useCallback(async () => {
    if (!OBJECTIVES_ENABLED || !activeObjective?.id) return;
    setObjectiveBusy(true);
    try {
      await fetch(`/api/objectives/${encodeURIComponent(String(activeObjective.id))}`, {
        method: "DELETE",
        credentials: "include",
      });
    } finally {
      await refreshObjective();
      setObjectiveBusy(false);
    }
  }, [activeObjective?.id, refreshObjective]);

  // Scout opens on the live snapshot. Nothing is submitted until the user
  // searches, follows an explicit handoff, or opens a destination.
  const shouldPlayIntroDemo = false;

  const urlIntent = scoutLaunch.context?.intent;

  useEffect(() => {
    if (!urlIntent) return;

    try {
      const search = typeof window === "undefined" ? "" : window.location.search;
      const params = new URLSearchParams(search);
      const source = scoutLaunch.context?.source;
      const prompt = scoutLaunch.prompt;
      const signature = [
        urlIntent,
        source || "",
        prompt ? "prompt" : "",
        params.get("ref") || "",
        params.get("utm_campaign") || "",
      ].join("|");

      if (trackedUrlIntentRef.current === signature) return;
      trackedUrlIntentRef.current = signature;

      void trackDemandEvent("intent_submitted", {
        intent: urlIntent,
        source: source || undefined,
        hasPrompt: Boolean(prompt),
      });
    } catch {
      // fail-soft: analytics must never impact scout flow
    }
  }, [location, scoutLaunch.context?.source, scoutLaunch.prompt, urlIntent]);

  // PHASE 3d-A: Scout Onboarding Flow with Claim Inference
  const onboarding = useScoutOnboarding();

  // PHASE 3d-B: Scout Mode State Machine (onboarding -> post_onboarding -> freeform)
  const provisional = (user as any)?.preferences?.provisional;
  const profileDraft: ProfileDraft | undefined = provisional?.profileDraft;
  const { data: ownedProfiles = [] } = useQuery<
    Array<{ id: string; slug?: string | null; status?: string | null }>
  >({
    queryKey: ["/api/profiles"],
    enabled: Boolean(isAuthenticated && (user as any)?.id),
    queryFn: async () => {
      const profiles = await apiRequest("GET", "/api/profiles");
      return Array.isArray(profiles) ? profiles : [];
    },
    staleTime: 30_000,
  });
  const activeProfileId = String((user as any)?.activeProfileId || "").trim();
  const canonicalOwnedProfile =
    ownedProfiles.find((profile) => activeProfileId && String(profile.id) === activeProfileId) ||
    ownedProfiles.find((profile) => profile.status === "published" && profile.slug) ||
    ownedProfiles.find((profile) => profile.slug);
  const scoutModeHook = useScoutMode({
    userId: (user as any)?.id,
    profileDraftComplete: !!(profileDraft?.countyFips && profileDraft?.presenceType),
    profileDraftPublished: !!(profileDraft?.countyFips && profileDraft?.presenceType), // Will expand as business profile is saved
    claimsConfirmed:
      !!(user as any)?.confirmedClaims &&
      Array.isArray((user as any)?.confirmedClaims) &&
      (user as any).confirmedClaims.length > 0,
    confirmedClaims: Array.isArray((user as any)?.confirmedClaims)
      ? (user as any).confirmedClaims
      : [],
    publishedProfileSlug: canonicalOwnedProfile?.slug || undefined,
  });

  // A lingering Scout query can only enter the universal onboarding owner.
  useEffect(() => {
    if (!isAuthenticated) return;

    try {
      const params = new URLSearchParams(location.split("?")[1] || "");
      if (params.get("onboarding") === "true" && (user as any)?.onboardingCompleted !== true) {
        const next = encodeURIComponent("/scout");
        navigate(`/onboarding?next=${next}&source=scout_query_onboarding`);
      }
    } catch {
      // Ignore malformed URLs; do not block navigation.
    }
  }, [isAuthenticated, location, navigate, user]);

  // Keep an explicit classic-to-Scout handoff as a user-reviewed draft.
  useEffect(() => {
    if (!scoutLaunch.prompt) return;
    if (appliedLaunchPromptRef.current === scoutLaunch.signature) return;

    appliedLaunchPromptRef.current = scoutLaunch.signature;
    try {
      window.localStorage.setItem("scout:prefill:scout-main", scoutLaunch.prompt);
    } catch {
      // fail-soft: the visible context still survives without local storage
    }
    setHasGuestInteracted(true);
    setPrefillKey((key) => key + 1);
  }, [scoutLaunch.prompt, scoutLaunch.signature]);

  // Remove only the one-time prompt after it becomes a real user message.
  // The structured launch context stays in the URL for the rest of the conversation.
  useEffect(() => {
    if (!scoutLaunch.prompt || !hasUserMessages) return;
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    params.delete("prompt");
    const nextLocation = params.toString() ? `/scout?${params.toString()}` : "/scout";
    navigate(nextLocation, { replace: true });
    setScoutBrowserLocation(nextLocation);
  }, [hasUserMessages, location, navigate, scoutLaunch.prompt]);

  // Clear stale drafts on a plain first guest visit, but never erase an explicit handoff.
  useEffect(() => {
    if (isFirstGuestVisit && !hasExplicitScoutLaunch && !appliedLaunchPromptRef.current) {
      try {
        window.localStorage.removeItem("scout:prefill:scout-main");
      } catch {
        // ignore storage errors
      }
      setPrefillKey((k) => k + 1);
    }
  }, [hasExplicitScoutLaunch, isFirstGuestVisit]);

  const hasAdminAccess = hasAdminUiAccess(user);
  const showEvolutionSurfaces = SCOUT_EVOLUTION_SURFACES_ENABLED && hasAdminAccess;

  // We no longer surface the separate "Trending" tab at the bottom; all
  // focus stays on the main Scout thread and input.

  const handleSend = useCallback(
    async (value: string, explicitMode?: ScoutMode, _opts?: { isScriptedIntro?: boolean }) => {
      if (containsProfanity(value)) {
        const blocked: ScoutMessage = {
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: "assistant",
          content: "That prompt isn't allowed. Please keep it respectful.",
          timestamp: new Date().toISOString(),
        };

        // Keep a censored draft in the input so the user can quickly edit.
        try {
          window.localStorage.setItem("scout:prefill:scout-main", censorProfanity(value));
        } catch {
          // ignore
        }
        setPrefillKey((k) => k + 1);
        applyServerResponse(blocked, []);
        return;
      }

      const rolesForRequest =
        (userRoles && userRoles.length > 0
          ? userRoles
          : sessionRole
            ? [sessionRole]
            : isGuest
              ? ["just-browsing"]
              : undefined) ?? undefined;

      // Context-aware roles: derive ephemeral roles based on message/page/signals
      const contextRoles = getContextRoles(value);
      const mode: ScoutMode = explicitMode ?? "default";
      setActiveMode(mode);

      const start = performance.now();
      const isScriptedIntro = _opts?.isScriptedIntro === true;

      // User message is recorded into the thread; we immediately move into
      // a short RESOLVING_CONTEXT state so the UI can show progress without
      // exposing any internal reasoning text.
      if (isScriptedIntro) {
        setStatus("resolving_context");
        recordActivity({
          type: "intro_shown",
          ts: new Date().toISOString(),
          path: location,
          label: "profile_context_seed",
        });
      } else {
        recordUserMessage(value);
        // recordUserMessage already moves state into "resolving_context";
        // avoid a redundant status dispatch here.
        recordActivity({
          type: "ask_scout",
          ts: new Date().toISOString(),
          path: location,
          label: value.slice(0, 160),
        });
      }

      // If a county explanation was recently shown, treat this as a
      // potential follow-up signal when it happens within the
      // five-minute window. This does not affect behavior.
      if (!isScriptedIntro) {
        tryRecordCountyExplanationFollowup("scout_message", location);
      }

      try {
        // Telemetry may observe the raw request, but it never changes routing.
        // The server-owned Scout orchestrator is the only intent authority.
        const lowerMsg = value.toLowerCase();
        const normalized = lowerMsg.replace(/[^a-z0-9\s]/gi, " ");
        if (value.trim().toLowerCase() === LIVE_READINESS_QUICK_START_PROMPT.toLowerCase()) {
          void trackShellEvent({
            type: "scout_query",
            payload: {
              event: "scout_live_readiness_prompt_submitted",
              source: "quick_start_or_exact_prompt",
              path: location,
              ts: new Date().toISOString(),
            },
          });
        }

        if (!hasLoggedConfusionRef.current) {
          const looksConfused =
            /why[^\n]*\b(see|locked|show)\b/.test(normalized) ||
            /\b(can't|cant|cannot)\b[^\n]*\bsee\b/.test(normalized);

          if (looksConfused) {
            recordActivity({
              type: "scout_confusion_location",
              ts: new Date().toISOString(),
              path: location,
              label: value.slice(0, 160),
              meta: { normalized: "why_cant_i_see" },
            });
            hasLoggedConfusionRef.current = true;
          }
        }

        // The request now crosses the one server-owned result boundary.
        setStatus("checking_documents");
        const recentActivity = getRecentActivity();
        const shownAdIds = getSeenAdIds();

        const res = await sendToScout({
          history: state.messages.map((m) => ({ role: m.role, content: m.content })),
          message: value,
          locality,
          mode,
          intent: urlIntent,
          launchContext: scoutLaunch.context || undefined,
          knowledgeMode: "local-first",
          filters: {
            collectionSurface: "scout-summary-thread",
          },
          roles: rolesForRequest,
          recentActivity,
          shownAdIds,
        });

        // The frontend renders the returned contract without reinterpreting it.
        setStatus("ready");

        const contractActions = dedupeScoutActions(
          res.allowed_actions.flatMap((action) => {
            const validated = scoutAllowedActionToAction(action);
            return validated ? [validated] : [];
          })
        );

        const resolvedContent = sanitizeScoutMessage(res.answer || res.message);

        const provenance: NonNullable<ScoutMessage["provenance"]> = buildScoutProvenance(res) || {};
        const primaryNavigation = contractActions.find(
          (action) =>
            action.type === "NAVIGATE" &&
            (typeof action.to === "string" || typeof action.path === "string")
        );

        const msg: ScoutMessage = {
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: "assistant",
          content: resolvedContent,
          timestamp: res.timestamp || new Date().toISOString(),
          contextRoles: getContextRoles(value),
          navTarget:
            (primaryNavigation?.to as string) || (primaryNavigation?.path as string) || undefined,
          provenance,
          resultContract: {
            contract_version: res.contract_version,
            intent: res.intent,
            ambiguity_options: res.ambiguity_options,
            entities: res.entities,
            evidence: res.evidence,
            answer: res.answer,
            allowed_actions: res.allowed_actions,
            working_memory_update: res.working_memory_update,
          },
        };

        applyServerResponse(msg, contractActions);

        // Persist a lightweight "resume" snapshot so other surfaces can offer a
        // single-click local-summary resume affordance without the user having to
        // hunt for the last thread.
        if (user) {
          const suggestedTo =
            (primaryNavigation?.to as string) ||
            (primaryNavigation?.path as string) ||
            msg.navTarget ||
            null;
          const suggestedLabel =
            (primaryNavigation?.label as string) || (suggestedTo ? "Continue" : "Open search");

          void persistScoutResume({
            resume: {
              prompt: value,
              intent: res.intent,
              suggestedTo,
              suggestedLabel,
              mode,
              locality: {
                county: locality?.county,
                state: locality?.state,
                zip: locality?.zip,
              },
              updatedAt: new Date().toISOString(),
              knowledgeLayer: res.knowledge?.layer,
            },
          });
        }

        if (!hasSeenFirstAnswer()) {
          markFirstAnswerSeen();
        }

        // NOTE: do not auto-execute server actions; show them as chips instead.

        const latencyMs = performance.now() - start;
        logScoutInsight({
          message: value,
          mode,
          locality,
          success: true,
          latencyMs,
        });
      } catch (err: any) {
        const latencyMs = performance.now() - start;
        const fallback: ScoutMessage = {
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: "assistant",
          content: formatUserFacingErrorMessage(
            err,
            "Scout could not complete this request. Nothing was sent or changed. Please try again."
          ),
          timestamp: new Date().toISOString(),
        };
        applyServerResponse(fallback, []);
        logScoutInsight({
          message: value,
          mode,
          locality,
          success: false,
          latencyMs,
          error: err.message || "Unknown error",
        });
      } finally {
        await refreshObjective();
        setStatus("idle");
      }
    },
    [
      applyServerResponse,
      isGuest,
      persistScoutResume,
      locality,
      location,
      recordUserMessage,
      sessionRole,
      setPrefillKey,
      scoutLaunch.context,
      state.messages,
      refreshObjective,
      user,
      userRoles,
    ]
  );

  /**
   * Handle onboarding answer/skip via unified sendMessage pattern
   * Server controls everything; client just sends payload
   */
  const handleOnboardingMessage = useCallback(
    async (payload: {
      onboardingAnswer: {
        sessionId: string;
        questionKey: string;
        value?: string;
        skipped?: boolean;
      };
    }) => {
      try {
        const rolesForRequest =
          (userRoles && userRoles.length > 0
            ? userRoles
            : sessionRole
              ? [sessionRole]
              : isGuest
                ? ["just-browsing"]
                : undefined) ?? undefined;

        setStatus("checking_documents");
        const recentActivity = getRecentActivity();
        const shownAdIds = getSeenAdIds();

        const { sessionId, questionKey, value, skipped } = payload.onboardingAnswer;

        const res = await sendToScout({
          history: state.messages.map((m) => ({ role: m.role, content: m.content })),
          message: skipped ? "skip" : value || "",
          locality,
          mode: "general" as any,
          roles: rolesForRequest,
          recentActivity,
          shownAdIds,
          sessionId,
          onboardingAnswer: skipped ? "skip" : value,
          onboardingQuestionKey: questionKey as "Q1" | "Q2" | "Q3" | "Q4",
        });

        setStatus("ready");

        // Record user interaction (for history)
        if (!skipped && value) {
          recordUserMessage(value);
        }

        // Apply server response (includes next question or expiration)
        const msg: ScoutMessage = {
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: "assistant",
          content: res.message,
          timestamp: res.timestamp || new Date().toISOString(),
          suggestedActions: res.suggestedActions,
          onboarding: (res as any).onboarding,
          contextRoles: [],
        };

        applyServerResponse(msg, res.actions || []);

        recordActivity({
          type: skipped ? "onboarding_skip" : "onboarding_answer",
          ts: new Date().toISOString(),
          path: location,
          label: skipped ? `Skipped ${questionKey}` : `${questionKey}: ${value}`,
          meta: { sessionId },
        });
      } catch (err: any) {
        setError(formatUserFacingErrorMessage(err, "Failed to process onboarding"));
        console.error("[Onboarding Error]", err);
      } finally {
        await refreshObjective();
        setStatus("idle");
      }
    },
    [
      userRoles,
      sessionRole,
      isGuest,
      state.messages,
      locality,
      location,
      applyServerResponse,
      recordUserMessage,
      refreshObjective,
      setStatus,
      setError,
      recordActivity,
    ]
  );

  const loadObjectiveOnboardingBundle = useCallback(async () => {
    if (!showEvolutionSurfaces) {
      setObjectiveOnboardingBundle(null);
      return;
    }

    try {
      const objectiveStates = activeObjective
        ? [
            {
              objectiveId: activeObjective.id,
              status: objectiveStatusToOnboardingStatus(activeObjective.status),
              completionPct: objectiveStatusToProgress(activeObjective.status),
              updatedAt: activeObjective.updatedAt,
            },
          ]
        : [];

      const response = await fetch("/api/scout/onboarding/objective-bundle", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: (user as any)?.role ?? sessionRole ?? undefined,
          countyFips: (user as any)?.countyFips ?? (user as any)?.county_fips ?? undefined,
          stateCode: (user as any)?.stateCode ?? (user as any)?.state_code ?? undefined,
          objectiveStates,
        }),
      });

      if (!response.ok) {
        setObjectiveOnboardingBundle(null);
        return;
      }

      const payload = await response.json();
      setObjectiveOnboardingBundle(payload);
    } catch {
      setObjectiveOnboardingBundle(null);
    }
  }, [activeObjective, sessionRole, showEvolutionSurfaces, user]);

  useEffect(() => {
    void loadObjectiveOnboardingBundle();
  }, [loadObjectiveOnboardingBundle]);

  const loadWatchdogResult = useCallback(async () => {
    if (!showEvolutionSurfaces) {
      setWatchdogResult(null);
      return;
    }

    try {
      const snapshot = {
        userId: typeof (user as any)?.id === "string" ? String((user as any).id) : "guest",
        role: (user as any)?.role ?? sessionRole ?? undefined,
        countyFips: (user as any)?.countyFips ?? (user as any)?.county_fips ?? undefined,
        lastActiveAt: new Date().toISOString(),
        objectives: activeObjective
          ? [
              {
                id: activeObjective.id,
                title: activeObjective.title,
                intentClass: activeObjective.intentClass,
                status: activeObjective.status,
                completionPct:
                  activeObjective.status === "completed"
                    ? 100
                    : activeObjective.status === "paused"
                      ? 20
                      : 45,
                updatedAt: activeObjective.updatedAt,
                route: "/scout",
              },
            ]
          : [],
        events: state.messages.slice(-8).map((message) => ({
          type: message.role === "user" ? "message_sent" : "action_executed",
          occurredAt: message.timestamp,
        })),
      };

      const response = await fetch("/api/scout/watchdog/evaluate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });

      if (!response.ok) {
        setWatchdogResult(null);
        return;
      }

      const payload = await response.json();
      setWatchdogResult(payload);
    } catch {
      setWatchdogResult(null);
    }
  }, [activeObjective, sessionRole, showEvolutionSurfaces, state.messages, user]);

  useEffect(() => {
    void loadWatchdogResult();
  }, [loadWatchdogResult]);

  const visibleWatchdogInterventions = useMemo(() => {
    const all = Array.isArray(watchdogResult?.interventions) ? watchdogResult.interventions : [];
    if (!dismissedWatchdogId) return all;
    return all.filter((item: any) => String(item?.id || "") !== dismissedWatchdogId);
  }, [dismissedWatchdogId, watchdogResult?.interventions]);

  const handleOpenObjectiveRoute = useCallback(
    (route: string) => {
      recordActivity({
        type: "navigate",
        ts: new Date().toISOString(),
        path: location,
        to: route,
        label: "objective_onboarding",
      });
      if (!maybeOpenWorkAreaForRoute(route, "Objective path")) {
        navigate(route);
      }
    },
    [location, maybeOpenWorkAreaForRoute, navigate]
  );

  const handleStartObjectiveSuggestion = useCallback(
    (objectiveId: string, starterPrompt: string) => {
      setHasGuestInteracted(true);
      recordActivity({
        type: "ask_scout",
        ts: new Date().toISOString(),
        path: location,
        label: objectiveId,
      });
      void handleSend(starterPrompt);
    },
    [handleSend, location]
  );

  // Outcome onboarding is the one launch source that represents an already
  // confirmed request. Consume it immediately so a non-business user lands on
  // the result they asked for instead of another form or a prefilled draft.
  // The signature guard makes refreshes and React re-renders idempotent.
  useEffect(() => {
    if (scoutLaunch.context?.source !== "onboarding_result") return;
    const confirmedPrompt = scoutLaunch.prompt || onboardingOutcomePrompt;
    if (!confirmedPrompt) return;
    const outcomeSignature = `${scoutLaunch.signature}:${confirmedPrompt}`;
    if (consumedOutcomeLaunchRef.current === outcomeSignature) return;
    if (state.messages.some((message) => message.role === "user")) return;
    if (shouldPlayIntroDemo) return;

    consumedOutcomeLaunchRef.current = outcomeSignature;
    clearOnboardingResultPrompt();
    try {
      window.localStorage.removeItem("scout:prefill:scout-main");
    } catch {
      // fail-soft: the confirmed launch still submits without local storage
    }
    setPrefillKey((key) => key + 1);
    setHasGuestInteracted(true);
    void handleSend(confirmedPrompt);
  }, [
    handleSend,
    onboardingOutcomePrompt,
    scoutLaunch.context?.source,
    scoutLaunch.prompt,
    scoutLaunch.signature,
    shouldPlayIntroDemo,
    state.messages,
  ]);

  const handleCompleteFastWin = useCallback(
    async (objectiveId: string) => {
      if (activeObjective?.id && activeObjective.id === objectiveId) {
        await updateObjective({ status: "completed" });
      } else {
        await refreshObjective();
      }
      setDismissedWatchdogId(null);
      await loadWatchdogResult();
      await loadObjectiveOnboardingBundle();
    },
    [
      activeObjective?.id,
      loadObjectiveOnboardingBundle,
      loadWatchdogResult,
      refreshObjective,
      updateObjective,
    ]
  );

  // Auto-consume one-time onboarding marker set by post-signup/dashboard flows.
  // If present on first clean /scout load (no prior user messages and no intro
  // demo), send the onboarding token directly so the intent detector routes
  // into the "What are you here to do today?" chooser without requiring a
  // manual keypress. Marker is cleared immediately so this is strictly
  // one-time unless explicitly re-set.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!location.startsWith("/scout")) return;

    const hasUserMsgs = state.messages.some((m) => m.role === "user");
    if (hasUserMsgs) return;
    if (shouldPlayIntroDemo) return;

    try {
      const marker = window.localStorage.getItem("scout:prefill:scout-main");
      if (marker === "__SCOUT_ONBOARDING__") {
        window.localStorage.removeItem("scout:prefill:scout-main");
        setPrefillKey((k) => k + 1);
        void handleSend("__SCOUT_ONBOARDING__");
      }
    } catch {
      // ignore storage errors
    }
  }, [location, state.messages, shouldPlayIntroDemo, handleSend, setPrefillKey]);

  const handleClusterAction = useCallback(
    async (action: ScoutAction) => {
      const learningSnapshot = persistScoutLearningSignalLocally(action, user);
      if (learningSnapshot) {
        recordActivity({
          type: "scout_learning_signal",
          ts: new Date().toISOString(),
          path: location,
          label: String(action.label || "Scout learning signal"),
          meta: {
            actionType: action.type,
            signal: action.payload?.scoutLearning,
          },
        });
        void persistScoutResume({ learning: learningSnapshot });
      }

      if (action.type === "NAVIGATE") {
        const target = (action.to ?? action.path) as string | undefined;
        if (maybeOpenWorkAreaForRoute(target, action.label)) {
          return;
        }

        const ttaMs = renderStartRef.current ? Date.now() - renderStartRef.current : undefined;
        recordActivity({
          type: "navigate",
          ts: new Date().toISOString(),
          path: location,
          to: action.to ?? action.path,
          label: action.label,
          meta: {
            ...(typeof action.payload?.jobId === "string"
              ? { jobId: action.payload.jobId as string }
              : {}),
            ttaMs,
            source: "cluster_action",
          },
        });
        renderStartRef.current = null;
      }

      if (action.type === "NOOP") {
        return;
      }

      // While executing a tool or navigation action, briefly move into
      // EXECUTING_ACTION so the loader reflects real work instead of
      // fake "typing".
      setStatus("executing_action");

      try {
        await executeScoutActions([action], {
          navigate: (to) => {
            if (!maybeOpenWorkAreaForRoute(to)) {
              navigate(to);
            }
          },
          openAppDrawer: () => setToolsOpen(true),
          openToolsDrawer: () => setToolsOpen(true),
          prefillInput: (text) => {
            try {
              window.localStorage.setItem("scout:prefill:scout-main", text);
            } catch {
              // ignore
            }
            setPrefillKey((k) => k + 1);
          },
          askScout: (prompt) => {
            void handleSend(prompt);
          },
          confirmAction: async (action) => {
            const label = action.label || action.type.replace(/_/g, " ").toLowerCase();
            return window.confirm(
              `Approve this Scout action?\n\n${label}\n\nScout will not send, publish, contact, or change anything unless you approve. Payments always open a payment page for you to complete yourself.`
            );
          },
          isAuthenticated,
          userRole: typeof (user as any)?.role === "string" ? String((user as any).role) : null,
        });

        if (action.type === "SAVE_PROFILE") {
          const ack: ScoutMessage = {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            role: "assistant",
            content: "Saved. Your profile has been updated.",
            timestamp: new Date().toISOString(),
          };
          applyServerResponse(ack, []);
        }
      } catch (err: any) {
        setError(formatUserFacingErrorMessage(err, "Action failed to execute."));
      } finally {
        setStatus("idle");
      }
    },
    [
      location,
      maybeOpenWorkAreaForRoute,
      navigate,
      handleSend,
      setError,
      applyServerResponse,
      persistScoutResume,
      user,
    ]
  );

  const handleOverride = useCallback(
    async (option: NonNullable<ScoutMessage["overrideOption"]>) => {
      const scope = option.scope ?? "global";
      if (overridePendingScope === scope) return;

      setOverridePendingScope(scope);
      try {
        const res = await fetch(`${apiBase}/scout/override`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope,
            contextType: option.contextType ?? "general",
            contextId: option.contextId ?? null,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Override HTTP ${res.status}`);
        }

        const ack: ScoutMessage = {
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: "assistant",
          content:
            "Understood. I'll proceed and record that you chose to continue so Scout can learn from this scope.",
          timestamp: new Date().toISOString(),
        };
        applyServerResponse(ack, []);
      } catch (err: any) {
        setError(formatUserFacingErrorMessage(err, "Failed to record override"));
      } finally {
        setOverridePendingScope(null);
      }
    },
    [applyServerResponse, overridePendingScope, setError]
  );

  // Auto-consume Help Center intents: when arriving from Help, send the
  // stored prompt into Scout immediately so the user sees a guided flow
  // instead of a blank chat box.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!location.startsWith("/scout")) return;

    const hasUserMsgs = state.messages.some((m) => m.role === "user");
    if (hasUserMsgs) return;
    // If the intro demo will run, do not auto-send the help intent here
    if (shouldPlayIntroDemo) return;

    try {
      const raw = window.localStorage.getItem("scout:help-intent");
      if (!raw) return;

      const parsed = JSON.parse(raw) as { prompt?: string } | null;
      if (!parsed || typeof parsed.prompt !== "string" || !parsed.prompt.trim()) {
        window.localStorage.removeItem("scout:help-intent");
        return;
      }

      // Clear any stored prefill so the input is blank when the
      // help-center intent is auto-sent.
      try {
        window.localStorage.removeItem("scout:prefill:scout-main");
      } catch {
        // ignore
      }
      setPrefillKey((k) => k + 1);

      window.localStorage.removeItem("scout:help-intent");
      setHasGuestInteracted(true);
      void handleSend(parsed.prompt);
    } catch {
      // ignore storage/JSON errors
    }
  }, [location, state.messages, handleSend, setPrefillKey, shouldPlayIntroDemo]);

  const heroLocationLabel = formatCityOnly({ label: locationCtx.label });

  // Fetch saved contractors for tile context (deterministic personalization)
  const { data: savedContractorsData } = useQuery<
    Array<{ id: string; name: string; category?: string | null }>
  >({
    queryKey: ["/api/saved-contractors"],
    queryFn: () => apiRequest("GET", "/api/saved-contractors"),
    // Only fetch if user is logged in
    enabled: !!user && countyCommitted,
    // Cache for 5 minutes (tiles don't need real-time updates)
    staleTime: 5 * 60 * 1000,
  });

  // Fetch dashboard data to derive active projects (deterministic personalization)
  const { data: dashboardData } = useQuery<{
    myProjects?: Array<{
      id: string;
      title: string;
      contractorName?: string | null;
      updatedAt?: string | Date | null;
    }>;
  }>({
    queryKey: ["/api/dashboard", user?.id],
    queryFn: () => apiRequest("GET", "/api/dashboard"),
    enabled: !!user?.id && countyCommitted,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch invoices for tile context (deterministic personalization)
  const { data: invoicesData } = useQuery<
    Array<{
      id: string;
      jobName?: string | null;
      status: string;
      updatedAt?: string | Date | null;
      amount?: number | null;
    }>
  >({
    queryKey: ["/api/invoices", user?.id],
    queryFn: () => apiRequest("GET", "/api/invoices"),
    // Only fetch if user is logged in
    enabled: !!user?.id && countyCommitted,
    // Cache for 5 minutes (tiles don't need real-time updates)
    staleTime: 5 * 60 * 1000,
  });

  const { data: homesData } = useQuery<{
    homes?: Array<{
      id: string;
      nickname?: string | null;
      address?: string | null;
      city?: string | null;
      stateCode?: string | null;
      updatedAt?: string | Date | null;
    }>;
  }>({
    queryKey: ["/api/homes", user?.id],
    queryFn: () => apiRequest("GET", "/api/homes"),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const primaryHomeId = useMemo(() => {
    const homes = Array.isArray(homesData?.homes) ? homesData.homes : [];
    if (homes.length === 0) return "";
    const sorted = [...homes].sort((a, b) => {
      const aTime = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
    return String(sorted[0]?.id || "").trim();
  }, [homesData]);

  const { data: homeIdRailPersistence } = useQuery<any>({
    queryKey: ["/api/homeid/persistence", primaryHomeId, user?.id],
    queryFn: () =>
      apiRequest("GET", `/api/homeid/${encodeURIComponent(primaryHomeId)}/persistence`),
    enabled: !!user?.id && !!primaryHomeId,
    staleTime: 60 * 1000,
  });

  const { data: homeIdRailDashboard } = useQuery<ScoutHomeIdDashboardResponse>({
    queryKey: ["/api/homes/homeid-dashboard", primaryHomeId, user?.id],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/homes/${encodeURIComponent(primaryHomeId)}/homeid-dashboard?persona=homeowner`
      ),
    enabled: !!user?.id && !!primaryHomeId,
    staleTime: 60 * 1000,
  });

  const homeIdContextRail = useMemo(() => {
    const homes = Array.isArray(homesData?.homes) ? homesData.homes : [];
    if (!primaryHomeId) {
      return {
        hasHomeId: false,
        homeId: "",
        homeLabel: "",
        completionScore: 0,
        knownPropertyDetailCount: 0,
        componentCount: 0,
        evidenceCount: 0,
        openRequestPacketCount: 0,
        missingCriticalInfoCount: 0,
        recentActivity: [] as Array<{ id: string; title: string; createdAt: string }>,
        propertyDetails: [] as Array<Record<string, unknown>>,
        components: [] as Array<Record<string, unknown>>,
        evidence: [] as Array<Record<string, unknown>>,
        requestPackets: [] as Array<Record<string, unknown>>,
        localTrendingPrompts: [] as Array<Record<string, unknown>>,
      };
    }

    const activeHome =
      homes.find((home) => String(home.id) === primaryHomeId) ||
      homes.find((home) => String(home.id || "").trim() === primaryHomeId);
    const homeLabel =
      (activeHome?.nickname && String(activeHome.nickname).trim()) ||
      [activeHome?.city, activeHome?.stateCode].filter(Boolean).join(", ") ||
      "Your HomeID";

    const persistence = asObject(homeIdRailPersistence?.persistence);
    const propertyDetails = asArray(persistence?.propertyDetails);
    const requestPackets = asArray(persistence?.requestPackets);
    const components = asArray(persistence?.components);
    const evidence = asArray(persistence?.evidence);

    const knownPropertyDetailCount = propertyDetails.filter((entry) => {
      const row = asObject(entry);
      return String(row?.status || "").trim() === "known";
    }).length;
    const openRequestPacketCount = requestPackets.filter((entry) => {
      const row = asObject(entry);
      const status = String(row?.status || "").trim();
      return status === "draft" || status === "needs_info";
    }).length;
    const missingHints = asArray(homeIdRailDashboard?.requestPrompts);
    const recentEvents = asArray(homeIdRailDashboard?.overview?.recentEvents)
      .map((entry) => {
        const row = asObject(entry);
        const id = String(row?.id || "").trim();
        const title = String(row?.title || "").trim();
        const createdAt = String(row?.createdAt || "").trim();
        if (!title) return null;
        return {
          id: id || `recent_${title}_${createdAt}`.slice(0, 80),
          title,
          createdAt,
        };
      })
      .filter(Boolean)
      .slice(0, 3) as Array<{ id: string; title: string; createdAt: string }>;

    return {
      hasHomeId: true,
      homeId: primaryHomeId,
      homeLabel,
      completionScore: Number(homeIdRailDashboard?.completionScore || 0),
      knownPropertyDetailCount,
      componentCount: components.length,
      evidenceCount: evidence.length,
      openRequestPacketCount,
      missingCriticalInfoCount: missingHints.length,
      recentActivity: recentEvents,
      propertyDetails: propertyDetails.map((entry) => asObject(entry)).filter(Boolean) as Array<
        Record<string, unknown>
      >,
      components: components.map((entry) => asObject(entry)).filter(Boolean) as Array<
        Record<string, unknown>
      >,
      evidence: evidence.map((entry) => asObject(entry)).filter(Boolean) as Array<
        Record<string, unknown>
      >,
      requestPackets: requestPackets.map((entry) => asObject(entry)).filter(Boolean) as Array<
        Record<string, unknown>
      >,
      localTrendingPrompts: asArray(scoutSourceSignalsQuery.data?.trendingPrompts)
        .map((entry) => asObject(entry))
        .filter(Boolean) as Array<Record<string, unknown>>,
    };
  }, [
    homesData,
    primaryHomeId,
    homeIdRailPersistence,
    homeIdRailDashboard,
    scoutSourceSignalsQuery.data?.trendingPrompts,
  ]);

  const homeIdMaintenanceSuggestions = useMemo(() => {
    if (!homeIdContextRail.hasHomeId) return [] as HomeIdMaintenanceSuggestion[];
    return evaluateHomeIdMaintenanceSuggestions({
      monthIndex: new Date().getMonth(),
      propertyDetails: Array.isArray(homeIdContextRail.propertyDetails)
        ? homeIdContextRail.propertyDetails
        : [],
      components: Array.isArray(homeIdContextRail.components) ? homeIdContextRail.components : [],
      evidence: Array.isArray(homeIdContextRail.evidence) ? homeIdContextRail.evidence : [],
      requestPackets: Array.isArray(homeIdContextRail.requestPackets)
        ? homeIdContextRail.requestPackets
        : [],
      recentActivity: Array.isArray(homeIdContextRail.recentActivity)
        ? homeIdContextRail.recentActivity
        : [],
    });
  }, [homeIdContextRail]);

  const homeIdSimilarLocalSignals = useMemo(() => {
    if (!homeIdContextRail.hasHomeId) return [] as HomeIdSimilarLocalSignal[];
    return evaluateHomeIdSimilarLocalSignals({
      components: Array.isArray(homeIdContextRail.components) ? homeIdContextRail.components : [],
      trendingPrompts: Array.isArray(homeIdContextRail.localTrendingPrompts)
        ? homeIdContextRail.localTrendingPrompts
        : [],
      minimumSampleCount: 3,
    });
  }, [homeIdContextRail]);

  const homeIdActionCards = useMemo(() => {
    if (!homeIdContextRail.hasHomeId) return [] as HomeIdActionCard[];
    return buildHomeIdActionCards({
      homeId: homeIdContextRail.homeId,
      components: Array.isArray(homeIdContextRail.components) ? homeIdContextRail.components : [],
      requestPackets: Array.isArray(homeIdContextRail.requestPackets)
        ? homeIdContextRail.requestPackets
        : [],
      maintenanceSuggestions: homeIdMaintenanceSuggestions,
      similarSignals: homeIdSimilarLocalSignals,
      missingCriticalInfoCount: Number(homeIdContextRail.missingCriticalInfoCount || 0),
    });
  }, [homeIdContextRail, homeIdMaintenanceSuggestions, homeIdSimilarLocalSignals]);

  useEffect(() => {
    if (!homeIdContextRail.hasHomeId) return;
    trackScoutHomeIdContextViewed({
      userState: user?.id ? "authenticated" : "anonymous",
      homeId: homeIdContextRail.homeId,
      source: "scout_homeid_context_rail",
    });
  }, [homeIdContextRail.hasHomeId, homeIdContextRail.homeId, user?.id]);

  const { data: vehiclesData } = useQuery<{
    vehicles?: Array<{
      id: string;
      nickname?: string | null;
      year?: number | string | null;
      make?: string | null;
      model?: string | null;
      updatedAt?: string | Date | null;
    }>;
  }>({
    queryKey: ["/api/vehicles", user?.id],
    queryFn: () => apiRequest("GET", "/api/vehicles"),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Build tile context from deterministic user state (no guessing, only real data)
  const tileContext: ScoutTileContext = useMemo(() => {
    const saved = savedContractorsData ?? [];
    const projects = dashboardData?.myProjects ?? [];
    const invoices = invoicesData ?? [];
    const homes = Array.isArray(homesData?.homes) ? homesData.homes : [];
    const vehicles = Array.isArray(vehiclesData?.vehicles) ? vehiclesData.vehicles : [];

    // Confidence rule: Only include saved contractors if we have data
    const savedContractors = saved.map((c) => ({
      id: c.id,
      name: c.name,
      trade: c.category ?? undefined,
    }));

    // Map projects to activeJobs with updatedAt for freshness logic
    const activeJobs = projects.map((p) => ({
      id: p.id,
      name: p.title,
      status: "active",
      updatedAt: p.updatedAt ?? null,
    }));

    // Map invoices to activeInvoices with updatedAt for freshness logic
    const activeInvoices = invoices.map((inv) => ({
      id: inv.id,
      jobName: (inv.jobName ?? undefined) as string | undefined,
      status: inv.status,
      amount: typeof inv.amount === "number" ? inv.amount : undefined,
      updatedAt: inv.updatedAt ?? null,
    }));

    return {
      activeJobs,
      activeInvoices,
      savedContractors,
      homes: homes.map((home) => ({
        id: String(home.id),
        label:
          home.nickname || [home.city, home.stateCode].filter(Boolean).join(", ") || "Your home",
        city: home.city ?? null,
        stateCode: home.stateCode ?? null,
        updatedAt: home.updatedAt ?? null,
      })),
      vehicles: vehicles.map((vehicle) => ({
        id: String(vehicle.id),
        label:
          vehicle.nickname ||
          [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
          "Your vehicle",
        updatedAt: vehicle.updatedAt ?? null,
      })),
      location: heroLocationLabel || undefined,
      recentActivity: [],
    };
  }, [
    heroLocationLabel,
    savedContractorsData,
    dashboardData,
    invoicesData,
    homesData,
    vehiclesData,
  ]);

  const scoutContextCards = useMemo(
    () => buildScoutContextCards(tileContext, latestUserQuery, hasUserMessages ? 4 : 5),
    [tileContext, latestUserQuery, hasUserMessages]
  );

  const contextCardMeta: Record<
    ScoutContextCardKind,
    { icon: React.ComponentType<{ className?: string }>; label: string }
  > = {
    project: { icon: FolderOpen, label: "Project" },
    home: { icon: Home, label: "Home" },
    vehicle: { icon: Car, label: "Vehicle" },
    pro: { icon: Wrench, label: "Saved help" },
    nearby: { icon: Users2, label: "Nearby" },
    supplier: { icon: Wrench, label: "Supplier" },
    material: { icon: PackageSearch, label: "Materials" },
    marketplace: { icon: Search, label: "Exchange" },
  };

  // Resolve tiles to contextual variants based on deterministic state
  // Feature kill switch: Set VITE_DISABLE_CONTEXTUAL_TILES=true to disable variants
  const resolvedTiles = useMemo(() => {
    const disableFeature = import.meta.env.VITE_DISABLE_CONTEXTUAL_TILES === "true";

    if (disableFeature) {
      console.warn("[Scout] Contextual tiles disabled via feature flag");
      return scoutActionTiles; // Return defaults only
    }

    const resolved = resolveAllTiles(scoutActionTiles, tileContext);

    // Dev-mode logging: always log tile context summary
    if (import.meta.env.DEV) {
      console.info("[Scout Tile Context]", {
        location: tileContext.location || "unknown",
        savedContractors: tileContext.savedContractors.length,
        activeProjects: tileContext.activeJobs.length,
        activeInvoices: tileContext.activeInvoices.length,
      });
    }

    // Dev-mode logging: trace which variants rendered and why
    if (import.meta.env.DEV) {
      resolved.forEach((tile, i) => {
        const original = scoutActionTiles[i];
        const usedVariant =
          tile.label !== original.label || tile.description !== original.description;

        if (usedVariant) {
          console.info(`[Scout Tiles] ${tile.id}:`, {
            variant: "custom",
            label: tile.label,
            context: {
              savedContractors: tileContext.savedContractors.length,
              location: tileContext.location,
              activeJobs: tileContext.activeJobs.length,
              activeInvoices: tileContext.activeInvoices.length,
            },
          });
        }
      });
    }

    // KPI: mark render start time for time-to-action tracking
    renderStartRef.current = Date.now();

    return resolved;
  }, [tileContext]);

  const tileMetaById: Record<
    string,
    { icon: React.ComponentType<{ className?: string }>; eyebrow: string }
  > = {
    start_project: { icon: ClipboardList, eyebrow: "Direct Connect" },
    find_pros: { icon: Wrench, eyebrow: "Local help" },
    nearby: { icon: Users2, eyebrow: "Community" },
    manage: { icon: Sparkles, eyebrow: "Exchange" },
  };

  const handleActionTile = useCallback(
    (tile: (typeof scoutActionTiles)[0]) => {
      // Derive lightweight variant metadata for KPI logging
      const isFresh = (updatedAt: string | Date | null | undefined, days = 14) => {
        if (!updatedAt) return false;
        const t =
          typeof updatedAt === "string"
            ? new Date(updatedAt).getTime()
            : new Date(updatedAt).getTime();
        const windowMs = days * 24 * 60 * 60 * 1000;
        return Date.now() - t <= windowMs;
      };
      let variantType: "default" | "single" | "multi" = "default";
      let entityId: string | undefined = undefined;
      if (tile.id === "manage") {
        const invs = tileContext.activeInvoices;
        if (invs.length === 1 && isFresh(invs[0]?.updatedAt)) {
          variantType = "single";
          entityId = invs[0]?.id;
        } else if (invs.length > 1) {
          variantType = "multi";
        } else {
          variantType = "default";
        }
      } else if (tile.id === "start_project") {
        const jobs = tileContext.activeJobs;
        if (jobs.length === 1 && isFresh(jobs[0]?.updatedAt)) variantType = "single";
        else if (jobs.length > 1) variantType = "multi";
        else variantType = "default";
      }

      const ttaMs = renderStartRef.current ? Date.now() - renderStartRef.current : undefined;

      recordActivity({
        type: "navigate",
        ts: new Date().toISOString(),
        path: location,
        to: tile.action.to,
        label: tile.label,
        meta: {
          tileId: tile.id,
          variantType,
          entityId,
          ttaMs,
        },
      });

      // Reset render start to avoid double-counting subsequent actions
      renderStartRef.current = null;
      const navTarget = (tile.action as any)?.to ?? (tile.action as any)?.path ?? "/";
      navigate(navTarget);
    },
    [location, navigate, tileContext]
  );

  const missionControlItems: Array<{
    id: "nearby" | "people" | "market" | "rules";
    label: string;
    icon: typeof Database;
    prompt: string;
  }> = [
    {
      id: "nearby",
      label: "Find local help",
      icon: Search,
      prompt:
        "I need local help. Help me find who handles this and what to check before contacting anyone.",
    },
    {
      id: "people",
      label: "Search",
      icon: Users2,
      prompt: "I have a question. Help me figure out what to do first.",
    },
    {
      id: "market",
      label: "Check prices",
      icon: BarChart3,
      prompt: "Help me understand normal price ranges before I call anyone.",
    },
    {
      id: "rules",
      label: "See nearby activity",
      icon: Route,
      prompt: "Show me local posts, recent requests, and useful activity near me.",
    },
  ];

  const missionTypeOptions: Array<{
    id: typeof missionType;
    label: string;
    description: string;
  }> = [
    {
      id: "around_me",
      label: "Not sure",
      description: "Help me choose",
    },
    {
      id: "help",
      label: "Find help",
      description: "Local contractors",
    },
    {
      id: "prices",
      label: "Check prices",
      description: "Before calling",
    },
    {
      id: "events",
      label: "Ask a question",
      description: "What to do first",
    },
  ];

  const urgencyOptions: Array<{ id: typeof missionUrgency; label: string }> = [
    { id: "today", label: "Today" },
    { id: "this_week", label: "This week" },
    { id: "exploring", label: "Flexible" },
  ];

  const sourceOptions: Array<{
    id: keyof typeof enabledMissionSources;
    label: string;
  }> = [
    { id: "knowledge", label: "Guidance" },
    { id: "county", label: "Local" },
    { id: "live", label: "Recent" },
  ];

  const composeMissionDraft = useCallback(
    (overrides?: {
      panel?: typeof activeMissionPanel;
      type?: typeof missionType;
      urgency?: typeof missionUrgency;
      sources?: typeof enabledMissionSources;
    }) => {
      const panel = overrides?.panel ?? activeMissionPanel;
      const type = overrides?.type ?? missionType;
      const urgency = overrides?.urgency ?? missionUrgency;
      const sources = overrides?.sources ?? enabledMissionSources;
      const typeLabel =
        missionTypeOptions.find((option) => option.id === type)?.label || "around me";
      const area =
        heroLocationLabel && heroLocationLabel.toLowerCase() !== "your area"
          ? heroLocationLabel
          : "my local area";
      const opening =
        type === "around_me"
          ? `Help me figure out what I need in ${area}.`
          : `Help me with ${typeLabel.toLowerCase()} in ${area}.`;
      const sourceList = sourceOptions
        .filter((source) => sources[source.id])
        .map((source) => source.label)
        .join(", ");
      const panelInstruction =
        panel === "nearby"
          ? "Include local matches, nearby posts, price guidance, and safety checks."
          : panel === "people"
            ? "Focus on local contractors, services, and what I should check before calling."
            : panel === "market"
              ? "Focus on price guidance, recent local requests, and nearby posts."
              : "Focus on nearby activity, useful local updates, and safety checks.";
      const urgencyLabel =
        urgencyOptions.find((option) => option.id === urgency)?.label.toLowerCase() ||
        urgency.replace("_", " ");

      return `${opening} Look in ${sourceList || "everything"}, assume I care about ${urgencyLabel}, and keep it simple. ${panelInstruction} Show the best matches, why they matter, and what I can safely do next before I contact anyone.`;
    },
    [activeMissionPanel, enabledMissionSources, heroLocationLabel, missionType, missionUrgency]
  );

  const prefillScoutMission = useCallback((prompt: string) => {
    try {
      window.localStorage.setItem("scout:prefill:scout-main", prompt);
    } catch {
      // ignore storage errors
    }
    setHasGuestInteracted(true);
    setPrefillKey((k) => k + 1);
  }, []);

  const applyMissionDraft = useCallback(
    (overrides?: Parameters<typeof composeMissionDraft>[0]) => {
      prefillScoutMission(composeMissionDraft(overrides));
    },
    [composeMissionDraft, prefillScoutMission]
  );

  const localDiscoveryLaunchers = useMemo(() => {
    const area =
      heroLocationLabel && heroLocationLabel.toLowerCase() !== "your area"
        ? heroLocationLabel
        : "near me";

    return [
      {
        id: "need-help",
        label: "Find local help",
        detail: "Contractors, services, and people nearby",
        icon: Wrench,
        panel: "people" as const,
        type: "help" as const,
        prompt: `Find local help ${area}. Show the best matches, what they do, and what I can safely do next before sharing contact info.`,
      },
      {
        id: "local-feed",
        label: "See nearby activity",
        detail: "Local posts, requests, and useful signals",
        icon: Users2,
        panel: "market" as const,
        type: "events" as const,
        prompt: `Show what's happening ${area}: local posts, requests, projects, events, and recent changes. Keep it easy to scan.`,
      },
      {
        id: "search-site",
        label: "Search",
        detail: "Questions, next steps, and what to check first",
        icon: Search,
        panel: "nearby" as const,
        type: "around_me" as const,
        prompt:
          "Help me find the right next step. If there are multiple options, compare them simply.",
      },
      {
        id: "prices-rules",
        label: "Check prices",
        detail: "Normal ranges before you call anyone",
        icon: BarChart3,
        panel: "rules" as const,
        type: "prices" as const,
        prompt: `Check prices, permits, rules, and local updates ${area}. Tell me what matters and what I can do next.`,
      },
      {
        id: "material-run",
        label: "Start a material run",
        detail: "Send a material list or supplier link",
        icon: PackageSearch,
        panel: "market" as const,
        type: "prices" as const,
        prompt:
          "Send a material list or supplier link and Scout will turn it into a Supply Run draft.",
      },
      {
        id: "open-messages",
        label: "Open messages",
        detail: "Review conversations when contact is already open",
        icon: MessageSquareText,
        panel: "people" as const,
        type: "help" as const,
        prompt: "Open messages.",
      },
    ];
  }, [heroLocationLabel]);

  const startDiscoveryLauncher = useCallback(
    (launcher: (typeof localDiscoveryLaunchers)[number]) => {
      if (launcher.id === "open-messages") {
        setHasGuestInteracted(true);
        void handleClusterAction({ type: "NAVIGATE", label: "Open messages", to: "/messages" });
        return;
      }

      setActiveMissionPanel(launcher.panel);
      setMissionType(launcher.type);
      setHasGuestInteracted(true);
      prefillScoutMission(launcher.prompt);
    },
    [handleClusterAction, localDiscoveryLaunchers, prefillScoutMission]
  );
  // Scout is one control surface. Dashboard state lives in the main column;
  // search and quick starts stay in the single dock instead of a second rail.
  const showDiscoveryRail = false;
  const handleScoutTyping = useCallback(() => {
    setHasGuestInteracted(true);
    recordActivity({
      type: "ask_scout",
      ts: new Date().toISOString(),
      path: location,
      label: "typing",
    });
  }, [location]);
  const clearScoutLaunchContext = useCallback(() => {
    navigate("/scout", { replace: true });
    setScoutBrowserLocation("/scout");
  }, [navigate]);
  const openScoutLaunchSource = useCallback(() => {
    if (scoutLaunch.returnPath) navigate(scoutLaunch.returnPath);
  }, [navigate, scoutLaunch.returnPath]);

  const launchContextSurface = scoutLaunch.context ? (
    <ScoutLaunchContextCard
      context={scoutLaunch.context}
      returnPath={scoutLaunch.returnPath}
      onOpenOriginal={openScoutLaunchSource}
      onClear={clearScoutLaunchContext}
    />
  ) : null;

  const onboardingAuxiliarySurface = (
    <>
      {onboarding.flowState.phase === "confirming" && onboarding.flowState.confirmationCard && (
        <div className="mt-3 mb-4 flex justify-center">
          <ClaimConfirmationCardComponent
            data={onboarding.flowState.confirmationCard}
            onConfirm={(selectedClaims: ClaimType[]) => {
              const card = onboarding.flowState.confirmationCard;
              if (!card) return;

              const confidenceByClaim: Record<string, number> = {};
              const evidenceByClaim: Record<string, string> = {};
              card.options.forEach((opt) => {
                if (selectedClaims.includes(opt.claimType)) {
                  confidenceByClaim[opt.claimType] = opt.confidence;
                  evidenceByClaim[opt.claimType] = opt.description || "";
                }
              });

              const provisional = (user as any)?.preferences?.provisional;
              const profileDraft: ProfileDraft | undefined = provisional?.profileDraft;
              const countyFips =
                profileDraft?.countyFips ||
                profileDraft?.serviceAreas?.find((s) => s.primary)?.countyFips ||
                profileDraft?.serviceAreas?.[0]?.countyFips ||
                (user as any)?.countyFips ||
                (user as any)?.county_fips ||
                (locationCtx as any)?.countyFips ||
                null;
              onboarding.confirmClaims(
                selectedClaims,
                {
                  confidenceByClaim,
                  evidenceByClaim,
                  rawUserIntentText: provisional?.userIntent || "",
                },
                countyFips
              );
              scoutModeHook.completeOnboarding(selectedClaims);
            }}
            onSkip={() => {
              onboarding.skipOnboarding();
              scoutModeHook.skipOnboarding();
            }}
            onEdit={() => {
              onboarding.resetFlow();
              navigate("/profile-settings");
            }}
          />
        </div>
      )}

      {onboarding.flowState.phase === "inferring" && (
        <div className="mt-3 mb-4 flex justify-center">
          <Card className="w-full max-w-2xl border-primary/20 bg-card/95 backdrop-blur p-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              <span className="text-sm text-muted-foreground">Understanding your intent...</span>
            </div>
          </Card>
        </div>
      )}

      {onboarding.flowState.phase === "writing" && (
        <div className="mt-3 mb-4 flex justify-center">
          <Card className="w-full max-w-2xl border-primary/20 bg-card/95 backdrop-blur p-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              <span className="text-sm text-muted-foreground">Setting up your experience...</span>
            </div>
          </Card>
        </div>
      )}

      {onboarding.flowState.error && (
        <div className="mt-3 mb-4 flex justify-center">
          <Card className="w-full max-w-2xl border-destructive/20 bg-destructive/10 backdrop-blur p-4">
            <p className="text-sm text-destructive">{onboarding.flowState.error}</p>
          </Card>
        </div>
      )}

      {scoutModeHook.scoutMode === "post_onboarding" && scoutModeHook.confirmedClaims && (
        <div className="mt-3 mb-4 flex justify-center">
          <PostOnboardingActionCard
            claims={scoutModeHook.confirmedClaims as ClaimType[]}
            actions={resolvePostOnboardingActions(scoutModeHook.confirmedClaims as ClaimType[], {
              slug: scoutModeHook.publishedProfileSlug,
              businessName: profileDraft?.businessName,
            })}
            onActionSelected={(actionId: string, destination: string) => {
              scoutModeHook.selectPostOnboardingAction(actionId);
              navigate(destination);
            }}
          />
        </div>
      )}
    </>
  );

  const objectiveAuxiliarySurface = (
    <>
      {activeObjective && (
        <ObjectiveChip
          objective={activeObjective}
          isLoading={objectiveBusy}
          onRename={async (_id, newTitle) => {
            await updateObjective({ title: newTitle });
          }}
          onPause={async (_id) => {
            await updateObjective({ status: "paused" });
          }}
          onComplete={async (_id) => {
            await updateObjective({ status: "completed" });
          }}
          onDelete={async (_id) => {
            await deleteObjective();
          }}
        />
      )}

      {showEvolutionSurfaces && objectiveOnboardingBundle && (
        <ObjectiveOnboardingFlow
          roleLabel={String(objectiveOnboardingBundle.role || "")}
          suggestions={
            Array.isArray(objectiveOnboardingBundle.suggestions)
              ? objectiveOnboardingBundle.suggestions
              : []
          }
          fastWins={
            Array.isArray(objectiveOnboardingBundle.fastWins)
              ? objectiveOnboardingBundle.fastWins
              : []
          }
          objectiveStates={
            activeObjective
              ? [
                  {
                    objectiveId: activeObjective.id,
                    status: objectiveStatusToOnboardingStatus(activeObjective.status),
                    completionPct: objectiveStatusToProgress(activeObjective.status),
                    updatedAt: activeObjective.updatedAt,
                  },
                ]
              : []
          }
          nextRecommendedObjectiveId={
            typeof objectiveOnboardingBundle.nextRecommendedObjectiveId === "string"
              ? objectiveOnboardingBundle.nextRecommendedObjectiveId
              : undefined
          }
          onStartObjective={handleStartObjectiveSuggestion}
          onOpenRoute={handleOpenObjectiveRoute}
          onCompleteFastWin={(objectiveId) => {
            void handleCompleteFastWin(objectiveId);
          }}
        />
      )}

      {showEvolutionSurfaces && visibleWatchdogInterventions.length > 0 && (
        <WatchdogInterventionBanner
          interventions={visibleWatchdogInterventions}
          engagementScore={
            typeof watchdogResult?.engagementScore === "number"
              ? watchdogResult.engagementScore
              : undefined
          }
          inactivityHours={
            typeof watchdogResult?.inactivityHours === "number"
              ? watchdogResult.inactivityHours
              : undefined
          }
          onOpenIntervention={(route, interventionId) => {
            recordActivity({
              type: "navigate",
              ts: new Date().toISOString(),
              path: location,
              to: route,
              label: `watchdog_${interventionId}`,
            });
            if (!maybeOpenWorkAreaForRoute(route, "Watchdog intervention")) {
              navigate(route);
            }
          }}
          onDismissIntervention={(interventionId) => {
            setDismissedWatchdogId(interventionId);
          }}
        />
      )}
    </>
  );

  const autoRouteAuxiliarySurface = autoRoutePending ? (
    <div className="scout-task-auxiliary-region__priority" data-testid="scout-priority-navigation">
      <Card
        className="shadow-sm"
        style={{
          borderColor: "var(--border-subtle)",
          backgroundColor: "color-mix(in oklab, var(--surface-intermediate) 90%, transparent)",
        }}
      >
        <div className="flex items-start justify-between gap-3 p-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Smart navigation {autoRouteEnabled ? "on" : "off"} •{" "}
              {Math.round(autoRoutePending.confidence * 100)}%
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {autoRouteEnabled && autoRoutePending.confidence >= AUTO_ROUTE_MIN_CONFIDENCE
                ? `Opening ${autoRoutePending.label}...`
                : `Suggested: ${autoRoutePending.label}`}
              {autoRoutePending.why ? ` - ${autoRoutePending.why}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(!autoRouteEnabled || autoRoutePending.confidence < AUTO_ROUTE_MIN_CONFIDENCE) && (
              <Button
                size="sm"
                style={{
                  backgroundColor: "var(--theme-accent-primary)",
                  color: "var(--ts-text-on-accent, #2b2b2b)",
                }}
                onClick={() => {
                  cancelAutoRoute();
                  navigate(autoRoutePending.to);
                }}
              >
                Go
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--text-primary)",
                backgroundColor: "transparent",
              }}
              onClick={cancelAutoRoute}
            >
              {autoRouteEnabled && autoRoutePending.confidence >= AUTO_ROUTE_MIN_CONFIDENCE
                ? "Cancel"
                : "Dismiss"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  ) : null;

  const hasActiveTaskAuxiliaryContent = Boolean(
    scoutLaunch.context ||
    (onboarding.flowState.phase === "confirming" && onboarding.flowState.confirmationCard) ||
    onboarding.flowState.phase === "inferring" ||
    onboarding.flowState.phase === "writing" ||
    onboarding.flowState.error ||
    (scoutModeHook.scoutMode === "post_onboarding" && scoutModeHook.confirmedClaims) ||
    activeObjective ||
    (showEvolutionSurfaces && objectiveOnboardingBundle) ||
    (showEvolutionSurfaces && visibleWatchdogInterventions.length > 0) ||
    autoRoutePending
  );

  return (
    <div
      className={`scout-shell scout-shell-refined flex flex-col flex-1 min-h-0 w-full items-center overflow-hidden ${
        hasUserMessages ? "scout-shell--active-task" : ""
      }`}
    >
      <div className="scout-content w-full flex flex-col flex-1 min-h-0">
        <div
          className={`scout-active-layout w-full ${
            isMobile ? "px-3 pt-2.5 pb-12" : "max-w-7xl px-4 pt-3 pb-8"
          } flex flex-col flex-1 min-h-0`}
          style={{
            paddingBottom: hasUserMessages
              ? isMobile
                ? "calc(var(--scout-search-dock-h) + 1rem)"
                : "calc(var(--scout-search-dock-h) + 1.25rem)"
              : isMobile
                ? "1.5rem"
                : "2rem",
          }}
        >
          {/* Main conversation layout: used for all users, including first-time guests. */}
          <div
            className={
              isMobile
                ? "max-w-[32rem] mx-auto w-full flex flex-1 flex-col min-h-0"
                : `mx-auto w-full flex flex-1 min-h-0 gap-5 ${
                    showDiscoveryRail ? "max-w-7xl" : "max-w-4xl"
                  }`
            }
          >
            <div
              className={`scout-active-column w-full flex flex-1 flex-col min-h-0 relative ${
                isMobile || showDiscoveryRail ? "" : "max-w-4xl mx-auto"
              }`}
            >
              {/* Keep the main thread clean: move dashboards into an optional side sheet. */}
              {!isMobile && (
                <div className="flex items-center justify-end pb-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mr-2 h-7 px-2.5 text-[11px]"
                    style={{
                      borderColor: "var(--border-subtle)",
                      color: "var(--text-primary)",
                      backgroundColor: "transparent",
                    }}
                    onClick={() => navigate("/help/scout")}
                  >
                    <BadgeInfo className="h-3.5 w-3.5" />
                    Search guide
                  </Button>
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-[11px]"
                        style={{
                          borderColor: "var(--border-subtle)",
                          color: "var(--text-primary)",
                          backgroundColor: "transparent",
                        }}
                      >
                        Requests
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[380px] max-w-[92vw]">
                      <SheetHeader>
                        <SheetTitle>Saved local requests</SheetTitle>
                      </SheetHeader>
                      <div className="mt-4 flex flex-col gap-3">
                        <ScoutDirectConnectPanel isAuthenticated={isAuthenticated} />
                        <ScoutHasDonePanel />
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              )}

              {!hasUserMessages ? launchContextSurface : null}

              {!hasUserMessages && (
                <ScoutHome
                  primaryOutcomeInput={
                    <ScoutSearchDock
                      isMobile={isMobile}
                      placement="inline"
                      isBusy={isBusy}
                      prefillKey={prefillKey}
                      forcedPrefill={scoutLaunch.prompt}
                      hasMessages={hasMessages}
                      quickStartPrompts={SCOUT_QUICK_START_PROMPTS}
                      autoDemoText=""
                      enableAutoDemo={shouldPlayIntroDemo}
                      onSend={(value) => handleSend(value)}
                      onTyping={handleScoutTyping}
                    />
                  }
                  onPromptSelect={(text) => {
                    setHasGuestInteracted(true);
                    handleSend(text);
                  }}
                  onContinuationSelect={(threadId) => {
                    const thread = savedThreadPreview.find(
                      (candidate) => candidate.id === threadId
                    );
                    if (thread) handleLoadSavedThread(thread);
                  }}
                  continuationThreads={savedThreadPreview.map((thread) => ({
                    id: thread.id,
                    title: thread.title,
                    summary: thread.summary,
                    preview: thread.preview,
                    intent: thread.intent,
                    relatedLabel: thread.relatedLabel,
                    messageCount: thread.messageCount,
                    relatedTo: thread.relatedTo,
                  }))}
                />
              )}

              {!hasUserMessages ? onboardingAuxiliarySurface : null}

              {false && !hasUserMessages && (
                <div
                  className="scout-composer-refined z-10 order-2 mt-1.5 rounded-2xl border px-3 py-3 md:px-4 md:py-4"
                  style={{
                    borderColor:
                      "color-mix(in oklab, var(--theme-accent-primary) 25%, var(--border-subtle))",
                    backgroundColor: "color-mix(in oklab, var(--surface-card) 96%, black 4%)",
                    boxShadow: "0 18px 48px rgba(0,0,0,0.32)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {isMobile && (
                    <div
                      className="scout-step-card mb-2 rounded-md border px-2.5 py-2"
                      style={{
                        borderColor: "var(--border-subtle)",
                        backgroundColor:
                          "color-mix(in oklab, var(--surface-intermediate) 90%, transparent)",
                      }}
                    >
                      <p
                        className="text-[10px] font-semibold uppercase tracking-wide"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Before you contact anyone
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        Scout searches first. You review the next step before sharing contact info
                        or making a request.
                      </p>
                    </div>
                  )}

                  {scoutContextCards.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                          Keep working
                        </p>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          Stay here or open it
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {scoutContextCards.map((card) => {
                          const meta = contextCardMeta[card.kind];
                          const Icon = meta.icon;

                          return (
                            <div
                              key={card.id}
                              className="group flex min-h-[92px] items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors"
                              style={{
                                borderColor: "var(--border-subtle)",
                                backgroundColor:
                                  "color-mix(in oklab, var(--surface-card) 88%, var(--surface-intermediate) 12%)",
                                color: "var(--text-primary)",
                              }}
                            >
                              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ts-orange/10 text-ts-orange">
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-ts-orange">
                                  {meta.label}
                                </span>
                                <span className="mt-0.5 block text-sm font-semibold leading-tight">
                                  {card.label}
                                </span>
                                <span
                                  className="mt-1 block text-[11px] leading-snug"
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  {card.description}
                                </span>
                                <span className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setHasGuestInteracted(true);
                                      void handleClusterAction(card.action);
                                    }}
                                    className="rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                                    style={{
                                      borderColor: "var(--border-subtle)",
                                      backgroundColor: "var(--surface-intermediate)",
                                      color: "var(--text-primary)",
                                    }}
                                  >
                                    Open here
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setHasGuestInteracted(true);
                                      void handleSend(card.prompt);
                                    }}
                                    className="rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                                    style={{
                                      borderColor:
                                        "color-mix(in oklab, var(--theme-accent-primary) 42%, var(--border-subtle))",
                                      backgroundColor:
                                        "color-mix(in oklab, var(--theme-accent-primary) 8%, var(--surface-card))",
                                      color: "var(--text-primary)",
                                    }}
                                  >
                                    Search
                                  </button>
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                        Try a local search
                      </p>
                      <button
                        type="button"
                        onClick={() => applyMissionDraft()}
                        className="rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                        style={{
                          borderColor: "var(--border-subtle)",
                          color: "var(--text-secondary)",
                          backgroundColor: "transparent",
                        }}
                      >
                        Use my choices
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {localDiscoveryLaunchers.map((launcher) => {
                        const Icon = launcher.icon;

                        return (
                          <button
                            key={launcher.id}
                            type="button"
                            onClick={() => startDiscoveryLauncher(launcher)}
                            className="group flex min-h-[84px] flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-colors"
                            style={{
                              borderColor: "var(--border-subtle)",
                              backgroundColor:
                                "color-mix(in oklab, var(--surface-intermediate) 88%, transparent)",
                              color: "var(--text-primary)",
                            }}
                          >
                            <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-ts-orange/10 text-ts-orange">
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-[13px] font-semibold leading-tight">
                              {launcher.label}
                            </span>
                            <span
                              className="mt-1 text-[11px] leading-snug"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {launcher.detail}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {!isAuthenticated && (
                    <div className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      Start here first.{" "}
                      <button
                        type="button"
                        className="font-medium underline underline-offset-2"
                        style={{ color: "var(--text-primary)" }}
                        onClick={() => navigate("/login")}
                      >
                        Sign in
                      </button>{" "}
                      only when you want to save this or come back to it later.
                    </div>
                  )}

                  {!isMobile && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShortcutsOpen((v) => !v)}
                        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors"
                        style={{
                          borderColor: "var(--border-subtle)",
                          backgroundColor:
                            "color-mix(in oklab, var(--surface-intermediate) 88%, transparent)",
                          color: "var(--text-secondary)",
                        }}
                        aria-expanded={shortcutsOpen}
                      >
                        {shortcutsOpen ? "Hide shortcuts" : "Shortcuts"}
                      </button>

                      {shortcutsOpen &&
                        resolvedTiles.slice(0, isMobile ? 3 : 4).map((tile) => (
                          <button
                            key={`dock-${tile.id}`}
                            type="button"
                            onClick={() => {
                              setHasGuestInteracted(true);
                              handleActionTile(tile);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors"
                            style={{
                              borderColor: "var(--border-subtle)",
                              backgroundColor:
                                "color-mix(in oklab, var(--surface-intermediate) 88%, transparent)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            <span>{tile.label}</span>
                          </button>
                        ))}
                    </div>
                  )}

                  {!isMobile && (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Server-provided actions appear with each answer
                      </p>

                      <div
                        className="inline-flex items-center gap-1 rounded-full border p-0.5"
                        style={{
                          borderColor: "var(--border-subtle)",
                          backgroundColor:
                            "color-mix(in oklab, var(--surface-intermediate) 84%, transparent)",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setViewMode("chat_only")}
                          className="rounded-full px-2 py-1 text-[10px] font-medium"
                          style={{
                            color:
                              scoutViewMode === "chat_only"
                                ? "var(--ts-text-on-accent, #2b2b2b)"
                                : "var(--text-secondary)",
                            backgroundColor:
                              scoutViewMode === "chat_only"
                                ? "var(--theme-accent-primary)"
                                : "transparent",
                          }}
                        >
                          Results
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode("chat_plus_controller")}
                          className="rounded-full px-2 py-1 text-[10px] font-medium"
                          style={{
                            color:
                              scoutViewMode === "chat_plus_controller"
                                ? "var(--ts-text-on-accent, #2b2b2b)"
                                : "var(--text-secondary)",
                            backgroundColor:
                              scoutViewMode === "chat_plus_controller"
                                ? "var(--theme-accent-primary)"
                                : "transparent",
                          }}
                        >
                          Results + controls
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Thread surface. The command bar lives in its own bottom-pinned wrapper below. */}
              <div
                className={`mt-1.5 flex flex-col min-h-0 ${
                  showThreadRegion ? "flex-1" : "flex-none"
                } ${
                  isMobile
                    ? "space-y-2 order-1"
                    : hasUserMessages
                      ? "space-y-2 order-2"
                      : "space-y-2 order-1"
                } ${hasUserMessages ? "scout-active-workbench" : ""}`}
                style={{ paddingBottom: isMobile ? "0.75rem" : "1rem" }}
              >
                {false && !hasUserMessages && (
                  <div className="flex flex-col gap-2.5 py-2 px-0.5">
                    <p
                      className="text-[11px] md:text-xs font-semibold tracking-wide uppercase"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Start search
                    </p>

                    <p
                      className="text-[11px] md:text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Pick what you want Scout to look for first.
                    </p>

                    {/* Primary action grid: navigation with intent, not chat suggestions */}
                    {countyCommitted ? (
                      <div className="grid grid-cols-2 gap-2 mt-0.5">
                        {resolvedTiles.map((tile) => (
                          <button
                            key={tile.id}
                            onClick={() => {
                              setHasGuestInteracted(true);
                              handleActionTile(tile);
                            }}
                            className="flex flex-col items-start justify-between rounded-lg border px-2 py-2 text-left transition-colors"
                            style={{
                              borderColor: "var(--border-subtle)",
                              backgroundColor:
                                "color-mix(in oklab, var(--surface-intermediate) 86%, transparent)",
                              color: "var(--text-primary)",
                            }}
                          >
                            <div
                              className="mb-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                              style={{
                                borderColor: "var(--border-subtle)",
                                backgroundColor:
                                  "color-mix(in oklab, var(--surface-card) 92%, transparent)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {(() => {
                                const meta = tileMetaById[tile.id];
                                if (!meta) return null;
                                const Icon = meta.icon;
                                return <Icon className="h-3 w-3" />;
                              })()}
                              <span>{tileMetaById[tile.id]?.eyebrow || "Scout"}</span>
                            </div>
                            <span className="font-semibold text-[13px] mb-1">{tile.label}</span>
                            {!isMobile && tile.description && (
                              <span
                                className="text-[11px]"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                {tile.description}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div
                        className="mt-1.5 space-y-2 rounded-lg border px-3 py-2.5"
                        style={{
                          borderColor: "var(--border-subtle)",
                          backgroundColor:
                            "color-mix(in oklab, var(--surface-intermediate) 86%, transparent)",
                        }}
                      >
                        <p
                          className="text-xs md:text-sm"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Set your local area so Scout can show the right nearby help, activity, and
                          requests.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 px-3 text-[11px] font-medium"
                            style={{
                              backgroundColor: "var(--theme-accent-primary)",
                              color: "var(--ts-text-on-accent, #2b2b2b)",
                            }}
                            onClick={() => navigate(ROUTES.SETTINGS)}
                          >
                            Set my local area
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {hasUserMessages && (
                  <section
                    className="scout-current-task grid gap-2.5 rounded-xl border border-[color:var(--border-subtle)] p-3"
                    data-testid="scout-current-task"
                    data-has-next-action={Boolean(primaryNextAction)}
                    aria-labelledby="scout-current-task-title"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase text-ts-orange">
                          {activeSavedThread ? "Saved task" : "Current task"}
                          {activeSavedThread?.relatedLabel
                            ? ` · ${activeSavedThread.relatedLabel}`
                            : ""}
                        </p>
                        <h1
                          id="scout-current-task-title"
                          className="mt-0.5 break-words text-base font-bold leading-tight text-[color:var(--text-primary)]"
                          data-testid="scout-current-task-title"
                        >
                          {currentTaskTitle}
                        </h1>
                      </div>

                      <div
                        className="flex w-full items-center gap-1.5 sm:w-auto"
                        aria-label="Thread controls"
                      >
                        <button
                          type="button"
                          className="min-h-11 flex-1 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-2.5 text-xs font-bold text-[color:var(--text-secondary)] sm:flex-none"
                          onClick={handleSaveScoutThreadNow}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="min-h-11 flex-1 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-2.5 text-xs font-bold text-[color:var(--text-secondary)] sm:flex-none"
                          onClick={handleStartNewScoutThread}
                        >
                          New
                        </button>
                        {activeSavedThreadId && (
                          <details className="relative flex-1 sm:flex-none">
                            <summary
                              className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-2.5 text-xs font-bold text-[color:var(--text-secondary)] [&::-webkit-details-marker]:hidden"
                              aria-label="More thread options"
                            >
                              More
                            </summary>
                            <button
                              type="button"
                              className="absolute right-0 top-[calc(100%+0.35rem)] z-40 min-h-11 w-max max-w-[calc(100vw-2rem)] rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-2.5 text-xs font-bold text-[color:var(--text-secondary)]"
                              onClick={() => handleDeleteSavedThread(activeSavedThreadId)}
                            >
                              Delete saved thread
                            </button>
                          </details>
                        )}
                      </div>
                    </div>

                    <div className="scout-current-task__latest grid min-w-0 gap-0.5">
                      <p className="text-[10px] font-bold uppercase text-[color:var(--text-muted)]">
                        Latest
                      </p>
                      <p
                        className="break-words text-sm leading-snug text-[color:var(--text-primary)]"
                        data-testid="scout-latest-meaningful-state"
                      >
                        {currentTaskState}
                      </p>
                    </div>

                    {primaryNextAction && (
                      <button
                        type="button"
                        className="scout-current-task__primary flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border border-ts-orange/50 bg-ts-orange/10 px-3 py-2 text-left text-[color:var(--text-primary)]"
                        data-testid="scout-primary-next-action"
                        onClick={() => {
                          setHasGuestInteracted(true);
                          void handleClusterAction(primaryNextAction);
                        }}
                      >
                        <span className="grid gap-0.5">
                          <span className="text-[10px] font-bold uppercase text-ts-orange">
                            Next action
                          </span>
                          <strong>
                            {primaryNextAction.label ||
                              (primaryNextAction.type === "NAVIGATE"
                                ? "Open next step"
                                : "Continue")}
                          </strong>
                        </span>
                        <Route className="h-4 w-4 shrink-0 text-ts-orange" aria-hidden="true" />
                      </button>
                    )}
                  </section>
                )}

                {hasUserMessages && hasActiveTaskAuxiliaryContent && (
                  <section
                    className="scout-task-auxiliary-region"
                    data-testid="scout-task-auxiliary-region"
                    aria-label="Task guidance and controls"
                    tabIndex={0}
                  >
                    {autoRouteAuxiliarySurface}
                    {launchContextSurface}
                    {onboardingAuxiliarySurface}
                    {objectiveAuxiliarySurface}
                  </section>
                )}

                {!hasUserMessages ? objectiveAuxiliarySurface : null}

                {showThreadRegion && (
                  <section
                    className="scout-task-work-region"
                    data-testid="scout-task-work-region"
                    aria-labelledby="scout-task-work-region-title"
                  >
                    <header className="scout-task-work-region__header">
                      <h2
                        id="scout-task-work-region-title"
                        className="text-xs font-bold text-[color:var(--text-secondary)]"
                      >
                        Conversation and results
                      </h2>
                      <span className="text-[10px] font-semibold text-[color:var(--text-muted)]">
                        {state.messages.length} {state.messages.length === 1 ? "update" : "updates"}
                      </span>
                    </header>
                    <div className="scout-task-work-region__body">
                      <ScoutThread
                        messages={state.messages}
                        status={state.status}
                        mode={activeMode}
                        showControllerExtras
                        currentTurnPrimaryAction={primaryNextAction}
                        onAction={handleClusterAction}
                        onOverride={handleOverride}
                        overridePendingScope={overridePendingScope}
                        onSendMessage={handleOnboardingMessage}
                        onPrefill={prefillScoutMission}
                        locality={locality}
                        onQuickAction={(text) => {
                          const trimmed = text.trim();
                          setHasGuestInteracted(true);
                          const localAction = resolveQuickActionIntent(trimmed);

                          if (localAction?.kind === "direct_connect_request") {
                            if (!isAuthenticated) {
                              navigate("/pre-scout-setup?mode=signin");
                              return;
                            }

                            const lastUserMsg = [...state.messages]
                              .reverse()
                              .find(
                                (m) => m.role === "user" && typeof m.content === "string"
                              )?.content;
                            const raw = String(lastUserMsg || "")
                              .replace(/\s+/g, " ")
                              .trim();

                            if (!raw) {
                              navigate("/direct-connect");
                              return;
                            }

                            const title = raw.length > 180 ? `${raw.slice(0, 177)}...` : raw;
                            const countyFips =
                              typeof (user as any)?.countyFips === "string"
                                ? String((user as any).countyFips)
                                : typeof (user as any)?.county_fips === "string"
                                  ? String((user as any).county_fips)
                                  : undefined;
                            const stateCode =
                              typeof (user as any)?.stateCode === "string"
                                ? String((user as any).stateCode)
                                : typeof (user as any)?.state_code === "string"
                                  ? String((user as any).state_code)
                                  : undefined;

                            setDcDraft({
                              title,
                              description: raw,
                              countyFips,
                              stateCode,
                            });
                            setDcConfirmOpen(true);
                            return;
                          }

                          if (localAction?.kind === "navigate") {
                            recordActivity({
                              type: "navigate",
                              ts: new Date().toISOString(),
                              path: location,
                              to: localAction.to,
                              label: trimmed,
                            });
                            if (!maybeOpenWorkAreaForRoute(localAction.to, trimmed)) {
                              navigate(localAction.to);
                            }
                            return;
                          }

                          if (localAction?.kind === "open_note") {
                            recordActivity({
                              type: "open_note",
                              ts: new Date().toISOString(),
                              path: location,
                              label: trimmed,
                            });
                            void openFloatingNote("quick");
                            return;
                          }

                          handleSend(trimmed);
                        }}
                      />
                    </div>
                  </section>
                )}

                {!hasUserMessages ? autoRouteAuxiliarySurface : null}
              </div>
            </div>

            {hasUserMessages ? (
              <div className="scout-input-bottom-pin order-3" data-testid="scout-task-composer">
                <ScoutSearchDock
                  isMobile={isMobile}
                  placement="fixed"
                  isBusy={isBusy}
                  prefillKey={prefillKey}
                  forcedPrefill={scoutLaunch.prompt}
                  hasMessages={hasMessages}
                  quickStartPrompts={SCOUT_QUICK_START_PROMPTS}
                  autoDemoText=""
                  enableAutoDemo={shouldPlayIntroDemo}
                  onSend={(value) => handleSend(value)}
                  onTyping={handleScoutTyping}
                />
              </div>
            ) : null}

            {showDiscoveryRail && (
              <aside className="scout-v2-command-rail">
                <section className="scout-v2-rail-card scout-v2-rail-card--hero">
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ts-orange">
                      <Sparkles className="h-3.5 w-3.5" />
                      Scout
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                      ready
                    </span>
                  </div>

                  <h2 className="mt-4 font-display text-2xl font-bold leading-tight text-[color:var(--text-primary)]">
                    What do you need help with?
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-muted)]">
                    Describe the job, problem, or question. You stay in control of what happens
                    next.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      "AC or heating",
                      "Plumbing",
                      "Electrical",
                      "Roofing",
                      "Concrete",
                      "Handyman",
                      "Not sure yet",
                    ].map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => prefillScoutMission(label)}
                        className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                        style={{
                          borderColor: "var(--border-subtle)",
                          color: "var(--text-primary)",
                          backgroundColor: "var(--surface-intermediate)",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <details className="group mt-4 border-t border-[color:var(--border-subtle)] pt-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                      <span>
                        <span className="block text-sm font-semibold text-[color:var(--text-primary)]">
                          Add details
                        </span>
                        <span className="mt-0.5 block text-xs text-[color:var(--text-muted)]">
                          Optional context, sources, and timing
                        </span>
                      </span>
                      <ChevronDown className="h-4 w-4 text-[color:var(--text-muted)] transition-transform group-open:rotate-180" />
                    </summary>

                    <div className="mt-4 space-y-4">
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border-subtle)] px-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-[color:var(--text-primary)]">
                            {homeIdContextRail.hasHomeId
                              ? homeIdContextRail.homeLabel
                              : "Home details"}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-[color:var(--text-muted)]">
                            {homeIdContextRail.hasHomeId
                              ? "Use saved property details when they matter"
                              : "Optional for property-related questions"}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="shrink-0 text-xs font-semibold text-ts-orange"
                          onClick={() =>
                            navigate(
                              homeIdContextRail.hasHomeId
                                ? `/homes?homeId=${encodeURIComponent(homeIdContextRail.homeId)}`
                                : "/homes"
                            )
                          }
                        >
                          {homeIdContextRail.hasHomeId ? "Review" : "Add"}
                        </button>
                      </div>

                      <div>
                        <p className="scout-builder-label">I want to</p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {missionTypeOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                setMissionType(option.id);
                                applyMissionDraft({ type: option.id });
                              }}
                              className={`scout-source-toggle ${missionType === option.id ? "active" : ""}`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="scout-builder-label">Include</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {sourceOptions.map((source) => (
                            <button
                              key={source.id}
                              type="button"
                              onClick={() => {
                                const enabledCount =
                                  Object.values(enabledMissionSources).filter(Boolean).length;
                                const next = {
                                  ...enabledMissionSources,
                                  [source.id]:
                                    enabledCount === 1 && enabledMissionSources[source.id]
                                      ? true
                                      : !enabledMissionSources[source.id],
                                };
                                setEnabledMissionSources(next);
                                applyMissionDraft({ sources: next });
                              }}
                              className={`scout-source-toggle ${enabledMissionSources[source.id] ? "active" : ""}`}
                            >
                              {source.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="scout-builder-label">When</p>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {urgencyOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                setMissionUrgency(option.id);
                                applyMissionDraft({ urgency: option.id });
                              }}
                              className={`scout-source-toggle ${missionUrgency === option.id ? "active" : ""}`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => applyMissionDraft()}
                        className="w-full rounded-xl bg-ts-orange px-3 py-2.5 text-sm font-semibold text-black"
                      >
                        Use these details
                      </button>
                    </div>
                  </details>
                </section>
              </aside>
            )}

            {false && showDiscoveryRail && (
              <aside className="scout-v2-command-rail">
                <div className="scout-v2-rail-card scout-v2-rail-card--hero">
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ts-orange">
                      <Sparkles className="h-3.5 w-3.5" />
                      Scout
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                      ready
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-2xl font-bold leading-tight text-[color:var(--text-primary)]">
                    Search local options and narrow the next step.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-[color:var(--text-muted)]">
                    You can search by job, problem, or question, like "AC not cooling", "need
                    concrete driveway", or "is this roofing quote fair?"
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      "AC or heating",
                      "Plumbing",
                      "Electrical",
                      "Roofing",
                      "Concrete",
                      "Handyman",
                      "Not sure yet",
                    ].map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => prefillScoutMission(label)}
                        className="rounded-full border px-3 py-1.5 text-xs font-semibold"
                        style={{
                          borderColor: "var(--border-subtle)",
                          color: "var(--text-primary)",
                          backgroundColor: "var(--surface-intermediate)",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <details className="scout-v2-rail-card group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-ts-orange">
                        HomeID context
                      </span>
                      <span className="mt-1 block text-xs text-[color:var(--text-muted)]">
                        Property details, reminders, and saved evidence
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Home className="h-4 w-4 text-ts-orange" />
                      <ChevronDown className="h-4 w-4 text-[color:var(--text-muted)] transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  {homeIdContextRail.hasHomeId ? (
                    <div className="mt-4 space-y-3">
                      <div
                        className="rounded-xl border p-3"
                        style={{
                          borderColor: "var(--border-subtle)",
                          backgroundColor: "var(--surface-card)",
                        }}
                      >
                        <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                          {homeIdContextRail.homeLabel}
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                          Completion {Math.max(0, Math.min(100, homeIdContextRail.completionScore))}
                          %
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div
                          className="rounded-lg border p-2"
                          style={{ borderColor: "var(--border-subtle)" }}
                        >
                          Known details: {homeIdContextRail.knownPropertyDetailCount}
                        </div>
                        <div
                          className="rounded-lg border p-2"
                          style={{ borderColor: "var(--border-subtle)" }}
                        >
                          Components: {homeIdContextRail.componentCount}
                        </div>
                        <div
                          className="rounded-lg border p-2"
                          style={{ borderColor: "var(--border-subtle)" }}
                        >
                          Evidence: {homeIdContextRail.evidenceCount}
                        </div>
                        <div
                          className="rounded-lg border p-2"
                          style={{ borderColor: "var(--border-subtle)" }}
                        >
                          Open packets: {homeIdContextRail.openRequestPacketCount}
                        </div>
                      </div>
                      <div
                        className="rounded-xl border p-3 text-xs"
                        style={{
                          borderColor: "var(--border-subtle)",
                          backgroundColor: "var(--surface-intermediate)",
                          color: "var(--text-muted)",
                        }}
                      >
                        Missing critical info: {homeIdContextRail.missingCriticalInfoCount}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
                          Recent HomeID activity
                        </p>
                        <div className="mt-2 space-y-2">
                          {homeIdContextRail.recentActivity.length > 0 ? (
                            homeIdContextRail.recentActivity.map((event) => (
                              <div
                                key={event.id}
                                className="rounded-lg border p-2 text-xs"
                                style={{ borderColor: "var(--border-subtle)" }}
                              >
                                <p className="text-[color:var(--text-primary)]">{event.title}</p>
                              </div>
                            ))
                          ) : (
                            <div
                              className="rounded-lg border p-2 text-xs"
                              style={{ borderColor: "var(--border-subtle)" }}
                            >
                              No recent HomeID activity yet.
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
                          Maintenance suggestions
                        </p>
                        <div className="mt-2 space-y-2">
                          {homeIdMaintenanceSuggestions.length > 0 ? (
                            homeIdMaintenanceSuggestions.map((suggestion) => (
                              <div
                                key={suggestion.id}
                                className="rounded-lg border p-2 text-xs"
                                style={{ borderColor: "var(--border-subtle)" }}
                              >
                                <p className="text-[color:var(--text-primary)] font-semibold">
                                  {suggestion.title}
                                </p>
                                <p className="mt-1 text-[color:var(--text-muted)]">
                                  {suggestion.reason}
                                </p>
                                <button
                                  type="button"
                                  className="mt-2 rounded border px-2 py-1 text-[11px] font-semibold"
                                  style={{ borderColor: "var(--border-subtle)" }}
                                  onClick={() =>
                                    navigate(
                                      `/homes?homeId=${encodeURIComponent(homeIdContextRail.homeId)}`
                                    )
                                  }
                                >
                                  {suggestion.actionLabel}
                                </button>
                              </div>
                            ))
                          ) : (
                            <div
                              className="rounded-lg border p-2 text-xs"
                              style={{ borderColor: "var(--border-subtle)" }}
                            >
                              No maintenance suggestions yet.
                            </div>
                          )}
                        </div>
                      </div>
                      {homeIdSimilarLocalSignals.length > 0 ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
                            Similar-home local signals
                          </p>
                          <div className="mt-2 space-y-2">
                            {homeIdSimilarLocalSignals.map((signal) => (
                              <div
                                key={signal.id}
                                className="rounded-lg border p-2 text-xs"
                                style={{ borderColor: "var(--border-subtle)" }}
                              >
                                <p className="text-[color:var(--text-primary)] font-semibold">
                                  {signal.title}
                                </p>
                                <p className="mt-1 text-[color:var(--text-muted)]">
                                  {signal.reason}
                                </p>
                                <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                                  {signal.category} · {signal.componentType} · sample{" "}
                                  {signal.sampleCount}
                                </p>
                                <button
                                  type="button"
                                  className="mt-2 rounded border px-2 py-1 text-[11px] font-semibold"
                                  style={{ borderColor: "var(--border-subtle)" }}
                                  onClick={() =>
                                    navigate(
                                      `/homes?homeId=${encodeURIComponent(homeIdContextRail.homeId)}`
                                    )
                                  }
                                >
                                  {signal.actionLabel}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
                          HomeID action cards
                        </p>
                        <div className="mt-2 space-y-2">
                          {homeIdActionCards.map((card) => (
                            <div
                              key={card.id}
                              className="rounded-lg border p-2 text-xs"
                              style={{ borderColor: "var(--border-subtle)" }}
                            >
                              <p className="text-[color:var(--text-primary)] font-semibold">
                                {card.title}
                              </p>
                              <p className="mt-1 text-[color:var(--text-muted)]">{card.reason}</p>
                              <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
                                source: {card.source.replaceAll("_", " ")} ·{" "}
                                {card.actionType.replaceAll("_", " ")}
                              </p>
                              <button
                                type="button"
                                className="mt-2 rounded border px-2 py-1 text-[11px] font-semibold"
                                style={{ borderColor: "var(--border-subtle)" }}
                                onClick={() => {
                                  trackScoutHomeIdActionCardClicked({
                                    userState: user?.id ? "authenticated" : "anonymous",
                                    homeId: card.targetHomeId,
                                    actionCardType: card.actionType,
                                    componentType:
                                      card.actionType === "view_component" ||
                                      card.actionType === "review_component"
                                        ? card.targetComponentId
                                        : undefined,
                                    packetId: card.targetPacketId,
                                    source: card.source,
                                  });
                                  navigate(card.href);
                                }}
                              >
                                {card.ctaLabel}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          navigate(`/homes?homeId=${encodeURIComponent(homeIdContextRail.homeId)}`)
                        }
                      >
                        Open HomeID dashboard
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-[color:var(--text-muted)]">
                        Start HomeID to track property facts, components, evidence, and request
                        packet progress.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate("/homes")}
                      >
                        Start HomeID
                      </Button>
                    </div>
                  )}
                </details>

                <details className="scout-v2-rail-card group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-ts-orange">
                        Fine-tune your search
                      </span>
                      <span className="mt-1 block text-xs text-[color:var(--text-muted)]">
                        Optional filters, sources, and timing
                      </span>
                    </span>
                    <ChevronDown className="h-4 w-4 text-[color:var(--text-muted)] transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-4 space-y-3">
                    <div className="scout-v2-rail-card">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ts-orange">
                          Search controls
                        </p>
                        <Database className="h-4 w-4 text-ts-orange" />
                      </div>
                      <div className="mt-4 space-y-3">
                        {[
                          ["Local matches", "contractors and services that may fit", "knowledge"],
                          ["Nearby posts", "community signals and recent requests", "county"],
                          ["Price guidance", "normal ranges and quote questions", "live"],
                          ["Safety checks", "what to confirm before contact", "county"],
                        ].map(([label, detail, sourceId]) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              const next = {
                                ...enabledMissionSources,
                                [sourceId]: true,
                              };
                              setEnabledMissionSources(next);
                              applyMissionDraft({ sources: next });
                            }}
                            className={`w-full rounded-xl border p-3 text-left ${
                              enabledMissionSources[sourceId as keyof typeof enabledMissionSources]
                                ? "border-ts-orange/50 bg-ts-orange/5"
                                : ""
                            }`}
                            style={{
                              borderColor: enabledMissionSources[
                                sourceId as keyof typeof enabledMissionSources
                              ]
                                ? "color-mix(in oklab, var(--theme-accent-primary) 50%, transparent)"
                                : "var(--border-subtle)",
                              backgroundColor: "var(--surface-card)",
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                                  {label}
                                </p>
                                <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">
                                  {detail}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {missionControlItems.map((item) => {
                        const Icon = item.icon;
                        const subcopy =
                          item.id === "nearby"
                            ? "local options"
                            : item.id === "people"
                              ? "questions and next steps"
                              : item.id === "market"
                                ? "normal ranges"
                                : "nearby activity";

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setActiveMissionPanel(item.id);
                              applyMissionDraft({ panel: item.id });
                            }}
                            className={`scout-v2-mini-card text-left ${
                              activeMissionPanel === item.id ? "active" : ""
                            }`}
                          >
                            <Icon className="h-4 w-4 text-ts-orange" />
                            <p className="mt-3 text-sm font-semibold text-[color:var(--text-primary)]">
                              {item.label}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-[color:var(--text-muted)]">
                              {subcopy}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="scout-v2-rail-card">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ts-orange">
                        Build your search
                      </p>
                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="scout-builder-label">What do you need?</p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {missionTypeOptions.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => {
                                  setMissionType(option.id);
                                  applyMissionDraft({ type: option.id });
                                }}
                                className={`scout-builder-button ${
                                  missionType === option.id ? "active" : ""
                                }`}
                              >
                                <span>{option.label}</span>
                                <small>{option.description}</small>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="scout-builder-label">Look in</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {sourceOptions.map((source) => (
                              <button
                                key={source.id}
                                type="button"
                                onClick={() => {
                                  const enabledCount =
                                    Object.values(enabledMissionSources).filter(Boolean).length;
                                  const next = {
                                    ...enabledMissionSources,
                                    [source.id]:
                                      enabledCount === 1 && enabledMissionSources[source.id]
                                        ? true
                                        : !enabledMissionSources[source.id],
                                  };
                                  setEnabledMissionSources(next);
                                  applyMissionDraft({ sources: next });
                                }}
                                className={`scout-source-toggle ${
                                  enabledMissionSources[source.id] ? "active" : ""
                                }`}
                              >
                                {source.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="scout-builder-label">Timeframe</p>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {urgencyOptions.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => {
                                  setMissionUrgency(option.id);
                                  applyMissionDraft({ urgency: option.id });
                                }}
                                className={`scout-source-toggle ${
                                  missionUrgency === option.id ? "active" : ""
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => applyMissionDraft()}
                          className="w-full rounded-xl bg-ts-orange px-3 py-2.5 text-sm font-semibold text-white"
                        >
                          Start search
                        </button>
                      </div>
                    </div>
                  </div>
                </details>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMissionPanel("people");
                    applyMissionDraft({ panel: "people" });
                  }}
                  className="scout-v2-rail-card text-left"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ts-orange">
                    Review before contact
                  </p>
                  <div
                    className="mt-4 rounded-xl border p-4 text-sm leading-6"
                    style={{
                      borderColor: "var(--border-subtle)",
                      backgroundColor: "var(--surface-intermediate)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <p>Search first before you make yourself visible.</p>
                    <p className="mt-2">1. Find the best matches</p>
                    <p>2. Compare what matters</p>
                    <p>3. Choose a safe next step</p>
                  </div>
                </button>
              </aside>
            )}
          </div>
        </div>
      </div>

      <AlertDialog
        open={dcConfirmOpen}
        onOpenChange={(open) => {
          if (dcBusy) return;
          setDcConfirmOpen(open);
          if (!open) setDcDraft(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create this local request?</AlertDialogTitle>
            <AlertDialogDescription>
              This request stays in review until you choose to share it with local pros.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-3 rounded-md border p-3 text-sm">
            <div className="font-medium">{dcDraft?.title || "New request"}</div>
            <div className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
              {dcDraft?.description ? String(dcDraft.description).slice(0, 600) : ""}
              {dcDraft?.description && String(dcDraft.description).length > 600 ? "..." : ""}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={dcBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={dcBusy || !dcDraft}
              onClick={async (e) => {
                e.preventDefault();
                if (!dcDraft || dcBusy) return;

                setDcBusy(true);
                try {
                  const payload: any = {
                    title: dcDraft.title,
                    description: dcDraft.description,
                    ...(dcDraft.tradeId ? { tradeId: dcDraft.tradeId } : {}),
                    ...(typeof dcDraft.budgetMin === "number"
                      ? { budgetMin: dcDraft.budgetMin }
                      : {}),
                    ...(typeof dcDraft.budgetMax === "number"
                      ? { budgetMax: dcDraft.budgetMax }
                      : {}),
                    ...(dcDraft.countyFips ? { countyFips: dcDraft.countyFips } : {}),
                    ...(dcDraft.stateCode ? { stateCode: dcDraft.stateCode } : {}),
                  };

                  const res: any = await apiRequest(
                    "POST",
                    "/api/direct-connect/requests",
                    payload
                  );

                  // Verification gate returns HTTP 200 with actions + retry metadata.
                  if (res && typeof res === "object" && (res as any).verificationRequired) {
                    const msg: ScoutMessage = {
                      id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                      role: "assistant",
                      content:
                        typeof (res as any).message === "string" && (res as any).message.trim()
                          ? String((res as any).message)
                          : "Before I can post that request, you need to verify a requirement.",
                      timestamp: new Date().toISOString(),
                      clusters: [
                        {
                          id: `dc-verify-${Date.now()}`,
                          title: "Next step",
                          kind: "generic",
                          body: "Complete verification, then retry posting the request.",
                          primaryAction:
                            Array.isArray((res as any).actions) && (res as any).actions.length > 0
                              ? ((res as any).actions[0] as any)
                              : {
                                  type: "NAVIGATE",
                                  label: "Open verification",
                                  to: "/verification",
                                },
                        } as any,
                      ],
                    };

                    applyServerResponse(
                      msg,
                      Array.isArray((res as any).actions) ? (res as any).actions : []
                    );
                    return;
                  }

                  const createdId =
                    typeof (res as any)?.id === "string" ? String((res as any).id) : null;
                  const msg: ScoutMessage = {
                    id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                    role: "assistant",
                    content: "Saved. Want to review it before sharing?",
                    timestamp: new Date().toISOString(),
                    clusters: [
                      {
                        id: `dc-created-${Date.now()}`,
                        title: "Saved local request",
                        kind: "generic",
                        body: createdId
                          ? "Your request is saved. Review it before you share it locally."
                          : "Your request is saved. Review it before you share it locally.",
                        primaryAction: {
                          type: "NAVIGATE",
                          label: "Open local requests",
                          to: "/direct-connect",
                        },
                      },
                    ],
                  };

                  applyServerResponse(msg, [
                    { type: "NAVIGATE", label: "Open local requests", to: "/direct-connect" },
                  ]);

                  recordActivity({
                    type: "direct_connect_request_created",
                    ts: new Date().toISOString(),
                    path: location,
                    meta: { workRequestId: createdId || undefined },
                  } as any);
                } catch (err: any) {
                  const message = formatUserFacingErrorMessage(
                    err,
                    "Could not create the local request."
                  );
                  setError(message);
                } finally {
                  setDcBusy(false);
                  setDcConfirmOpen(false);
                  setDcDraft(null);
                }
              }}
            >
              {dcBusy ? "Saving..." : "Create request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tools & App drawer */}
      <ScoutToolsDrawer
        isOpen={toolsOpen}
        onClose={() => setToolsOpen(false)}
        onOpenWorkArea={(opts) => openWorkArea({ url: opts.url, title: opts.title })}
      />

      <ScoutWorkAreaSheet
        open={workAreaOpen}
        onOpenChange={setWorkAreaOpen}
        url={workAreaUrl}
        title={workAreaTitle}
      />
    </div>
  );
}
