import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

type LiveStreamItem = {
  id: string;
  timestamp: string;
  kind: string;
  priority: "critical" | "high" | "medium" | "low";
  truthStatus?: "current" | "stale";
  title: string;
  narrative: string;
  source: string;
  lane?: string;
  signalClass?: string;
  baselineDeltaPct?: number;
  category?: string;
  county?: string;
  state?: string;
  commercialBucket?:
    | "ad plays"
    | "advertiser pitches"
    | "market moves"
    | "monetization leaks"
    | "watchlist";
  recommendedPlay?: string;
  salesAngle?: string;
  targetMarket?: string;
  monetizationStage?: "spend" | "sell" | "expand" | "repair" | "watch";
  channelSuggestion?: string;
  assetSuggestion?: string;
  whyNow?: string;
  inventorySummary?: string;
  exampleBusinesses?: Array<{
    name: string;
    slug: string | null;
  }>;
  prospectSummary?: string;
  prospectClasses?: Array<{
    label: string;
    count: number;
  }>;
  marketGapSummary?: string;
  revenueScore?: number;
  evidence?: string[];
};

type LiveStreamResponse = {
  generatedAt: string;
  filters?: {
    source: string | null;
    stateCode: string | null;
    county: string | null;
    limit: number;
  };
  summary: {
    truthNow: string;
    currentLeadCounty: string | null;
    currentLeadState: string | null;
    crawlerRequests24h: number;
    activeAlerts: number;
    botCrawlSignals?: number;
    topBotCrawlHeadline?: string | null;
    sourceCounts: Record<string, number>;
    degradedSources?: string[];
    degradedSourceReasons?: Record<string, string>;
  };
  stream: LiveStreamItem[];
};

type LiveStreamHistoryResponse = {
  history: LiveStreamResponse[];
};

type LiveLaneEvent = {
  id: string;
  occurredAt: string;
  lane: string;
  source: string;
  eventType: string;
  stateCode: string | null;
  countyName: string | null;
  countyFips: string | null;
  payload: Record<string, unknown>;
};

type LiveLaneEventResponse = {
  generatedAt: string;
  filters: {
    lane: string | null;
    source: string | null;
    stateCode: string | null;
    county: string | null;
    since: string | null;
    cursor: string | null;
    limit: number;
  };
  events: LiveLaneEvent[];
  nextCursor: string | null;
};

type BotArmySprintQueueItem = {
  id: string;
  route: string;
  failureType: string;
  severity: number;
  occurrences: number;
  latestAt: string;
  score: number;
  observedFact: string;
  recommendedAction: string;
  riskIfIgnored: string;
};

type BotArmySprintQueueResponse = {
  generatedAt: string;
  lookbackHours: number;
  limit: number;
  queue: BotArmySprintQueueItem[];
};

type BotArmyAutoPromotionResult = {
  generatedAt: string;
  lookbackHours: number;
  limit: number;
  minScore: number;
  candidatesEvaluated: number;
  promotedCount: number;
  skippedLowScoreCount: number;
  skippedResolvedCount: number;
};

type BotArmyAutoPromotionStatusResponse = {
  enabled: boolean;
  schedulerActive: boolean;
  schedule: string;
  settings: {
    lookbackHours: number;
    limit: number;
    minScore: number;
  };
};

type SnapshotStatusResponse = {
  generatedAt: string;
  schedulerEnabled: boolean;
  statuses: Array<{
    key: string;
    label: string;
    latestComputedAt: string | null;
    rowCount: number;
    staleAfterMinutes: number;
    isStale: boolean;
  }>;
};

type CrawlerTelemetrySummary = {
  generatedAt: string;
  totals24h: {
    total: number;
    ok: number;
    clientError: number;
    serverError: number;
  };
  topBots: Array<{
    botName: string;
    requestCount: number;
  }>;
  topRoutes: Array<{
    path: string;
    requestCount: number;
  }>;
  topSurfaces: Array<{
    sourceSurface: string;
    requestCount: number;
  }>;
  topCounties: Array<{
    countyName: string;
    stateCode: string | null;
    countyFips: string | null;
    sourceSurface: string;
    requestCount: number;
  }>;
  requestTypes: Array<{
    requestType: string;
    requestCount: number;
  }>;
  hourlyBuckets: Array<{
    bucketStart: string;
    total: number;
    ok: number;
    clientError: number;
    serverError: number;
  }>;
};

function getFilenameFromHeader(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = /filename="?([^"]+)"?/i.exec(headerValue);
  if (!match?.[1]) return null;
  return match[1];
}

const priorityTone: Record<LiveStreamItem["priority"], string> = {
  critical: "bg-red-600/20 text-red-200 border-red-500/30",
  high: "bg-orange-600/20 text-orange-200 border-orange-500/30",
  medium: "bg-blue-600/20 text-blue-200 border-blue-500/30",
  low: "bg-white/10 text-white/70 border-white/10",
};

const truthTone: Record<"current" | "stale", string> = {
  current: "bg-emerald-600/20 text-emerald-100 border-emerald-500/30",
  stale: "bg-amber-600/20 text-amber-100 border-amber-500/30",
};

const durabilityTone: Record<"volatile" | "stable" | "persistent", string> = {
  volatile: "bg-rose-600/20 text-rose-100 border-rose-500/30",
  stable: "bg-blue-600/20 text-blue-100 border-blue-500/30",
  persistent: "bg-violet-600/20 text-violet-100 border-violet-500/30",
};

const sourceTone: Record<string, string> = {
  lisa: "border-violet-300/20 bg-violet-500/10 text-violet-50",
  crawler: "border-cyan-300/20 bg-cyan-500/10 text-cyan-50",
  crawler_request_events: "border-cyan-300/20 bg-cyan-500/10 text-cyan-50",
  alerts: "border-red-300/20 bg-red-500/10 text-red-50",
  bot_crawl_signals: "border-amber-300/20 bg-amber-500/10 text-amber-50",
  bot_ui_findings: "border-amber-300/20 bg-amber-500/10 text-amber-50",
  cumulus: "border-emerald-300/20 bg-emerald-500/10 text-emerald-50",
  scout_interactions: "border-blue-300/20 bg-blue-500/10 text-blue-50",
  tradedeals: "border-lime-300/20 bg-lime-500/10 text-lime-50",
  homescout: "border-sky-300/20 bg-sky-500/10 text-sky-50",
  observations: "border-fuchsia-300/20 bg-fuchsia-500/10 text-fuchsia-50",
  directory: "border-teal-300/20 bg-teal-500/10 text-teal-50",
};

const familyTone: Record<string, string> = {
  "site demand": "border-blue-300/20 bg-blue-500/10 text-blue-50",
  deals: "border-lime-300/20 bg-lime-500/10 text-lime-50",
  "real estate": "border-sky-300/20 bg-sky-500/10 text-sky-50",
  directory: "border-teal-300/20 bg-teal-500/10 text-teal-50",
  observations: "border-fuchsia-300/20 bg-fuchsia-500/10 text-fuchsia-50",
  partner: "border-emerald-300/20 bg-emerald-500/10 text-emerald-50",
  crawler: "border-cyan-300/20 bg-cyan-500/10 text-cyan-50",
  alerts: "border-red-300/20 bg-red-500/10 text-red-50",
  intelligence: "border-violet-300/20 bg-violet-500/10 text-violet-50",
};

const ownerTone: Record<string, string> = {
  "surface repair": "border-rose-300/20 bg-rose-500/10 text-rose-50",
  "ad launch": "border-emerald-300/20 bg-emerald-500/10 text-emerald-50",
  "advertiser sales": "border-amber-300/20 bg-amber-500/10 text-amber-50",
  "crawler ops": "border-cyan-300/20 bg-cyan-500/10 text-cyan-50",
  "market move": "border-violet-300/20 bg-violet-500/10 text-violet-50",
  "partner intel": "border-sky-300/20 bg-sky-500/10 text-sky-50",
  "sales watch": "border-white/10 bg-white/5 text-white/70",
};

const urgencyTone: Record<string, string> = {
  "drop everything": "border-red-400/30 bg-red-600/20 text-red-100",
  today: "border-orange-300/20 bg-orange-500/10 text-orange-50",
  "watch soon": "border-blue-300/20 bg-blue-500/10 text-blue-50",
};

const actionStatusTone: Record<string, string> = {
  new: "border-white/10 bg-white/5 text-white/80",
  "in progress": "border-amber-300/20 bg-amber-500/10 text-amber-50",
  cleared: "border-emerald-300/20 bg-emerald-500/10 text-emerald-50",
};

const commercialBucketTone: Record<string, string> = {
  "ad plays": "border-emerald-500/20 bg-emerald-500/10",
  "advertiser pitches": "border-amber-500/20 bg-amber-500/10",
  "market moves": "border-violet-500/20 bg-violet-500/10",
  "monetization leaks": "border-rose-500/20 bg-rose-500/10",
  watchlist: "border-white/10 bg-black/20",
};

const laneTone: Record<string, string> = {
  action: "border-blue-300/20 bg-blue-500/10 text-blue-50",
  crawl_visibility: "border-cyan-300/20 bg-cyan-500/10 text-cyan-50",
  trust: "border-amber-300/20 bg-amber-500/10 text-amber-50",
};

function resolveDurabilityClass(source: string): "volatile" | "stable" | "persistent" {
  if (source === "crawler" || source === "alerts" || source === "bot_crawl_signals") {
    return "volatile";
  }
  if (source === "cumulus") {
    return "persistent";
  }
  return "stable";
}

function resolveSignalFamily(item: Pick<LiveStreamItem, "source">): string {
  if (item.source === "scout_interactions") return "site demand";
  if (item.source === "tradedeals") return "deals";
  if (item.source === "homescout") return "real estate";
  if (item.source === "directory") return "directory";
  if (item.source === "observations") return "observations";
  if (item.source === "cumulus") return "partner";
  if (item.source === "alerts") return "alerts";
  if (item.source === "crawler" || item.source === "bot_crawl_signals") return "crawler";
  return "intelligence";
}

function resolveEntryActionHint(item: LiveStreamItem): string | null {
  if (item.salesAngle) return item.salesAngle;
  if (item.kind === "crawler_route_demand") {
    return "Use this route as a live attention pocket for ads or sales once the page can hold traffic.";
  }
  if (item.kind === "crawler_county_demand") {
    return "This county is showing real attention. Package it for ads, sponsorship, or local sales outreach.";
  }
  if (item.kind === "bot_demand_cluster") {
    return "This is a tradable demand pocket. Decide whether to run ads, sell sponsorship, or expand presence.";
  }
  if (item.kind === "alert") {
    return "Treat this as a blocker to monetizing current attention until it is resolved.";
  }
  if (item.signalClass === "attention_action_gap" || item.signalClass === "trust_friction") {
    return "This is sellable attention being slowed before action. Unblock it so ads and outreach convert.";
  }
  if (
    item.signalClass === "county_opportunity_concentration" ||
    item.signalClass === "visibility_outpacing_coverage" ||
    item.signalClass === "category_signal_concentration" ||
    item.signalClass === "category_momentum"
  ) {
    return "Turn this into a live market move while attention is present: ads, county packaging, or advertiser pitch.";
  }
  if (item.signalClass === "attention_finding_dead_ends") {
    return "Repair this dead end before it burns a monetizable attention pocket.";
  }
  return null;
}

function extractRouteTarget(item: LiveStreamItem): string | null {
  const candidates = [item.title, item.narrative];
  for (const candidate of candidates) {
    const match = candidate.match(/(\/[A-Za-z0-9\-/_]+)/);
    if (match?.[1]) return match[1];
  }
  return null;
}

function resolveEntryActionTask(item: LiveStreamItem): string | null {
  if (item.recommendedPlay) return item.recommendedPlay;
  const countyLabel =
    item.county && item.state ? `${item.county}, ${item.state}` : item.county || item.state || null;
  const routeTarget = extractRouteTarget(item);
  const categoryLabel = item.category || "this category";

  if (item.kind === "crawler_route_demand") {
    return routeTarget
      ? `Open an ad or sponsor play on ${routeTarget}, but repair or redirect it first so the traffic can be monetized.`
      : "Repair the highest-pressure route, then turn that attention into an ad or sponsor play.";
  }
  if (item.kind === "alert") {
    return "Clear this blocker now so current attention can be monetized safely.";
  }
  if (
    item.signalClass === "repair_pressure" ||
    item.signalClass === "attention_finding_dead_ends"
  ) {
    return routeTarget
      ? `Fix the dead end on ${routeTarget}, then route that attention into a sellable surface.`
      : "Fix the broken path and reroute that attention into a sellable surface.";
  }
  if (item.kind === "crawler_county_demand") {
    return countyLabel
      ? `Launch a county ad push or local sales package for ${countyLabel} while demand is active.`
      : "Launch a county-level ad or sales move where demand is concentrating.";
  }
  if (item.kind === "bot_demand_cluster") {
    return countyLabel
      ? `Pitch ${categoryLabel} advertisers and expand paid presence in ${countyLabel}.`
      : `Pitch ${categoryLabel} advertisers where this cluster is forming.`;
  }
  if (item.signalClass === "attention_action_gap" || item.signalClass === "trust_friction") {
    return countyLabel
      ? `Unblock conversion on ${categoryLabel} in ${countyLabel} so ad spend and outreach pay off.`
      : `Unblock conversion on ${categoryLabel} so ad spend and outreach pay off.`;
  }
  if (
    item.signalClass === "county_opportunity_concentration" ||
    item.signalClass === "visibility_outpacing_coverage" ||
    item.signalClass === "category_signal_concentration" ||
    item.signalClass === "category_momentum"
  ) {
    return countyLabel
      ? `Use ${categoryLabel} demand in ${countyLabel} to open an ad, sales, or category expansion move.`
      : `Use ${categoryLabel} demand to open an ad, sales, or category expansion move.`;
  }
  return null;
}

function resolveEntryOwner(item: LiveStreamItem): string {
  if (
    item.kind === "crawler_route_demand" ||
    item.kind === "alert" ||
    item.signalClass === "repair_pressure" ||
    item.signalClass === "attention_finding_dead_ends"
  ) {
    return "surface repair";
  }
  if (
    item.kind === "crawler_county_demand" ||
    item.signalClass === "county_opportunity_concentration" ||
    item.signalClass === "visibility_outpacing_coverage"
  ) {
    return "ad launch";
  }
  if (item.signalClass === "attention_action_gap" || item.signalClass === "trust_friction") {
    return "advertiser sales";
  }
  if (
    item.kind === "crawler_volume" ||
    item.kind === "crawler_top_bot" ||
    item.source === "crawler"
  ) {
    return "crawler ops";
  }
  if (
    item.kind === "bot_demand_cluster" ||
    item.signalClass === "category_signal_concentration" ||
    item.signalClass === "category_momentum"
  ) {
    return "market move";
  }
  if (item.source === "cumulus") {
    return "partner intel";
  }
  return "sales watch";
}

function resolveEntryUrgency(item: Pick<LiveStreamItem, "priority" | "truthStatus">): string {
  if (item.priority === "critical") return "drop everything";
  if (item.priority === "high" || item.truthStatus === "stale") return "today";
  return "watch soon";
}

function resolveEntryCommercialBucket(item: LiveStreamItem): string {
  if (item.commercialBucket) return item.commercialBucket;
  const signalClass = item.signalClass || "";
  if (
    item.kind === "alert" ||
    signalClass === "repair_pressure" ||
    signalClass === "attention_finding_dead_ends" ||
    signalClass === "attention_action_gap" ||
    signalClass === "trust_friction"
  ) {
    return "monetization leaks";
  }
  if (
    item.kind === "crawler_county_demand" ||
    signalClass === "county_opportunity_concentration" ||
    signalClass === "visibility_outpacing_coverage"
  ) {
    return "ad plays";
  }
  if (
    item.kind === "bot_demand_cluster" ||
    signalClass === "category_signal_concentration" ||
    signalClass === "category_momentum" ||
    item.source === "cumulus"
  ) {
    return "advertiser pitches";
  }
  if (
    item.kind === "crawler_route_demand" ||
    item.kind === "crawler_volume" ||
    item.kind === "crawler_top_bot" ||
    item.source === "crawler"
  ) {
    return "market moves";
  }
  return "watchlist";
}

function resolveBiggestLeak(args: {
  topWaste: LiveStreamItem | null | undefined;
  topFriction: LiveStreamItem | null | undefined;
  firstRepairRoute: { path: string; requestCount: number } | null | undefined;
}): string {
  if (args.topWaste) return args.topWaste.title;
  if (args.topFriction) return args.topFriction.title;
  if (args.firstRepairRoute) {
    return `${args.firstRepairRoute.path} is taking ${args.firstRepairRoute.requestCount} requests before monetization`;
  }
  return "No major monetization leak surfaced yet";
}

function splitDecisionNarrative(narrative?: string | null): {
  what: string;
  why: string;
  doNext: string;
} {
  const raw = String(narrative || "").trim();
  const [whatPart, restAfterWhyMarker] = raw.split(" Why it matters: ");
  const [whyPart, doNextPart] = (restAfterWhyMarker || "").split(" What to do: ");
  return {
    what: whatPart?.trim() || raw,
    why: whyPart?.trim() || raw,
    doNext: doNextPart?.trim() || "",
  };
}

function humanizeSurfaceLabel(surface: string): string {
  const labels: Record<string, string> = {
    public_business: "Business pages",
    static_asset: "Static assets",
    trade_county_page: "Trade county pages",
    trade_region_page: "Trade region pages",
    county_page: "County pages",
    county_recent: "County recents",
    public_profile: "Public profiles",
    commerce_surface: "Commerce surfaces",
    public_marketing: "Marketing pages",
    tradepartners: "Trade partner pages",
    homescout_listings: "HomeScout listings",
    community: "Community",
    exchange: "Exchange",
    trade_deals: "Trade deals",
    direct_connect: "Direct Connect",
    scout: "Scout",
    infra: "Infrastructure",
    crawl_meta: "Crawler metadata",
    other: "Unattributed",
    unknown_public: "Unknown public pages",
  };

  return (
    labels[surface] ||
    surface
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function buildUsefulSignalSummary(item: LiveStreamItem): {
  headline: string;
  marketSignal: string;
  inventory?: string;
  prospects?: string;
  trigger?: string;
  action: string;
} {
  const parts = splitDecisionNarrative(item.narrative);
  const evidence = Array.isArray(item.evidence) ? item.evidence : [];
  const readEvidence = (key: string): string | null => {
    const match = evidence.find((entry) => entry.startsWith(`${key}=`));
    if (!match) return null;
    return match.slice(key.length + 1);
  };
  const path = readEvidence("top_path") || readEvidence("path") || readEvidence("broken_path");
  const routeFamily = readEvidence("route_family");
  const botFamily = readEvidence("bot_family");
  const hits =
    readEvidence("hits") ||
    readEvidence("machine_attention_hits") ||
    readEvidence("request_count") ||
    readEvidence("county_surface_requests") ||
    readEvidence("crawler_requests_24h");
  const recrawls = readEvidence("recrawls");
  const firstSeen = readEvidence("first_seen_urls");
  const notFound = readEvidence("status_404_count") || readEvidence("missing_count");
  const triggerParts = [
    path && path !== "none" ? `path ${path}` : null,
    routeFamily ? `surface ${routeFamily.replace(/_/g, " ")}` : null,
    botFamily ? `bot ${botFamily}` : null,
    hits ? `${hits} hits` : null,
    recrawls ? `${recrawls} recrawls` : null,
    firstSeen ? `${firstSeen} new URLs` : null,
    notFound ? `${notFound} missing/404` : null,
  ].filter(Boolean);
  const marketSignal =
    item.marketGapSummary || item.whyNow || parts.what || item.salesAngle || item.narrative;
  const inventory =
    item.inventorySummary && item.inventorySummary !== item.marketGapSummary
      ? item.inventorySummary
      : undefined;
  const prospects = item.prospectSummary || parts.why || undefined;
  const headline = path || item.targetMarket || item.title;
  return {
    headline,
    marketSignal,
    inventory,
    prospects,
    trigger: triggerParts.length ? triggerParts.join(" | ") : undefined,
    action:
      item.recommendedPlay ||
      parts.doNext ||
      resolveEntryActionTask(item) ||
      resolveEntryActionHint(item) ||
      "Monitor this signal and decide the next operator move.",
  };
}

function SignalBoardPanel({
  title,
  subtitle,
  badge,
  toneClass,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  toneClass?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border p-4", toneClass || "border-white/10 bg-black/20")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-white/55">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-white/72">{subtitle}</div> : null}
        </div>
        {badge ? <Badge variant="outline">{badge}</Badge> : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function BriefTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/48">{label}</div>
      <div className="mt-1 text-sm text-white/92">{value}</div>
      {detail ? <div className="mt-1 text-xs text-white/68">{detail}</div> : null}
    </div>
  );
}

function buildEntryContextTokens(item: LiveStreamItem): string[] {
  const tokens: string[] = [];
  if (item.county) tokens.push(item.county);
  if (item.state) tokens.push(item.state);
  if (item.category) tokens.push(item.category);
  if (item.monetizationStage) tokens.push(`stage:${item.monetizationStage}`);
  if (item.lane) tokens.push(`lane:${item.lane}`);
  if (item.signalClass) tokens.push(`signal:${item.signalClass}`);
  return tokens;
}

function formatEventPayloadValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "n/a";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.join(", ");
  return JSON.stringify(value);
}

function summarizeLaneEvent(event: LiveLaneEvent): {
  title: string;
  narrative: string;
  details: string[];
} {
  if (event.source === "scout_interactions") {
    const intent = formatEventPayloadValue(event.payload.intent);
    const outcome = formatEventPayloadValue(event.payload.outcome);
    const failureReason = formatEventPayloadValue(event.payload.failureReason);
    return {
      title: `Scout interaction: ${intent}`,
      narrative: `${event.countyName || event.countyFips || "Unknown county"}${event.stateCode ? `, ${event.stateCode}` : ""} produced a scout action event with outcome ${outcome}.`,
      details: [
        `Outcome: ${outcome}`,
        `Failure: ${failureReason}`,
        `Confidence: ${formatEventPayloadValue(event.payload.confidence)}`,
        `User role: ${formatEventPayloadValue(event.payload.userRole)}`,
      ],
    };
  }

  if (event.source === "crawler_request_events") {
    const path = formatEventPayloadValue(event.payload.path);
    const statusCode = formatEventPayloadValue(event.payload.statusCode);
    const botName = formatEventPayloadValue(event.payload.botName);
    return {
      title: `Crawler request: ${path}`,
      narrative: `${botName} hit ${path} with status ${statusCode}.`,
      details: [
        `Status class: ${formatEventPayloadValue(event.payload.statusClass)}`,
        `Surface: ${formatEventPayloadValue(event.payload.sourceSurface)}`,
        `Request type: ${formatEventPayloadValue(event.payload.requestType)}`,
      ],
    };
  }

  const route = formatEventPayloadValue(event.payload.route);
  const failureType = formatEventPayloadValue(event.payload.failureType);
  const severity = formatEventPayloadValue(event.payload.severity);
  return {
    title: `UI finding: ${failureType}`,
    narrative: `${route} surfaced a ${severity} trust event.`,
    details: [
      `Bot: ${formatEventPayloadValue(event.payload.botName)}`,
      `Action attempted: ${formatEventPayloadValue(event.payload.actionAttempted)}`,
      `Expected: ${formatEventPayloadValue(event.payload.expectedOutcome)}`,
      `Actual: ${formatEventPayloadValue(event.payload.actualOutcome)}`,
    ],
  };
}

function StreamEntryCard({ item, compact = false }: { item: LiveStreamItem; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const truthStatus = item.truthStatus === "current" ? "current" : "stale";
  const durabilityClass = resolveDurabilityClass(item.source);
  const actionHint = resolveEntryActionHint(item);
  const contextTokens = buildEntryContextTokens(item);
  const owner = resolveEntryOwner(item);
  const urgency = resolveEntryUrgency(item);
  const signalFamily = resolveSignalFamily(item);

  return (
    <div className={cn("rounded-lg border border-white/10 bg-black/20", compact ? "p-3" : "p-3")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "uppercase tracking-[0.18em]",
                sourceTone[item.source] || "border-white/10 text-white/60"
              )}
            >
              {item.source.replaceAll("_", " ")}
            </Badge>
            <Badge className={familyTone[signalFamily] || familyTone.intelligence}>
              {signalFamily}
            </Badge>
            {item.kind ? (
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                {item.kind.replaceAll("_", " ")}
              </span>
            ) : null}
          </div>
          <div className={cn("mt-2 font-semibold text-white", compact ? "text-xs" : "text-sm")}>
            {item.title}
          </div>
        </div>
        <div className="text-xs text-white/50">{new Date(item.timestamp).toLocaleString()}</div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {typeof item.revenueScore === "number" ? (
          <Badge className="border-emerald-300/20 bg-emerald-500/10 text-emerald-50">
            score {item.revenueScore}
          </Badge>
        ) : null}
        <Badge className={priorityTone[item.priority]}>{item.priority}</Badge>
        <Badge className={urgencyTone[urgency]}>{urgency}</Badge>
        <Badge className={truthTone[truthStatus]}>{truthStatus}</Badge>
        <Badge className={durabilityTone[durabilityClass]}>{durabilityClass}</Badge>
        <Badge className={ownerTone[owner] || ownerTone["sales watch"]}>{owner}</Badge>
        {contextTokens.map((token) => (
          <Badge
            key={`${item.id}:${token}`}
            variant="outline"
            className="border-white/10 text-white/60"
          >
            {token}
          </Badge>
        ))}
      </div>

      <div className={cn("mt-2 text-white/80", compact ? "text-xs" : "text-sm")}>
        {item.whyNow || item.narrative}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-white/65">
          {item.recommendedPlay
            ? `Next action: ${item.recommendedPlay}`
            : actionHint
              ? `Revenue angle: ${actionHint}`
              : "No immediate action tagged"}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 border-white/15 text-[11px] text-white/75"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Collapse" : "Expand"}
        </Button>
      </div>

      {expanded &&
      (item.recommendedPlay ||
        item.targetMarket ||
        item.salesAngle ||
        item.channelSuggestion ||
        item.assetSuggestion ||
        item.inventorySummary ||
        item.marketGapSummary ||
        item.prospectSummary) ? (
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {item.recommendedPlay ? (
            <div className="rounded-md border border-emerald-400/15 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-50">
              <div className="uppercase tracking-[0.18em] text-emerald-100/60">Next action</div>
              <div className="mt-1">{item.recommendedPlay}</div>
            </div>
          ) : null}
          {item.targetMarket ? (
            <div className="rounded-md border border-sky-400/15 bg-sky-500/10 px-3 py-2 text-xs text-sky-50">
              <div className="uppercase tracking-[0.18em] text-sky-100/60">Target</div>
              <div className="mt-1">{item.targetMarket}</div>
            </div>
          ) : null}
          {item.salesAngle ? (
            <div className="rounded-md border border-violet-400/15 bg-violet-500/10 px-3 py-2 text-xs text-violet-50">
              <div className="uppercase tracking-[0.18em] text-violet-100/60">Revenue angle</div>
              <div className="mt-1">{item.salesAngle}</div>
            </div>
          ) : null}
          {item.channelSuggestion ? (
            <div className="rounded-md border border-cyan-400/15 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-50">
              <div className="uppercase tracking-[0.18em] text-cyan-100/60">Channel</div>
              <div className="mt-1">{item.channelSuggestion}</div>
            </div>
          ) : null}
          {item.assetSuggestion ? (
            <div className="rounded-md border border-lime-400/15 bg-lime-500/10 px-3 py-2 text-xs text-lime-50">
              <div className="uppercase tracking-[0.18em] text-lime-100/60">Asset</div>
              <div className="mt-1">{item.assetSuggestion}</div>
            </div>
          ) : null}
          {item.inventorySummary ? (
            <div className="rounded-md border border-amber-400/15 bg-amber-500/10 px-3 py-2 text-xs text-amber-50">
              <div className="uppercase tracking-[0.18em] text-amber-100/60">Inventory</div>
              <div className="mt-1">{item.inventorySummary}</div>
            </div>
          ) : null}
          {item.marketGapSummary ? (
            <div className="rounded-md border border-rose-400/15 bg-rose-500/10 px-3 py-2 text-xs text-rose-50">
              <div className="uppercase tracking-[0.18em] text-rose-100/60">Conversion leaks</div>
              <div className="mt-1">{item.marketGapSummary}</div>
            </div>
          ) : null}
          {item.prospectSummary ? (
            <div className="rounded-md border border-fuchsia-400/15 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-50">
              <div className="uppercase tracking-[0.18em] text-fuchsia-100/60">Buyer classes</div>
              <div className="mt-1">{item.prospectSummary}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LaneEventCard({ event }: { event: LiveLaneEvent }) {
  const [expanded, setExpanded] = useState(false);
  const summary = summarizeLaneEvent(event);
  const locationLabel = [event.countyName || event.countyFips, event.stateCode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={laneTone[event.lane] || "border-white/10 bg-white/5 text-white/75"}>
              {event.lane.replaceAll("_", " ")}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "uppercase tracking-[0.18em]",
                sourceTone[event.source] || "border-white/10 text-white/60"
              )}
            >
              {event.source.replaceAll("_", " ")}
            </Badge>
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              {event.eventType.replaceAll("_", " ")}
            </span>
          </div>
          <div className="mt-2 text-sm font-semibold text-white">{summary.title}</div>
          <div className="mt-1 text-xs text-white/75">{summary.narrative}</div>
        </div>
        <div className="text-right text-xs text-white/50">
          <div>{new Date(event.occurredAt).toLocaleString()}</div>
          {locationLabel ? <div className="mt-1">{locationLabel}</div> : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {event.countyFips ? (
            <Badge variant="outline" className="border-white/10 text-white/60">
              FIPS {event.countyFips}
            </Badge>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 border-white/15 text-[11px] text-white/75"
          onClick={() => setExpanded((previous) => !previous)}
        >
          {expanded ? "Collapse" : "Expand"}
        </Button>
      </div>

      {expanded ? (
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {summary.details.map((detail) => (
            <div
              key={`${event.id}-${detail}`}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75"
            >
              {detail}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminLiveStreamPage() {
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const [source, setSource] = useState("all");
  const [sourceFamilyFilter, setSourceFamilyFilter] = useState("all");
  const [truthFilter, setTruthFilter] = useState("all");
  const [durabilityFilter, setDurabilityFilter] = useState("all");
  const [stateCode, setStateCode] = useState("all");
  const [county, setCounty] = useState("all");
  const [limit, setLimit] = useState("20");
  const [historyDays, setHistoryDays] = useState("7");
  const [eventLane, setEventLane] = useState("all");
  const [eventSource, setEventSource] = useState("all");
  const [eventSinceHours, setEventSinceHours] = useState("24");
  const [eventCursorTrail, setEventCursorTrail] = useState<Array<string | null>>([null]);
  const [eventPageIndex, setEventPageIndex] = useState(0);
  const [derivedFocus, setDerivedFocus] = useState<"all" | "opportunity" | "friction" | "waste">(
    "all"
  );
  const [marketFilter, setMarketFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [copyStatus, setCopyStatus] = useState("");
  const [expandedHistorySnapshot, setExpandedHistorySnapshot] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [actionStatuses, setActionStatuses] = useState<
    Record<string, "new" | "in progress" | "cleared">
  >({});
  const [promotingItemId, setPromotingItemId] = useState<string | null>(null);
  const [promotionMessage, setPromotionMessage] = useState("");
  const [promotionError, setPromotionError] = useState("");
  const [autoPromoting, setAutoPromoting] = useState(false);
  const [autoPromotionMessage, setAutoPromotionMessage] = useState("");
  const [autoPromotionError, setAutoPromotionError] = useState("");
  const [uiMode, setUiMode] = useState<"ops" | "feed" | "debug">("ops");
  const presentationMode = useMemo(() => {
    const rawQuery = location.includes("?") ? location.split("?")[1] || "" : "";
    return new URLSearchParams(rawQuery).get("presentationMode") === "1";
  }, [location]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", limit || "20");
    if (source !== "all") params.set("source", source);
    if (stateCode !== "all") params.set("stateCode", stateCode);
    if (county !== "all") params.set("county", county);
    return params.toString();
  }, [source, stateCode, county, limit]);

  const historyQueryString = useMemo(() => {
    const params = new URLSearchParams(queryString);
    const normalizedHistoryDays = Math.min(
      30,
      Math.max(1, Number.parseInt(historyDays || "7", 10) || 7)
    );
    params.set("lookbackDays", String(normalizedHistoryDays));
    return params.toString();
  }, [queryString, historyDays]);

  const eventQueryString = useMemo(() => {
    const params = new URLSearchParams();
    const activeEventCursor = eventCursorTrail[eventPageIndex] || null;
    params.set("mode", "events");
    params.set("limit", limit || "250");
    if (eventLane !== "all") params.set("lane", eventLane);
    if (eventSource !== "all") params.set("source", eventSource);
    if (stateCode !== "all") params.set("stateCode", stateCode);
    if (county !== "all") params.set("county", county);

    const normalizedSinceHours = Math.max(1, Number.parseInt(eventSinceHours || "24", 10) || 24);
    const sinceDate = new Date(Date.now() - normalizedSinceHours * 60 * 60 * 1000);
    params.set("since", sinceDate.toISOString());
    if (activeEventCursor) params.set("cursor", activeEventCursor);
    return params.toString();
  }, [
    county,
    eventCursorTrail,
    eventLane,
    eventPageIndex,
    eventSinceHours,
    eventSource,
    limit,
    stateCode,
  ]);

  const { data, isLoading, error } = useQuery<LiveStreamResponse>({
    queryKey: ["/api/admin/observability/live-stream", queryString],
    queryFn: async () => {
      const response = await fetch(`/api/admin/observability/live-stream?${queryString}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch live stream");
      }
      return response.json();
    },
    refetchInterval: 10000,
  });

  const {
    data: eventData,
    isLoading: isEventLoading,
    error: eventError,
  } = useQuery<LiveLaneEventResponse>({
    queryKey: ["/api/admin/observability/live-stream/events", eventQueryString],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/observability/live-stream/events?${eventQueryString}`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch live events");
      }
      return response.json();
    },
    enabled: uiMode === "feed",
    refetchInterval: 10000,
  });

  const { data: historyData } = useQuery<LiveStreamHistoryResponse>({
    queryKey: ["/api/admin/observability/live-stream/history", historyQueryString],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/observability/live-stream/history?${historyQueryString}`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch live stream history");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  const filteredStream = useMemo(() => {
    return (data?.stream || []).filter((item) => {
      const truthStatus = item.truthStatus === "current" ? "current" : "stale";
      const durabilityClass = resolveDurabilityClass(item.source);
      const family = resolveSignalFamily(item);
      const truthMatch = truthFilter === "all" || truthStatus === truthFilter;
      const durabilityMatch = durabilityFilter === "all" || durabilityClass === durabilityFilter;
      const familyMatch = sourceFamilyFilter === "all" || family === sourceFamilyFilter;
      return truthMatch && durabilityMatch && familyMatch;
    });
  }, [data?.stream, truthFilter, durabilityFilter, sourceFamilyFilter]);

  const liveEvents = eventData?.events || [];
  const eventLaneBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of liveEvents) {
      counts.set(event.lane, (counts.get(event.lane) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  }, [liveEvents]);
  const eventSourceBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of liveEvents) {
      counts.set(event.source, (counts.get(event.source) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  }, [liveEvents]);

  const { data: snapshotStatus } = useQuery<SnapshotStatusResponse>({
    queryKey: ["/api/admin/observability/snapshot-status"],
    queryFn: async () => {
      const response = await fetch("/api/admin/observability/snapshot-status", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch snapshot status");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: crawlerTelemetry } = useQuery<CrawlerTelemetrySummary>({
    queryKey: ["/api/admin/observability/crawler-telemetry"],
    queryFn: async () => {
      const response = await fetch("/api/admin/observability/crawler-telemetry", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch crawler telemetry");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: botArmySprintQueue } = useQuery<BotArmySprintQueueResponse>({
    queryKey: ["/api/admin/mission-control/bot-army/sprint-queue", "lookback=6", "limit=25"],
    queryFn: async () => {
      const response = await fetch(
        "/api/admin/mission-control/bot-army/sprint-queue?lookbackHours=6&limit=25",
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch Bot Army sprint queue");
      }
      return response.json();
    },
    enabled: uiMode === "ops",
    refetchInterval: 15000,
  });

  const { data: botArmyAutoPromotionStatus } = useQuery<BotArmyAutoPromotionStatusResponse>({
    queryKey: ["/api/admin/mission-control/bot-army/auto-promote/status"],
    queryFn: async () => {
      const response = await fetch("/api/admin/mission-control/bot-army/auto-promote/status", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch Bot Army auto-promotion status");
      }
      return response.json();
    },
    enabled: uiMode === "ops",
    refetchInterval: 30000,
  });

  const liveStreamStatus = snapshotStatus?.statuses.find((entry) => entry.key === "live_stream");
  const visibleEntryCount = filteredStream.length;
  const snapshotAgeMinutes = useMemo(() => {
    if (!data?.generatedAt) return null;
    const generatedAtMs = new Date(data.generatedAt).getTime();
    if (!Number.isFinite(generatedAtMs)) return null;
    return Math.max(0, Math.round((Date.now() - generatedAtMs) / 60000));
  }, [data?.generatedAt]);
  const degradedSourceEntries = useMemo(() => {
    return Object.entries(data?.summary.degradedSourceReasons || {});
  }, [data?.summary.degradedSourceReasons]);
  const degradedSources = data?.summary.degradedSources || [];
  const topRouteDemand = (data?.stream || []).find((item) => item.kind === "crawler_route_demand");
  const topCountyDemand = (data?.stream || []).find(
    (item) => item.kind === "crawler_county_demand"
  );
  const topBotDemandCluster = (data?.stream || []).find(
    (item) => item.kind === "bot_demand_cluster"
  );
  const topSurfaceBreakdown = useMemo(() => {
    return (crawlerTelemetry?.topSurfaces || []).slice(0, 6);
  }, [crawlerTelemetry?.topSurfaces]);
  const signalSurfaceCount = useMemo(() => {
    const signalFamilies = new Set([
      "public_business",
      "trade_county_page",
      "trade_region_page",
      "county_page",
      "county_recent",
      "public_profile",
      "commerce_surface",
      "public_marketing",
      "tradepartners",
      "homescout_listings",
      "community",
      "exchange",
      "trade_deals",
      "direct_connect",
      "scout",
    ]);
    return (crawlerTelemetry?.topSurfaces || []).reduce((sum, item) => {
      return sum + (signalFamilies.has(item.sourceSurface) ? item.requestCount : 0);
    }, 0);
  }, [crawlerTelemetry?.topSurfaces]);
  const noiseSurfaceCount = useMemo(() => {
    const noiseFamilies = new Set(["infra", "crawl_meta", "static_asset"]);
    return (crawlerTelemetry?.topSurfaces || []).reduce((sum, item) => {
      return sum + (noiseFamilies.has(item.sourceSurface) ? item.requestCount : 0);
    }, 0);
  }, [crawlerTelemetry?.topSurfaces]);
  const unknownSurfaceCount = useMemo(() => {
    return (crawlerTelemetry?.topSurfaces || []).reduce((sum, item) => {
      return (
        sum + (["other", "unknown_public"].includes(item.sourceSurface) ? item.requestCount : 0)
      );
    }, 0);
  }, [crawlerTelemetry?.topSurfaces]);
  const topUnknownSurface = useMemo(() => {
    return (crawlerTelemetry?.topSurfaces || []).find((item) =>
      ["other", "unknown_public"].includes(item.sourceSurface)
    );
  }, [crawlerTelemetry?.topSurfaces]);
  const topRepairRoutes = useMemo(() => {
    return (crawlerTelemetry?.topRoutes || []).slice(0, 5);
  }, [crawlerTelemetry?.topRoutes]);
  const topCountyDiscovery = useMemo(() => {
    return (crawlerTelemetry?.topCounties || []).slice(0, 5);
  }, [crawlerTelemetry?.topCounties]);
  const topCountyDiscoveryLead = topCountyDiscovery[0] || null;
  const internalLisaOutputs = useMemo(() => {
    return (data?.stream || []).filter((item) => item.id.startsWith("internal-lisa-"));
  }, [data?.stream]);
  const derivedIntelligenceOutputs = useMemo(() => {
    return internalLisaOutputs.filter((item) =>
      [
        "attention_action_gap",
        "visibility_outpacing_coverage",
        "county_opportunity_concentration",
        "attention_finding_dead_ends",
        "category_signal_concentration",
        "category_momentum",
        "trust_friction",
      ].includes(item.signalClass || "")
    );
  }, [internalLisaOutputs]);
  const availableMarkets = useMemo(() => {
    const set = new Set<string>();
    for (const item of derivedIntelligenceOutputs) {
      const match = item.title.match(/ in ([A-Za-z0-9 ,\-]+)\.?$/);
      if (match?.[1]) set.add(match[1].trim());
    }
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [derivedIntelligenceOutputs]);
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const item of derivedIntelligenceOutputs) {
      const text = `${item.title} ${item.narrative}`.toLowerCase();
      ["roofing", "hvac", "electrical", "plumbing", "home builder", "custom home builder"].forEach(
        (candidate) => {
          if (text.includes(candidate)) set.add(candidate);
        }
      );
    }
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [derivedIntelligenceOutputs]);
  const marketFilteredDerivedOutputs = useMemo(() => {
    const marketScoped =
      marketFilter === "all"
        ? derivedIntelligenceOutputs
        : derivedIntelligenceOutputs.filter((item) => item.title.includes(` in ${marketFilter}`));
    if (categoryFilter === "all") return marketScoped;
    return marketScoped.filter((item) =>
      `${item.title} ${item.narrative}`.toLowerCase().includes(categoryFilter)
    );
  }, [derivedIntelligenceOutputs, marketFilter, categoryFilter]);
  const rankedDerivedOutputs = useMemo(() => {
    const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 } as const;
    return [...marketFilteredDerivedOutputs].sort((a, b) => {
      const priorityDelta = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (priorityDelta !== 0) return priorityDelta;
      const baselineA = Math.abs(a.baselineDeltaPct ?? 0);
      const baselineB = Math.abs(b.baselineDeltaPct ?? 0);
      if (baselineB !== baselineA) return baselineB - baselineA;
      return a.title.localeCompare(b.title);
    });
  }, [marketFilteredDerivedOutputs]);
  const opportunityOutputs = useMemo(() => {
    return rankedDerivedOutputs.filter((item) =>
      [
        "county_opportunity_concentration",
        "visibility_outpacing_coverage",
        "category_signal_concentration",
        "category_momentum",
      ].includes(item.signalClass || "")
    );
  }, [rankedDerivedOutputs]);
  const frictionOutputs = useMemo(() => {
    return rankedDerivedOutputs.filter((item) =>
      ["attention_action_gap", "trust_friction"].includes(item.signalClass || "")
    );
  }, [rankedDerivedOutputs]);
  const wasteOutputs = useMemo(() => {
    return rankedDerivedOutputs.filter((item) =>
      ["attention_finding_dead_ends"].includes(item.signalClass || "")
    );
  }, [rankedDerivedOutputs]);
  const focusedDerivedOutputs = useMemo(() => {
    if (derivedFocus === "opportunity") return opportunityOutputs;
    if (derivedFocus === "friction") return frictionOutputs;
    if (derivedFocus === "waste") return wasteOutputs;
    return rankedDerivedOutputs;
  }, [derivedFocus, rankedDerivedOutputs, opportunityOutputs, frictionOutputs, wasteOutputs]);
  const topThreeDerivedOutputs = useMemo(
    () => rankedDerivedOutputs.slice(0, 3),
    [rankedDerivedOutputs]
  );
  const crawlerErrorTotal = useMemo(() => {
    if (!crawlerTelemetry) return 0;
    return (
      (crawlerTelemetry.totals24h?.clientError || 0) +
      (crawlerTelemetry.totals24h?.serverError || 0)
    );
  }, [crawlerTelemetry]);
  const liveStreamStateLabel = liveStreamStatus
    ? liveStreamStatus.isStale
      ? "stale"
      : "fresh"
    : "missing";
  const schedulerDisabledWarning =
    snapshotStatus &&
    snapshotStatus.schedulerEnabled === false &&
    (!liveStreamStatus || liveStreamStatus.isStale || liveStreamStateLabel === "missing");
  const topOpportunity = opportunityOutputs[0] || null;
  const topFriction = frictionOutputs[0] || null;
  const topWaste = wasteOutputs[0] || null;
  const firstRepairRoute = topRepairRoutes[0] || null;
  const primaryActionItems = useMemo(() => {
    const items: Array<{ title: string; detail: string; tone: string }> = [];
    if (crawlerErrorTotal > 0 && firstRepairRoute) {
      items.push({
        title: "Repair route first",
        detail: `${firstRepairRoute.path} is carrying ${firstRepairRoute.requestCount} recent crawler hits. Fix or redirect this route before lower-demand cleanup.`,
        tone: "border-amber-300/20 bg-amber-500/10 text-amber-50",
      });
    }
    if (topFriction) {
      items.push({
        title: "Remove contractor friction",
        detail: `${topFriction.title}. ${topFriction.narrative}`,
        tone: "border-orange-300/20 bg-orange-500/10 text-orange-50",
      });
    }
    if (topWaste) {
      items.push({
        title: "Stop wasted attention",
        detail: `${topWaste.title}. ${topWaste.narrative}`,
        tone: "border-rose-300/20 bg-rose-500/10 text-rose-50",
      });
    }
    if (unknownSurfaceCount > 0 && topUnknownSurface) {
      items.push({
        title: "Shrink attribution leakage",
        detail: `${topUnknownSurface.sourceSurface} is still holding ${topUnknownSurface.requestCount} requests. Route this traffic into a known surface family.`,
        tone: "border-fuchsia-300/20 bg-fuchsia-500/10 text-fuchsia-50",
      });
    }
    if (schedulerDisabledWarning) {
      items.push({
        title: "Restore scheduled refresh",
        detail:
          "The scheduler is disabled, so snapshot truth can go stale until a manual refresh happens.",
        tone: "border-yellow-300/20 bg-yellow-500/10 text-yellow-50",
      });
    }
    return items.slice(0, 4);
  }, [
    crawlerErrorTotal,
    firstRepairRoute,
    topFriction,
    topWaste,
    unknownSurfaceCount,
    topUnknownSurface,
    schedulerDisabledWarning,
  ]);
  const marketBriefs = useMemo(() => {
    const items: Array<{ label: string; value: string; detail?: string }> = [];
    if (topCountyDiscoveryLead) {
      items.push({
        label: "Lead county",
        value: `${topCountyDiscoveryLead.countyName}${topCountyDiscoveryLead.stateCode ? `, ${topCountyDiscoveryLead.stateCode}` : ""}`,
        detail: `${topCountyDiscoveryLead.requestCount} crawler requests on ${humanizeSurfaceLabel(topCountyDiscoveryLead.sourceSurface)}.`,
      });
    }
    if (topOpportunity) {
      const summary = buildUsefulSignalSummary(topOpportunity);
      items.push({
        label: "Strongest signal",
        value: summary.marketSignal,
        detail: summary.trigger || summary.prospects || summary.inventory,
      });
    }
    if (topBotDemandCluster) {
      const summary = buildUsefulSignalSummary(topBotDemandCluster);
      items.push({
        label: "What triggered it",
        value: summary.trigger || summary.headline,
        detail: summary.marketSignal,
      });
    }
    const biggestLeak = resolveBiggestLeak({ topWaste, topFriction, firstRepairRoute });
    if (biggestLeak) {
      items.push({
        label: "Biggest leak",
        value: biggestLeak,
        detail:
          topWaste?.narrative ||
          topFriction?.narrative ||
          (firstRepairRoute ? "This route is taking attention before it can convert." : undefined),
      });
    }
    return items.slice(0, 4);
  }, [
    firstRepairRoute,
    topBotDemandCluster,
    topCountyDiscoveryLead,
    topFriction,
    topOpportunity,
    topWaste,
  ]);

  useEffect(() => {
    if (!refreshMessage) return;
    const timeout = window.setTimeout(() => setRefreshMessage(""), 2500);
    return () => window.clearTimeout(timeout);
  }, [refreshMessage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("admin-live-stream-action-statuses");
      if (!stored) return;
      const parsed = JSON.parse(stored) as Record<string, "new" | "in progress" | "cleared">;
      setActionStatuses(parsed);
    } catch {
      // Ignore malformed local state and start clean.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "admin-live-stream-action-statuses",
      JSON.stringify(actionStatuses)
    );
  }, [actionStatuses]);

  useEffect(() => {
    if (!copyStatus) return;
    const timeout = window.setTimeout(() => setCopyStatus(""), 2500);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  useEffect(() => {
    setEventCursorTrail([null]);
    setEventPageIndex(0);
  }, [eventLane, eventSource, eventSinceHours, stateCode, county, limit]);

  const handlePresentationModeToggle = () => {
    const params = new URLSearchParams(queryString);
    if (presentationMode) {
      params.delete("presentationMode");
    } else {
      params.set("presentationMode", "1");
    }
    navigate(`/admin/live-stream?${params.toString()}`);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshMessage("");
    setRefreshError("");
    try {
      if (uiMode === "feed") {
        await queryClient.invalidateQueries({
          queryKey: ["/api/admin/observability/live-stream/events"],
        });
        setRefreshMessage("Raw event feed refreshed.");
        return;
      }

      const response = await fetch(`/api/admin/observability/live-stream/refresh?${queryString}`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to refresh live stream");
      }
      await queryClient.invalidateQueries({
        queryKey: ["/api/admin/observability/live-stream"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/admin/observability/live-stream/history"],
      });
      setRefreshMessage("Live stream refreshed.");
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Failed to refresh live stream");
    } finally {
      setRefreshing(false);
    }
  };

  const setOperatorActionStatus = (actionId: string, status: "new" | "in progress" | "cleared") => {
    setActionStatuses((current) => ({
      ...current,
      [actionId]: status,
    }));
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      const exportQuery = uiMode === "feed" ? eventQueryString : queryString;
      const response = await fetch(
        buildApiUrl(`/api/admin/observability/live-stream/export.csv?${exportQuery}`),
        {
          method: "GET",
          credentials: "include",
          headers: { Accept: "text/csv" },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to export live stream");
      }
      const blob = await response.blob();
      const headerFilename = getFilenameFromHeader(response.headers.get("content-disposition"));
      const fallbackMode = uiMode === "feed" ? "live-lane-events" : "live-stream";
      const fallbackFilename = `${fallbackMode}-${new Date().toISOString().slice(0, 10)}.csv`;
      const filename = headerFilename || fallbackFilename;
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Failed to export live stream");
    } finally {
      setExporting(false);
    }
  };

  const handleCopyDerived = async () => {
    if (!focusedDerivedOutputs.length) {
      setCopyStatus("Nothing to copy.");
      return;
    }

    const payload = focusedDerivedOutputs
      .map((item, index) => {
        const baseline =
          typeof item.baselineDeltaPct === "number"
            ? item.baselineDeltaPct >= 0
              ? `+${item.baselineDeltaPct}% vs baseline`
              : `${item.baselineDeltaPct}% vs baseline`
            : "baseline n/a";
        return `${index + 1}. ${item.title}\nPriority: ${item.priority} | ${baseline}\n${item.narrative}`;
      })
      .join("\n\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      setCopyStatus("Copied.");
    } catch {
      setCopyStatus("Copy failed.");
    }
  };

  const applyFeedPreset = (
    preset:
      | "all"
      | "urgent"
      | "crawler_ops"
      | "lisa_only"
      | "county_watch"
      | "site_demand"
      | "inventory"
      | "deals"
      | "real_estate"
  ) => {
    if (preset === "all") {
      setSource("all");
      setSourceFamilyFilter("all");
      setTruthFilter("all");
      setDurabilityFilter("all");
      setStateCode("all");
      setCounty("all");
      setLimit("20");
      return;
    }
    if (preset === "urgent") {
      setSource("all");
      setSourceFamilyFilter("all");
      setTruthFilter("current");
      setDurabilityFilter("volatile");
      setStateCode("all");
      setCounty("all");
      setLimit("15");
      return;
    }
    if (preset === "crawler_ops") {
      setSource("crawler");
      setSourceFamilyFilter("crawler");
      setTruthFilter("all");
      setDurabilityFilter("volatile");
      setStateCode("all");
      setCounty("all");
      setLimit("20");
      return;
    }
    if (preset === "lisa_only") {
      setSource("lisa");
      setSourceFamilyFilter("intelligence");
      setTruthFilter("current");
      setDurabilityFilter("all");
      setStateCode("all");
      setCounty("all");
      setLimit("20");
      return;
    }
    if (preset === "site_demand") {
      setSource("all");
      setSourceFamilyFilter("site demand");
      setTruthFilter("current");
      setDurabilityFilter("all");
      setStateCode("all");
      setCounty("all");
      setLimit("20");
      return;
    }
    if (preset === "inventory") {
      setSource("all");
      setSourceFamilyFilter("directory");
      setTruthFilter("all");
      setDurabilityFilter("all");
      setStateCode("all");
      setCounty("all");
      setLimit("20");
      return;
    }
    if (preset === "deals") {
      setSource("all");
      setSourceFamilyFilter("deals");
      setTruthFilter("all");
      setDurabilityFilter("all");
      setStateCode("all");
      setCounty("all");
      setLimit("20");
      return;
    }
    if (preset === "real_estate") {
      setSource("all");
      setSourceFamilyFilter("real estate");
      setTruthFilter("all");
      setDurabilityFilter("all");
      setStateCode("all");
      setCounty("all");
      setLimit("20");
      return;
    }
    setSource("all");
    setSourceFamilyFilter("all");
    setTruthFilter("current");
    setDurabilityFilter("all");
    setStateCode("all");
    setCounty("all");
    setLimit("25");
  };

  const applyEventPreset = (preset: "all" | "action" | "crawl" | "trust") => {
    if (preset === "all") {
      setEventLane("all");
      setEventSource("all");
      setStateCode("all");
      setCounty("all");
      setLimit("250");
      setEventSinceHours("24");
      setEventCursorTrail([null]);
      setEventPageIndex(0);
      return;
    }

    if (preset === "action") {
      setEventLane("action");
      setEventSource("scout_interactions");
      setLimit("150");
      setEventSinceHours("24");
      setEventCursorTrail([null]);
      setEventPageIndex(0);
      return;
    }

    if (preset === "crawl") {
      setEventLane("crawl_visibility");
      setEventSource("crawler_request_events");
      setLimit("250");
      setEventSinceHours("12");
      setEventCursorTrail([null]);
      setEventPageIndex(0);
      return;
    }

    setEventLane("trust");
    setEventSource("bot_ui_findings");
    setLimit("100");
    setEventSinceHours("48");
    setEventCursorTrail([null]);
    setEventPageIndex(0);
  };

  const handleLoadOlderEvents = () => {
    if (!eventData?.nextCursor) return;
    const nextTrail = [...eventCursorTrail.slice(0, eventPageIndex + 1), eventData.nextCursor];
    setEventCursorTrail(nextTrail);
    setEventPageIndex(nextTrail.length - 1);
  };

  const handleBackEventPage = () => {
    if (eventPageIndex === 0) return;
    setEventPageIndex((current) => Math.max(0, current - 1));
  };

  const handleNewestEventPage = () => {
    setEventPageIndex(0);
  };

  const handlePromoteBotArmyItem = async (item: BotArmySprintQueueItem) => {
    setPromotingItemId(item.id);
    setPromotionMessage("");
    setPromotionError("");
    try {
      const response = await fetch("/api/admin/mission-control/one-fix/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "bot_ui",
          sourceId: `${item.route}::${item.failureType}`,
          summary: `${item.failureType} on ${item.route}`,
          suggestedFix: item.recommendedAction,
          impactScore: item.score,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to promote sprint item");
      }
      setPromotionMessage(`Promoted ${item.route} to One-Fix.`);
      await queryClient.invalidateQueries({
        queryKey: ["/api/admin/mission-control/bot-army/sprint-queue"],
      });
    } catch (error) {
      setPromotionError(error instanceof Error ? error.message : "Failed to promote sprint item");
    } finally {
      setPromotingItemId(null);
    }
  };

  const handleTriggerAutoPromotion = async () => {
    setAutoPromoting(true);
    setAutoPromotionError("");
    setAutoPromotionMessage("");
    try {
      const response = await fetch("/api/admin/mission-control/bot-army/auto-promote/trigger", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(botArmyAutoPromotionStatus?.settings || {}),
      });
      if (!response.ok) {
        throw new Error("Failed to run Bot Army auto-promotion");
      }
      const result = (await response.json()) as BotArmyAutoPromotionResult;
      setAutoPromotionMessage(
        `Auto-promotion run complete. Promoted ${result.promotedCount}/${result.candidatesEvaluated} (min score ${result.minScore}).`
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/admin/mission-control/bot-army/sprint-queue"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/admin/mission-control/bot-army/auto-promote/status"],
        }),
      ]);
    } catch (error) {
      setAutoPromotionError(
        error instanceof Error ? error.message : "Failed to run Bot Army auto-promotion"
      );
    } finally {
      setAutoPromoting(false);
    }
  };

  const activeFilterSummary = useMemo(() => {
    if (uiMode === "feed") {
      const parts = [
        eventLane === "all" ? "all lanes" : `lane:${eventLane}`,
        eventSource === "all" ? "all event sources" : `source:${eventSource}`,
        stateCode === "all" ? "all states" : `state:${stateCode}`,
        county === "all" ? "all counties" : `county:${county}`,
        `since:${eventSinceHours || "24"}h`,
        `limit:${limit || "250"}`,
      ];
      return parts.join(" | ");
    }

    const parts = [
      source === "all" ? "all sources" : `source:${source}`,
      sourceFamilyFilter === "all" ? "all families" : `family:${sourceFamilyFilter}`,
      truthFilter === "all" ? "all truth states" : `truth:${truthFilter}`,
      durabilityFilter === "all" ? "all durability" : `durability:${durabilityFilter}`,
      stateCode === "all" ? "all states" : `state:${stateCode}`,
      county === "all" ? "all counties" : `county:${county}`,
      `limit:${limit || "20"}`,
      `history:${historyDays || "7"}d`,
    ];
    return parts.join(" | ");
  }, [
    source,
    sourceFamilyFilter,
    truthFilter,
    durabilityFilter,
    stateCode,
    county,
    eventLane,
    eventSinceHours,
    eventSource,
    limit,
    uiMode,
    historyDays,
  ]);
  const exportContextChips = useMemo(() => {
    if (uiMode === "feed") {
      return [
        "mode:events",
        `lane:${eventLane === "all" ? "all" : eventLane}`,
        `source:${eventSource === "all" ? "all" : eventSource}`,
        `state:${stateCode === "all" ? "all" : stateCode}`,
        `county:${county === "all" ? "all" : county}`,
        `since:${eventSinceHours || "24"}h`,
        `page:${eventPageIndex + 1}`,
      ];
    }

    return [
      "mode:snapshot",
      `source:${source === "all" ? "all" : source}`,
      `state:${stateCode === "all" ? "all" : stateCode}`,
      `county:${county === "all" ? "all" : county}`,
      `limit:${limit || "20"}`,
    ];
  }, [
    county,
    eventLane,
    eventPageIndex,
    eventSinceHours,
    eventSource,
    limit,
    source,
    stateCode,
    uiMode,
  ]);
  const groupedLiveFeed = useMemo(() => {
    const groups = {
      adPlays: [] as LiveStreamItem[],
      advertiserPitches: [] as LiveStreamItem[],
      marketMoves: [] as LiveStreamItem[],
      monetizationLeaks: [] as LiveStreamItem[],
      watch: [] as LiveStreamItem[],
    };

    for (const item of filteredStream) {
      const bucket = resolveEntryCommercialBucket(item);
      if (bucket === "ad plays") groups.adPlays.push(item);
      else if (bucket === "advertiser pitches") groups.advertiserPitches.push(item);
      else if (bucket === "market moves") groups.marketMoves.push(item);
      else if (bucket === "monetization leaks") groups.monetizationLeaks.push(item);
      else groups.watch.push(item);
    }

    return groups;
  }, [filteredStream]);
  const topRevenueSignals = useMemo(() => {
    return [...filteredStream]
      .sort((a, b) => {
        const scoreDelta = (b.revenueScore || 0) - (a.revenueScore || 0);
        if (scoreDelta !== 0) return scoreDelta;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      })
      .slice(0, 5);
  }, [filteredStream]);
  const operatorQueue = useMemo(() => {
    const prioritizedItems = [
      ...groupedLiveFeed.monetizationLeaks,
      ...groupedLiveFeed.advertiserPitches,
      ...groupedLiveFeed.adPlays,
      ...groupedLiveFeed.marketMoves,
    ];
    const seen = new Set<string>();

    return prioritizedItems
      .reduce<
        Array<{
          id: string;
          priority: LiveStreamItem["priority"];
          revenueScore: number;
          title: string;
          targetMarket?: string;
          salesAngle?: string;
          inventorySummary?: string;
          exampleBusinesses?: Array<{ name: string; slug: string | null }>;
          prospectSummary?: string;
          prospectClasses?: Array<{ label: string; count: number }>;
          marketGapSummary?: string;
          owner: string;
          urgency: string;
          status: "new" | "in progress" | "cleared";
          task: string;
          channelSuggestion?: string;
          assetSuggestion?: string;
          whyNow?: string;
        }>
      >((acc, item) => {
        const task = resolveEntryActionTask(item);
        if (!task) return acc;
        const dedupeKey = task.toLowerCase();
        if (seen.has(dedupeKey)) return acc;
        seen.add(dedupeKey);
        acc.push({
          id: item.id,
          priority: item.priority,
          revenueScore: item.revenueScore || 0,
          title: item.title,
          targetMarket: item.targetMarket,
          salesAngle: item.salesAngle,
          inventorySummary: item.inventorySummary,
          exampleBusinesses: item.exampleBusinesses,
          prospectSummary: item.prospectSummary,
          prospectClasses: item.prospectClasses,
          marketGapSummary: item.marketGapSummary,
          owner: resolveEntryOwner(item),
          urgency: resolveEntryUrgency(item),
          status: actionStatuses[item.id] || "new",
          task,
          channelSuggestion: item.channelSuggestion,
          assetSuggestion: item.assetSuggestion,
          whyNow: item.whyNow,
        });
        return acc;
      }, [])
      .sort((a, b) => b.revenueScore - a.revenueScore)
      .slice(0, 6);
  }, [actionStatuses, groupedLiveFeed]);
  const operatorOwnerBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of operatorQueue) {
      counts.set(item.owner, (counts.get(item.owner) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([owner, count]) => ({ owner, count }))
      .sort((a, b) => b.count - a.count || a.owner.localeCompare(b.owner));
  }, [operatorQueue]);
  const operatorUrgencyBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of operatorQueue) {
      counts.set(item.urgency, (counts.get(item.urgency) || 0) + 1);
    }
    return ["drop everything", "today", "watch soon"]
      .map((urgency) => ({ urgency, count: counts.get(urgency) || 0 }))
      .filter((item) => item.count > 0);
  }, [operatorQueue]);
  const operatorStatusBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of operatorQueue) {
      counts.set(item.status, (counts.get(item.status) || 0) + 1);
    }
    return ["new", "in progress", "cleared"]
      .map((status) => ({ status, count: counts.get(status) || 0 }))
      .filter((item) => item.count > 0);
  }, [operatorQueue]);
  const chronologicalStream = useMemo(() => {
    return [...filteredStream]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, Math.min(25, filteredStream.length));
  }, [filteredStream]);
  const topBotArmyActions = useMemo(() => {
    return (botArmySprintQueue?.queue || []).slice(0, 6);
  }, [botArmySprintQueue?.queue]);

  return (
    <div className={`space-y-6 ${presentationMode ? "max-w-5xl mx-auto py-6" : ""}`}>
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/observability")}>
              Observability
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/cumulus-intelligence")}
            >
              Cumulus Intelligence
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/mission-control")}>
              Mission Control
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-white">TradeScout Live Stream</CardTitle>
              <CardDescription className="text-white/70">
                Source-backed site signals across demand, inventory, deals, real estate, partner
                intel, alerts, and crawler health. Degraded or stale inputs should be flagged, not
                invented.
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/20 p-1">
              {(
                [
                  { key: "ops", label: "Live Ops" },
                  { key: "feed", label: "Feed Explorer" },
                  { key: "debug", label: "Telemetry / Debug" },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setUiMode(mode.key)}
                  className={cn(
                    "rounded px-2 py-1 text-[11px] uppercase tracking-[0.16em] transition-colors",
                    uiMode === mode.key
                      ? "bg-ts-orange/30 text-white"
                      : "text-white/60 hover:text-white"
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <Button onClick={handlePresentationModeToggle} variant="outline">
              {presentationMode ? "Exit Presentation Mode" : "Open Presentation Mode"}
            </Button>
            <Button onClick={handleExport} variant="outline" disabled={exporting}>
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
            <Button onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "Refresh Live Stream"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">
              Export context
            </div>
            {exportContextChips.map((chip) => (
              <Badge key={chip} variant="outline" className="border-white/10 text-white/70">
                {chip}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedulerDisabledWarning ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Scheduler is disabled. Live stream snapshots can go stale or missing until you run a
              manual refresh or turn scheduled jobs back on.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">
                Stream Freshness
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge
                  className={
                    liveStreamStateLabel === "fresh"
                      ? "bg-emerald-600/20 text-emerald-100 border-emerald-500/30"
                      : liveStreamStateLabel === "stale"
                        ? "bg-amber-600/20 text-amber-100 border-amber-500/30"
                        : "bg-rose-600/20 text-rose-100 border-rose-500/30"
                  }
                >
                  {liveStreamStateLabel}
                </Badge>
                {snapshotAgeMinutes !== null ? (
                  <span className="text-sm text-white/80">{snapshotAgeMinutes} min old</span>
                ) : (
                  <span className="text-sm text-white/55">Age unavailable</span>
                )}
              </div>
              <div className="mt-2 text-xs text-white/60">
                {data?.generatedAt
                  ? `Last built ${new Date(data.generatedAt).toLocaleString()}`
                  : "No snapshot timestamp available."}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Source Health</div>
              <div className="mt-2 text-sm text-white/85">
                {data?.summary.degradedSources?.length
                  ? `${data.summary.degradedSources.length} degraded source${data.summary.degradedSources.length === 1 ? "" : "s"}`
                  : "All tracked sources responded"}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {degradedSources.length ? (
                  degradedSources.map((sourceName) => (
                    <Badge
                      key={sourceName}
                      className="bg-rose-600/20 text-rose-100 border-rose-500/30"
                    >
                      {sourceName}
                    </Badge>
                  ))
                ) : (
                  <Badge className="bg-emerald-600/20 text-emerald-100 border-emerald-500/30">
                    healthy
                  </Badge>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Feed Strength</div>
              <div className="mt-2 text-sm text-white/85">
                {visibleEntryCount} visible entries across{" "}
                {(data?.summary.sourceCounts && Object.keys(data.summary.sourceCounts).length) || 0}{" "}
                sources
              </div>
              <div className="mt-2 text-xs text-white/60">
                {visibleEntryCount === 0
                  ? "No trustworthy live signals are available right now. The stream is hiding stale or degraded entries instead of filling with guesses."
                  : visibleEntryCount < 5
                    ? "Signal density is thin. Treat this as partial awareness until more source-backed entries arrive."
                    : "Enough source-backed signal is present to prioritize work from the queue and buckets."}
              </div>
            </div>
          </div>

          {degradedSources.length ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Live stream is partially degraded. Stale or failed sources are being withheld instead
              of replaced with synthetic filler.
              <div className="mt-2 text-destructive/90">
                Affected sources: {degradedSources.join(", ")}.
              </div>
              {degradedSourceEntries.length ? (
                <div className="mt-2 space-y-1 text-xs text-destructive/90">
                  {degradedSourceEntries.map(([sourceName, reason]) => (
                    <div key={sourceName}>
                      {sourceName}: {reason}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {uiMode === "debug" ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-white/45">
                    Market Signal Board
                  </div>
                  <div className="mt-2 text-sm text-white/80">
                    The shortest read on what you can sell, where to spend, where to move next, and
                    what leak is killing monetizable attention, using only source-backed entries.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{liveStreamStateLabel}</Badge>
                  <Badge variant="outline">{visibleEntryCount} visible entries</Badge>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_0.95fr]">
                <div className="space-y-4">
                  <SignalBoardPanel
                    title="Market Brief"
                    subtitle="One pass across what moved, what triggered it, and where the current leak sits."
                    badge={`${marketBriefs.length} key reads`}
                    toneClass="border-cyan-500/20 bg-cyan-500/10"
                  >
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {marketBriefs.length === 0 ? (
                        <div className="rounded-md border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/70">
                          No useful market brief surfaced yet.
                        </div>
                      ) : (
                        marketBriefs.map((item) => (
                          <BriefTile
                            key={`${item.label}-${item.value}`}
                            label={item.label}
                            value={item.value}
                            detail={item.detail}
                          />
                        ))
                      )}
                    </div>
                  </SignalBoardPanel>

                  <SignalBoardPanel
                    title="Ranked Signals"
                    subtitle="Top source-backed opportunities ordered by commercial strength."
                    badge={topRevenueSignals.length ? `${topRevenueSignals.length} ranked` : "none"}
                    toneClass="border-emerald-500/20 bg-emerald-500/10"
                  >
                    <div className="space-y-3">
                      {topRevenueSignals.length === 0 ? (
                        <div className="text-sm text-emerald-100/70">
                          No ranked revenue signals surfaced yet.
                        </div>
                      ) : (
                        topRevenueSignals.map((item, index) => {
                          const summary = buildUsefulSignalSummary(item);
                          return (
                            <div
                              key={item.id}
                              className="rounded-md border border-emerald-200/10 bg-black/20 px-3 py-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-100/60">
                                  #{index + 1} {item.commercialBucket || "watchlist"}
                                </div>
                                <Badge className="border-emerald-300/20 bg-emerald-500/10 text-emerald-50">
                                  {item.revenueScore || 0}
                                </Badge>
                              </div>
                              <div className="mt-1 text-sm text-emerald-50">{summary.headline}</div>
                              <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-emerald-100/55">
                                Market signal
                              </div>
                              <div className="mt-1 text-xs text-emerald-50">
                                {summary.marketSignal}
                              </div>
                              {summary.trigger ? (
                                <div className="mt-2">
                                  <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/55">
                                    Trigger
                                  </div>
                                  <div className="mt-1 text-xs text-emerald-100/85">
                                    {summary.trigger}
                                  </div>
                                </div>
                              ) : null}
                              {summary.inventory ? (
                                <div className="mt-2">
                                  <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/55">
                                    Inventory
                                  </div>
                                  <div className="mt-1 text-xs text-emerald-100/75">
                                    {summary.inventory}
                                  </div>
                                </div>
                              ) : null}
                              {summary.prospects ? (
                                <div className="mt-2">
                                  <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/55">
                                    Local read
                                  </div>
                                  <div className="mt-1 text-xs text-emerald-100/75">
                                    {summary.prospects}
                                  </div>
                                </div>
                              ) : null}
                              <div className="mt-2">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/55">
                                  Do next
                                </div>
                                <div className="mt-1 text-xs font-medium text-emerald-50">
                                  {summary.action}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </SignalBoardPanel>
                </div>

                <div className="space-y-4">
                  <SignalBoardPanel
                    title="Do Now"
                    subtitle="Operator actions worth taking before the signal cools off."
                    badge={`${primaryActionItems.length} queued`}
                    toneClass="border-amber-500/20 bg-amber-500/10"
                  >
                    <div className="space-y-3">
                      {primaryActionItems.length === 0 ? (
                        <div className="rounded-md border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/70">
                          No urgent operator action surfaced right now.
                        </div>
                      ) : (
                        primaryActionItems.map((item) => (
                          <div
                            key={item.title}
                            className={cn("rounded-md border px-3 py-3", item.tone)}
                          >
                            <div className="text-[11px] uppercase tracking-[0.2em] text-current/70">
                              {item.title}
                            </div>
                            <div className="mt-1 text-sm text-current">{item.detail}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </SignalBoardPanel>

                  <SignalBoardPanel
                    title="Surface Health"
                    subtitle="Useful traffic versus waste and unattributed crawl pressure."
                    badge={`${signalSurfaceCount} useful`}
                    toneClass="border-teal-500/20 bg-teal-500/10"
                  >
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-teal-100/60">
                          Useful
                        </div>
                        <div className="mt-1 text-xl font-semibold text-teal-50">
                          {signalSurfaceCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-amber-100/60">
                          Infra
                        </div>
                        <div className="mt-1 text-xl font-semibold text-amber-50">
                          {noiseSurfaceCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-rose-100/60">
                          Unknown
                        </div>
                        <div className="mt-1 text-xl font-semibold text-rose-50">
                          {unknownSurfaceCount}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {topSurfaceBreakdown.length === 0 ? (
                        <div className="text-sm text-teal-100/70">No crawler surface data yet.</div>
                      ) : (
                        topSurfaceBreakdown.slice(0, 4).map((surface) => (
                          <div
                            key={surface.sourceSurface}
                            className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
                          >
                            <div className="text-teal-50">
                              {humanizeSurfaceLabel(surface.sourceSurface)}
                            </div>
                            <Badge variant="outline" className="border-white/10 text-teal-50">
                              {surface.requestCount}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </SignalBoardPanel>

                  <SignalBoardPanel
                    title="Priority Signals"
                    subtitle="Filtered internal findings for opportunity, friction, and waste."
                    badge={`${focusedDerivedOutputs.length} shown`}
                    toneClass="border-violet-500/20 bg-violet-500/10"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 rounded-md border border-violet-200/20 bg-black/20 p-1">
                        {(["all", "opportunity", "friction", "waste"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setDerivedFocus(mode)}
                            className={cn(
                              "rounded px-2 py-1 text-[11px] uppercase tracking-[0.16em] transition-colors",
                              derivedFocus === mode
                                ? "bg-violet-500/20 text-violet-50"
                                : "text-violet-100/60 hover:text-violet-50"
                            )}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                      <select
                        value={marketFilter}
                        onChange={(e) => setMarketFilter(e.target.value)}
                        className="rounded-md border border-violet-200/20 bg-black/20 px-2 py-1 text-[11px] text-violet-50 outline-none"
                      >
                        {availableMarkets.map((market) => (
                          <option key={market} value={market}>
                            {market === "all" ? "all markets" : market}
                          </option>
                        ))}
                      </select>
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="rounded-md border border-violet-200/20 bg-black/20 px-2 py-1 text-[11px] text-violet-50 outline-none"
                      >
                        {availableCategories.map((category) => (
                          <option key={category} value={category}>
                            {category === "all" ? "all categories" : category}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleCopyDerived}
                        className="rounded-md border border-violet-200/20 bg-black/20 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-violet-50 hover:bg-violet-500/10"
                      >
                        copy
                      </button>
                    </div>
                    {copyStatus ? (
                      <div className="mt-2 text-[11px] text-violet-100/80">{copyStatus}</div>
                    ) : null}
                    <div className="mt-3 space-y-2">
                      {focusedDerivedOutputs.length === 0 ? (
                        <div className="text-sm text-violet-100/70">
                          No clear operator-grade priority has surfaced yet.
                        </div>
                      ) : (
                        focusedDerivedOutputs.slice(0, 4).map((item) => {
                          const parts = splitDecisionNarrative(item.narrative);
                          const summary = buildUsefulSignalSummary(item);
                          return (
                            <div
                              key={item.id}
                              className="rounded-md border border-violet-200/10 bg-black/20 px-3 py-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm text-violet-50">{item.title}</div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={
                                      truthTone[
                                        item.truthStatus === "current" ? "current" : "stale"
                                      ]
                                    }
                                  >
                                    {item.truthStatus === "current" ? "current" : "stale"}
                                  </Badge>
                                  <Badge variant="outline" className={priorityTone[item.priority]}>
                                    {item.priority}
                                  </Badge>
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-violet-100/75">
                                {parts.what || item.narrative}
                              </div>
                              {summary.trigger ? (
                                <div className="mt-2 text-xs text-violet-100/85">
                                  Triggered by: {summary.trigger}
                                </div>
                              ) : null}
                              {parts.why ? (
                                <div className="mt-2 text-xs text-violet-100/65">
                                  Why this matters: {parts.why}
                                </div>
                              ) : null}
                              {parts.doNext ? (
                                <div className="mt-2 text-xs font-medium text-violet-50">
                                  Next move: {parts.doNext}
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </SignalBoardPanel>
                </div>
              </div>
            </div>
          ) : null}

          {uiMode === "debug" ? (
            <details className="rounded-lg border border-white/10 bg-black/20 p-4">
              <summary className="cursor-pointer list-none text-sm font-medium text-white/85">
                Open deep-dive telemetry
              </summary>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      Last Refresh
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {data?.generatedAt
                        ? new Date(data.generatedAt).toLocaleString()
                        : isLoading
                          ? "Loading..."
                          : "Unavailable"}
                    </div>
                    <div className="mt-2">
                      <Badge variant="outline">{liveStreamStateLabel}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Entries shown: {visibleEntryCount}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Stale after {liveStreamStatus?.staleAfterMinutes ?? 0} min
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      Truth Now
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {data?.summary.truthNow || "Unavailable"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      Top Demand Page
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {topRouteDemand?.narrative || "No route-level demand signal yet"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      Top Demand County
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {topCountyDemand?.narrative || "No county concentration signal yet"}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/70">
                    Bot Demand Cluster
                  </div>
                  <div className="mt-2 text-sm text-cyan-50">
                    {topBotDemandCluster?.narrative ||
                      data?.summary.topBotCrawlHeadline ||
                      "No bot demand cluster yet"}
                  </div>
                </div>

                <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.24em] text-violet-100/70">
                        TradeScout Internal LISA Outputs
                      </div>
                      <div className="mt-2 text-sm text-violet-50">
                        {internalLisaOutputs.length > 0
                          ? `TradeScout internal LISA is emitting ${internalLisaOutputs.length} normalized outputs into the live feed right now.`
                          : "No normalized internal-LISA outputs have surfaced in the live feed yet."}
                      </div>
                    </div>
                    <Badge variant="outline" className="border-violet-200/20 text-violet-50">
                      {internalLisaOutputs.length} outputs
                    </Badge>
                  </div>

                  {topThreeDerivedOutputs.length > 0 ? (
                    <div className="mt-4 rounded-md border border-sky-300/20 bg-sky-500/10 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs uppercase tracking-[0.24em] text-sky-100/70">
                          Top 3 Right Now
                        </div>
                        <Badge variant="outline" className="border-sky-200/20 text-sky-50">
                          highest-significance signals
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-1 xl:grid-cols-3 gap-3">
                        {topThreeDerivedOutputs.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-md border border-sky-200/10 bg-black/20 px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm text-sky-50">{item.title}</div>
                              <Badge variant="outline" className={priorityTone[item.priority]}>
                                {item.priority}
                              </Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                              {item.signalClass ? (
                                <Badge variant="outline" className="border-sky-200/20 text-sky-100">
                                  {item.signalClass}
                                </Badge>
                              ) : null}
                              {typeof item.baselineDeltaPct === "number" ? (
                                <Badge variant="outline" className="border-sky-200/20 text-sky-100">
                                  {item.baselineDeltaPct >= 0
                                    ? `+${item.baselineDeltaPct}%`
                                    : `${item.baselineDeltaPct}%`}{" "}
                                  vs baseline
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-2 text-xs text-sky-100/75">{item.narrative}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {derivedIntelligenceOutputs.length > 0 ? (
                    <div className="mt-4 rounded-md border border-fuchsia-300/20 bg-fuchsia-500/10 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs uppercase tracking-[0.24em] text-fuchsia-100/70">
                          Derived Intelligence
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1 rounded-md border border-fuchsia-200/20 bg-black/20 p-1">
                            {(["all", "opportunity", "friction", "waste"] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setDerivedFocus(mode)}
                                className={cn(
                                  "rounded px-2 py-1 text-[11px] uppercase tracking-[0.16em] transition-colors",
                                  derivedFocus === mode
                                    ? "bg-fuchsia-500/20 text-fuchsia-50"
                                    : "text-fuchsia-100/60 hover:text-fuchsia-50"
                                )}
                              >
                                {mode}
                              </button>
                            ))}
                          </div>
                          <select
                            value={marketFilter}
                            onChange={(e) => setMarketFilter(e.target.value)}
                            className="rounded-md border border-fuchsia-200/20 bg-black/20 px-2 py-1 text-[11px] text-fuchsia-50 outline-none"
                          >
                            {availableMarkets.map((market) => (
                              <option key={market} value={market}>
                                {market === "all" ? "all markets" : market}
                              </option>
                            ))}
                          </select>
                          <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="rounded-md border border-fuchsia-200/20 bg-black/20 px-2 py-1 text-[11px] text-fuchsia-50 outline-none"
                          >
                            {availableCategories.map((category) => (
                              <option key={category} value={category}>
                                {category === "all" ? "all categories" : category}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleCopyDerived}
                            className="rounded-md border border-fuchsia-200/20 bg-black/20 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-fuchsia-50 hover:bg-fuchsia-500/10"
                          >
                            copy
                          </button>
                          <Badge
                            variant="outline"
                            className="border-fuchsia-200/20 text-fuchsia-50"
                          >
                            {focusedDerivedOutputs.length} shown
                          </Badge>
                        </div>
                      </div>
                      {copyStatus ? (
                        <div className="mt-2 text-[11px] text-fuchsia-100/80">{copyStatus}</div>
                      ) : null}
                      <div className="mt-3 text-xs text-fuchsia-100/70">
                        Focus this view on opportunity, friction, or waste when you want a cleaner
                        strategic read instead of the full mixed picture.
                      </div>
                      <div className="mt-3 grid grid-cols-1 xl:grid-cols-3 gap-3">
                        <div className="rounded-md border border-emerald-300/20 bg-emerald-500/10 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] uppercase tracking-[0.24em] text-emerald-100/70">
                              Opportunity
                            </div>
                            <Badge
                              variant="outline"
                              className="border-emerald-200/20 text-emerald-50"
                            >
                              {opportunityOutputs.length}
                            </Badge>
                          </div>
                          <div className="mt-3 space-y-2">
                            {opportunityOutputs.length === 0 ? (
                              <div className="text-xs text-emerald-100/70">
                                No opportunity signals surfaced yet.
                              </div>
                            ) : (
                              opportunityOutputs.slice(0, 2).map((item) => (
                                <div
                                  key={item.id}
                                  className="rounded-md border border-emerald-200/10 bg-black/20 px-3 py-2"
                                >
                                  <div className="text-sm text-emerald-50">{item.title}</div>
                                  {typeof item.baselineDeltaPct === "number" ? (
                                    <div className="mt-1 text-[11px] text-emerald-100/80">
                                      {item.baselineDeltaPct >= 0
                                        ? `+${item.baselineDeltaPct}%`
                                        : `${item.baselineDeltaPct}%`}{" "}
                                      vs baseline
                                    </div>
                                  ) : null}
                                  <div className="mt-1 text-xs text-emerald-100/75">
                                    {item.narrative}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="rounded-md border border-amber-300/20 bg-amber-500/10 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] uppercase tracking-[0.24em] text-amber-100/70">
                              Friction
                            </div>
                            <Badge variant="outline" className="border-amber-200/20 text-amber-50">
                              {frictionOutputs.length}
                            </Badge>
                          </div>
                          <div className="mt-3 space-y-2">
                            {frictionOutputs.length === 0 ? (
                              <div className="text-xs text-amber-100/70">
                                No friction signals surfaced yet.
                              </div>
                            ) : (
                              frictionOutputs.slice(0, 2).map((item) => (
                                <div
                                  key={item.id}
                                  className="rounded-md border border-amber-200/10 bg-black/20 px-3 py-2"
                                >
                                  <div className="text-sm text-amber-50">{item.title}</div>
                                  {typeof item.baselineDeltaPct === "number" ? (
                                    <div className="mt-1 text-[11px] text-amber-100/80">
                                      {item.baselineDeltaPct >= 0
                                        ? `+${item.baselineDeltaPct}%`
                                        : `${item.baselineDeltaPct}%`}{" "}
                                      vs baseline
                                    </div>
                                  ) : null}
                                  <div className="mt-1 text-xs text-amber-100/75">
                                    {item.narrative}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="rounded-md border border-rose-300/20 bg-rose-500/10 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] uppercase tracking-[0.24em] text-rose-100/70">
                              Waste
                            </div>
                            <Badge variant="outline" className="border-rose-200/20 text-rose-50">
                              {wasteOutputs.length}
                            </Badge>
                          </div>
                          <div className="mt-3 space-y-2">
                            {wasteOutputs.length === 0 ? (
                              <div className="text-xs text-rose-100/70">
                                No waste signals surfaced yet.
                              </div>
                            ) : (
                              wasteOutputs.slice(0, 2).map((item) => (
                                <div
                                  key={item.id}
                                  className="rounded-md border border-rose-200/10 bg-black/20 px-3 py-2"
                                >
                                  <div className="text-sm text-rose-50">{item.title}</div>
                                  {typeof item.baselineDeltaPct === "number" ? (
                                    <div className="mt-1 text-[11px] text-rose-100/80">
                                      {item.baselineDeltaPct >= 0
                                        ? `+${item.baselineDeltaPct}%`
                                        : `${item.baselineDeltaPct}%`}{" "}
                                      vs baseline
                                    </div>
                                  ) : null}
                                  <div className="mt-1 text-xs text-rose-100/75">
                                    {item.narrative}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-2">
                    {internalLisaOutputs.length === 0 ? (
                      <div className="text-sm text-violet-100/70">
                        Waiting for entity discovery, county/category discovery, repair pressure, or
                        derived intelligence outputs.
                      </div>
                    ) : (
                      internalLisaOutputs.slice(0, 4).map((item) => (
                        <div
                          key={item.id}
                          className="rounded-md border border-violet-200/10 bg-black/20 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm text-violet-50">{item.title}</div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={
                                  truthTone[item.truthStatus === "current" ? "current" : "stale"]
                                }
                              >
                                {item.truthStatus === "current" ? "current" : "stale"}
                              </Badge>
                              <Badge variant="outline" className={priorityTone[item.priority]}>
                                {item.priority}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                            {item.lane ? (
                              <Badge
                                variant="outline"
                                className="border-violet-200/20 text-violet-100"
                              >
                                lane: {item.lane}
                              </Badge>
                            ) : null}
                            {item.signalClass ? (
                              <Badge
                                variant="outline"
                                className="border-violet-200/20 text-violet-100"
                              >
                                signal: {item.signalClass}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-2 text-xs text-violet-100/75">{item.narrative}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-emerald-100/70">
                      Useful Signal vs Noise
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/60">
                          Signal
                        </div>
                        <div className="mt-1 text-xl font-semibold text-emerald-50">
                          {signalSurfaceCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-amber-100/60">
                          Noise
                        </div>
                        <div className="mt-1 text-xl font-semibold text-amber-50">
                          {noiseSurfaceCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-rose-100/60">
                          Leakage
                        </div>
                        <div className="mt-1 text-xl font-semibold text-rose-50">
                          {unknownSurfaceCount}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-emerald-100/70">
                      Signal is meaningful public discovery. Noise is infra/meta/assets. Leakage is
                      fallback traffic still landing in other/unknown_public.
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-white/40">
                      Top Signal Buckets
                    </div>
                    <div className="mt-3 space-y-2">
                      {topSurfaceBreakdown.length === 0 ? (
                        <div className="text-sm text-white/55">No crawler surface data yet.</div>
                      ) : (
                        topSurfaceBreakdown.map((surface) => (
                          <div
                            key={surface.sourceSurface}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <div className="text-white/75">{surface.sourceSurface}</div>
                            <Badge variant="outline" className="border-white/10 text-white/70">
                              {surface.requestCount}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-rose-100/70">
                      Attribution Leakage
                    </div>
                    <div className="mt-2 text-sm text-rose-50">
                      {topUnknownSurface
                        ? `${topUnknownSurface.sourceSurface} is still carrying ${topUnknownSurface.requestCount} requests in the current surface summary.`
                        : "No fallback leakage surfaced in the current top routes."}
                    </div>
                    <div className="mt-3 text-xs text-rose-100/70">
                      Keep shrinking other/unknown_public until fallback mostly means true unknowns
                      instead of missed known route families.
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.24em] text-indigo-100/70">
                        County + Category Discovery
                      </div>
                      <div className="mt-2 text-sm text-indigo-50">
                        {topCountyDiscoveryLead
                          ? `${topCountyDiscoveryLead.countyName}${topCountyDiscoveryLead.stateCode ? `, ${topCountyDiscoveryLead.stateCode}` : ""} is the current lead county surface with ${topCountyDiscoveryLead.requestCount} crawler requests.`
                          : "No county discovery concentration surfaced yet."}
                      </div>
                    </div>
                    <Badge variant="outline" className="border-indigo-200/20 text-indigo-50">
                      {topCountyDiscovery.length} surfaced counties
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-2">
                    {topCountyDiscovery.length === 0 ? (
                      <div className="text-sm text-indigo-100/70">
                        No county discovery routes available yet.
                      </div>
                    ) : (
                      topCountyDiscovery.map((countyEntry) => (
                        <div
                          key={`${countyEntry.sourceSurface}:${countyEntry.countyName}:${countyEntry.stateCode || "na"}`}
                          className="flex items-center justify-between gap-3 rounded-md border border-indigo-200/10 bg-black/20 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm text-indigo-50">
                              {countyEntry.countyName}
                              {countyEntry.stateCode ? `, ${countyEntry.stateCode}` : ""}
                            </div>
                            <div className="text-xs text-indigo-100/60">
                              {countyEntry.sourceSurface}
                              {countyEntry.countyFips ? ` • FIPS ${countyEntry.countyFips}` : ""}
                            </div>
                          </div>
                          <Badge variant="outline" className="border-indigo-200/20 text-indigo-50">
                            {countyEntry.requestCount}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.24em] text-amber-100/70">
                        Repair Pressure
                      </div>
                      <div className="mt-2 text-sm text-amber-50">
                        {crawlerErrorTotal > 0
                          ? `${crawlerErrorTotal} crawler error responses were observed in the last 24 hours. Focus on high-demand broken routes first.`
                          : "No crawler error pressure surfaced in the current 24-hour summary."}
                      </div>
                    </div>
                    <Badge variant="outline" className="border-amber-200/20 text-amber-50">
                      {crawlerErrorTotal} errors / 24h
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-2">
                    {topRepairRoutes.length === 0 ? (
                      <div className="text-sm text-amber-100/70">
                        No top crawler routes available yet.
                      </div>
                    ) : (
                      topRepairRoutes.map((route) => (
                        <div
                          key={route.path}
                          className="flex items-center justify-between gap-3 rounded-md border border-amber-200/10 bg-black/20 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm text-amber-50">{route.path}</div>
                            <div className="text-xs text-amber-100/60">
                              Prioritize repair or redirect if this route is broken or stale.
                            </div>
                          </div>
                          <Badge variant="outline" className="border-amber-200/20 text-amber-50">
                            {route.requestCount}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </details>
          ) : null}

          {uiMode === "debug" ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Active Alerts
                </div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {data?.summary.activeAlerts ?? 0}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  LISA Entries
                </div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {data?.summary.sourceCounts?.lisa ?? 0}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Cumulus Entries
                </div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {data?.summary.sourceCounts?.cumulus ?? 0}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Crawler Entries
                </div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {data?.summary.sourceCounts?.crawler ?? 0}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Bot Crawl Signals
                </div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {data?.summary.botCrawlSignals ?? 0}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Alert Entries
                </div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {data?.summary.sourceCounts?.alerts ?? 0}
                </div>
              </div>
            </div>
          ) : null}

          {uiMode === "feed" ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-white/45">
                    Feed Explorer Controls
                  </div>
                  <div className="mt-2 text-sm text-white/80">
                    This view is raw lane evidence. Use lane, source, and time window to inspect
                    what is actually arriving before any ranking layer touches it.
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => applyEventPreset("all")}>
                  Reset Event Filters
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => applyEventPreset("all")}>
                  All Events
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyEventPreset("action")}>
                  Action Lane
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyEventPreset("crawl")}>
                  Crawl Visibility
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyEventPreset("trust")}>
                  Trust Findings
                </Button>
              </div>
              <div className="mt-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/65">
                Viewing: {activeFilterSummary}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewestEventPage}
                  disabled={eventPageIndex === 0}
                >
                  Newest
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBackEventPage}
                  disabled={eventPageIndex === 0}
                >
                  Back Page
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadOlderEvents}
                  disabled={!eventData?.nextCursor}
                >
                  Load Older
                </Button>
                <div className="text-xs text-white/60">
                  Page {eventPageIndex + 1}
                  {eventData?.nextCursor ? " | older pages available" : " | end of stream"}
                </div>
              </div>
            </div>
          ) : null}

          {uiMode === "feed" ? (
            <div
              className={`grid grid-cols-1 ${presentationMode ? "md:grid-cols-8" : "md:grid-cols-8"} gap-4`}
            >
              <div className="space-y-1">
                <Label>Lane</Label>
                <Select value={eventLane} onValueChange={setEventLane}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All lanes</SelectItem>
                    <SelectItem value="action">Action</SelectItem>
                    <SelectItem value="crawl_visibility">Crawl visibility</SelectItem>
                    <SelectItem value="trust">Trust</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Source</Label>
                <Select value={eventSource} onValueChange={setEventSource}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All event sources</SelectItem>
                    <SelectItem value="scout_interactions">Scout Interactions</SelectItem>
                    <SelectItem value="crawler_request_events">Crawler Request Events</SelectItem>
                    <SelectItem value="bot_ui_findings">Bot UI Findings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Since Hours</Label>
                <Input
                  value={eventSinceHours}
                  onChange={(e) => setEventSinceHours(e.target.value.replace(/[^\d]/g, "") || "24")}
                  placeholder="24"
                />
              </div>
              <div className="space-y-1">
                <Label>State</Label>
                <Input
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value.trim().toUpperCase() || "all")}
                  placeholder="all or FL"
                />
              </div>
              <div className="space-y-1">
                <Label>County</Label>
                <Input
                  value={county}
                  onChange={(e) => setCounty(e.target.value.trim().toLowerCase() || "all")}
                  placeholder="all or mobile"
                />
              </div>
              <div className="space-y-1">
                <Label>Limit</Label>
                <Input
                  value={limit}
                  onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, "") || "20")}
                />
              </div>
              <div className="space-y-1">
                <Label>Cursor Window</Label>
                <Input value={`page ${eventPageIndex + 1}`} readOnly />
              </div>
            </div>
          ) : null}

          {uiMode === "feed" ? (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-white/40">Event Count</div>
                <div className="mt-2 text-sm text-white/85">
                  {isEventLoading ? "Loading..." : `${liveEvents.length} raw events`}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-white/40">Lane Leader</div>
                <div className="mt-2 text-sm text-white/85">
                  {eventLaneBreakdown[0]
                    ? `${eventLaneBreakdown[0][0]} (${eventLaneBreakdown[0][1]})`
                    : "Unavailable"}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-white/40">
                  Source Leader
                </div>
                <div className="mt-2 text-sm text-white/85">
                  {eventSourceBreakdown[0]
                    ? `${eventSourceBreakdown[0][0]} (${eventSourceBreakdown[0][1]})`
                    : "Unavailable"}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-white/40">Time Window</div>
                <div className="mt-2 text-sm text-white/85">
                  Last {eventSinceHours || "24"} hours
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-white/40">
                  Filtered State
                </div>
                <div className="mt-2 text-sm text-white/85">
                  {stateCode === "all" ? "All states" : stateCode}
                </div>
              </div>
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/70">
                  Next Cursor
                </div>
                <div className="mt-2 text-sm text-cyan-50">
                  {eventData?.nextCursor
                    ? new Date(eventData.nextCursor).toLocaleString()
                    : "Reached oldest available page"}
                </div>
              </div>
            </div>
          ) : null}

          {uiMode === "feed" ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {eventSourceBreakdown.length === 0 ? (
                <div className="text-sm text-white/55">No event source counts available yet.</div>
              ) : (
                eventSourceBreakdown.map(([entrySource, count]) => (
                  <div
                    key={entrySource}
                    className="rounded-lg border border-white/10 bg-black/20 p-4"
                  >
                    <div className="text-xs uppercase tracking-[0.24em] text-white/40">
                      {entrySource}
                    </div>
                    <div className="mt-2 text-sm text-white/85">{count} live entries</div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          <div className="text-xs text-white/50">
            {uiMode === "feed"
              ? eventData?.generatedAt
                ? `Updated ${new Date(eventData.generatedAt).toLocaleString()}`
                : isEventLoading
                  ? "Loading raw events..."
                  : "No raw event stream available"
              : data?.generatedAt
                ? `Updated ${new Date(data.generatedAt).toLocaleString()}`
                : isLoading
                  ? "Loading live stream..."
                  : "No live stream available"}
          </div>

          {(uiMode === "feed" ? eventError : error) ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {uiMode === "feed"
                ? "Failed to load raw event stream."
                : "Failed to load live stream."}
            </div>
          ) : null}

          {refreshError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {refreshError}
            </div>
          ) : null}

          {refreshMessage ? (
            <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
              {refreshMessage}
            </div>
          ) : null}

          {exportError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {exportError}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className={`bg-card border-border ${presentationMode ? "print:hidden" : ""}`}>
        <CardHeader>
          <CardTitle className="text-white">
            {uiMode === "feed" ? "Raw Feed Explorer" : "Live Feed"}
          </CardTitle>
          <CardDescription className="text-white/70">
            {uiMode === "feed"
              ? "Raw lane events only. This panel shows source-level evidence before ranking or narrative synthesis."
              : "Server-produced entries only. The UI does not synthesize intelligence."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {uiMode === "feed" ? (
              <>
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white">Lane Event Stream</div>
                      <div className="mt-1 text-xs text-white/65">
                        Evidence-first view for action, crawl visibility, and trust events. Use this
                        to verify what the system actually observed.
                      </div>
                    </div>
                    <Badge variant="outline" className="border-cyan-200/20 text-cyan-50">
                      {liveEvents.length} events
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {eventLaneBreakdown.map(([laneName, count]) => (
                      <Badge
                        key={laneName}
                        className={laneTone[laneName] || "border-white/10 bg-white/5 text-white/75"}
                      >
                        {laneName}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>

                {liveEvents.length === 0 ? (
                  <div className="text-sm text-white/65">
                    {isEventLoading
                      ? "Loading raw events..."
                      : "No raw lane events matched the current filters."}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {liveEvents.map((event) => (
                      <LaneEventCard key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </>
            ) : null}

            {uiMode === "ops" && (
              <>
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white">Bot Army Sprint Queue</div>
                      <div className="mt-1 text-xs text-white/65">
                        Same-day operator queue from live bot findings, scored for fastest trust and
                        conversion impact.
                      </div>
                    </div>
                    <Badge variant="outline" className="border-rose-200/20 text-rose-50">
                      {topBotArmyActions.length} queued
                    </Badge>
                  </div>

                  <div className="mt-3 rounded-md border border-white/10 bg-black/20 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-white/75">
                        Auto-Promote Scheduler{" "}
                        {botArmyAutoPromotionStatus?.enabled ? "enabled" : "disabled"}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            botArmyAutoPromotionStatus?.schedulerActive
                              ? "border-emerald-300/20 text-emerald-100"
                              : "border-white/15 text-white/65"
                          }
                        >
                          {botArmyAutoPromotionStatus?.schedulerActive ? "active" : "inactive"}
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 border-white/15 text-xs"
                          disabled={autoPromoting}
                          onClick={() => void handleTriggerAutoPromotion()}
                        >
                          {autoPromoting ? "Running..." : "Run Auto-Promote Now"}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-white/55">
                      Schedule: {botArmyAutoPromotionStatus?.schedule || "*/10 * * * *"} | lookback:{" "}
                      {botArmyAutoPromotionStatus?.settings.lookbackHours ?? 6}h | limit:{" "}
                      {botArmyAutoPromotionStatus?.settings.limit ?? 5} | min score:{" "}
                      {botArmyAutoPromotionStatus?.settings.minScore ?? 70}
                    </div>
                  </div>

                  {topBotArmyActions.length === 0 ? (
                    <div className="mt-3 rounded-md border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/70">
                      No Bot Army sprint findings in the last 6 hours.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {topBotArmyActions.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-md border border-white/10 bg-black/20 px-3 py-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border-rose-300/20 bg-rose-500/10 text-rose-50">
                              score {item.score}
                            </Badge>
                            <Badge variant="outline" className="border-white/10 text-white/70">
                              {item.failureType}
                            </Badge>
                            <Badge variant="outline" className="border-white/10 text-white/70">
                              severity {item.severity}
                            </Badge>
                            <Badge variant="outline" className="border-white/10 text-white/70">
                              seen {item.occurrences}
                            </Badge>
                          </div>
                          <div className="mt-2 text-sm font-medium text-white">{item.route}</div>
                          <div className="mt-1 text-xs text-white/65">{item.observedFact}</div>
                          <div className="mt-2 rounded-md border border-cyan-300/15 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-50">
                            Do now: {item.recommendedAction}
                          </div>
                          <div className="mt-2 rounded-md border border-amber-300/15 bg-amber-500/10 px-3 py-2 text-xs text-amber-50">
                            Risk if ignored: {item.riskIfIgnored}
                          </div>
                          <div className="mt-2 text-[11px] text-white/50">
                            Latest: {new Date(item.latestAt).toLocaleString()}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 border-white/15 text-xs"
                              disabled={promotingItemId === item.id}
                              onClick={() => void handlePromoteBotArmyItem(item)}
                            >
                              {promotingItemId === item.id ? "Promoting..." : "Promote to One-Fix"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {promotionMessage ? (
                    <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                      {promotionMessage}
                    </div>
                  ) : null}
                  {promotionError ? (
                    <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {promotionError}
                    </div>
                  ) : null}
                  {autoPromotionMessage ? (
                    <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                      {autoPromotionMessage}
                    </div>
                  ) : null}
                  {autoPromotionError ? (
                    <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {autoPromotionError}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white">Revenue Playbook</div>
                      <div className="mt-1 text-xs text-white/65">
                        Revenue and market moves pulled from trustworthy stream entries so you can
                        launch ads, make market calls, and pitch advertisers without reading generic
                        telemetry.
                      </div>
                    </div>
                    <Badge variant="outline" className="border-sky-200/20 text-sky-50">
                      {operatorQueue.length} actions
                    </Badge>
                  </div>

                  {operatorOwnerBreakdown.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {operatorUrgencyBreakdown.map((item) => (
                        <Badge
                          key={item.urgency}
                          className={urgencyTone[item.urgency] || urgencyTone["watch soon"]}
                        >
                          {item.urgency}: {item.count}
                        </Badge>
                      ))}
                      {operatorStatusBreakdown.map((item) => (
                        <Badge
                          key={item.status}
                          className={actionStatusTone[item.status] || actionStatusTone.new}
                        >
                          {item.status}: {item.count}
                        </Badge>
                      ))}
                      {operatorOwnerBreakdown.map((item) => (
                        <Badge
                          key={item.owner}
                          className={ownerTone[item.owner] || ownerTone["sales watch"]}
                        >
                          {item.owner}: {item.count}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  {operatorQueue.length === 0 ? (
                    <div className="mt-3 rounded-md border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/70">
                      No direct revenue actions surfaced from the current feed. Refresh the stream
                      or widen filters.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {operatorQueue.map((item, index) => (
                        <div
                          key={item.id}
                          className="rounded-md border border-white/10 bg-black/20 px-3 py-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border-emerald-300/20 bg-emerald-500/10 text-emerald-50">
                              score {item.revenueScore}
                            </Badge>
                            <Badge className={priorityTone[item.priority]}>{item.priority}</Badge>
                            <Badge
                              className={urgencyTone[item.urgency] || urgencyTone["watch soon"]}
                            >
                              {item.urgency}
                            </Badge>
                            <Badge
                              className={actionStatusTone[item.status] || actionStatusTone.new}
                            >
                              {item.status}
                            </Badge>
                            <Badge className={ownerTone[item.owner] || ownerTone["sales watch"]}>
                              {item.owner}
                            </Badge>
                            <span className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                              Action {index + 1}
                            </span>
                          </div>
                          <div className="mt-2 text-sm font-medium text-white">{item.task}</div>
                          <div className="mt-1 text-xs text-white/55">{item.title}</div>
                          {item.targetMarket || item.salesAngle ? (
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              {item.targetMarket ? (
                                <div className="rounded-md border border-fuchsia-300/15 bg-fuchsia-500/10 px-3 py-2">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-100/60">
                                    Target
                                  </div>
                                  <div className="mt-1 text-xs text-fuchsia-50">
                                    {item.targetMarket}
                                  </div>
                                </div>
                              ) : null}
                              {item.salesAngle ? (
                                <div className="rounded-md border border-violet-300/15 bg-violet-500/10 px-3 py-2">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-violet-100/60">
                                    Pitch
                                  </div>
                                  <div className="mt-1 text-xs text-violet-50">
                                    {item.salesAngle}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {item.inventorySummary ||
                          item.exampleBusinesses?.length ||
                          item.prospectSummary ||
                          item.marketGapSummary ? (
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              {item.inventorySummary ? (
                                <div className="rounded-md border border-cyan-300/15 bg-cyan-500/10 px-3 py-2">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/60">
                                    Inventory
                                  </div>
                                  <div className="mt-1 text-xs text-cyan-50">
                                    {item.inventorySummary}
                                  </div>
                                </div>
                              ) : null}
                              {item.prospectSummary ? (
                                <div className="rounded-md border border-blue-300/15 bg-blue-500/10 px-3 py-2">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-blue-100/60">
                                    Buyer Classes
                                  </div>
                                  <div className="mt-1 text-xs text-blue-50">
                                    {item.prospectSummary}
                                  </div>
                                </div>
                              ) : null}
                              {item.exampleBusinesses?.length ? (
                                <div className="rounded-md border border-lime-300/15 bg-lime-500/10 px-3 py-2">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-lime-100/60">
                                    Example Businesses
                                  </div>
                                  <div className="mt-1 text-xs text-lime-50">
                                    {item.exampleBusinesses
                                      .map((business) => business.name)
                                      .join(" | ")}
                                  </div>
                                </div>
                              ) : null}
                              {item.marketGapSummary ? (
                                <div className="rounded-md border border-rose-300/15 bg-rose-500/10 px-3 py-2">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-rose-100/60">
                                    Market Gap
                                  </div>
                                  <div className="mt-1 text-xs text-rose-50">
                                    {item.marketGapSummary}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {item.channelSuggestion || item.assetSuggestion || item.whyNow ? (
                            <div className="mt-3 grid gap-2 md:grid-cols-3">
                              {item.channelSuggestion ? (
                                <div className="rounded-md border border-sky-300/15 bg-sky-500/10 px-3 py-2">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-sky-100/60">
                                    Channel
                                  </div>
                                  <div className="mt-1 text-xs text-sky-50">
                                    {item.channelSuggestion}
                                  </div>
                                </div>
                              ) : null}
                              {item.assetSuggestion ? (
                                <div className="rounded-md border border-emerald-300/15 bg-emerald-500/10 px-3 py-2">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-100/60">
                                    Asset
                                  </div>
                                  <div className="mt-1 text-xs text-emerald-50">
                                    {item.assetSuggestion}
                                  </div>
                                </div>
                              ) : null}
                              {item.whyNow ? (
                                <div className="rounded-md border border-amber-300/15 bg-amber-500/10 px-3 py-2">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-amber-100/60">
                                    Why Now
                                  </div>
                                  <div className="mt-1 text-xs text-amber-50">{item.whyNow}</div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(["new", "in progress", "cleared"] as const).map((status) => (
                              <Button
                                key={status}
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "h-8 border-white/10 text-xs capitalize",
                                  item.status === status
                                    ? "bg-white/10 text-white"
                                    : "text-white/60"
                                )}
                                onClick={() => setOperatorActionStatus(item.id, status)}
                              >
                                {status}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-white/60">
                    Recent stream (chronological)
                  </div>
                  <div className="mt-2 space-y-2">
                    {chronologicalStream.map((item) => (
                      <StreamEntryCard key={item.id} item={item} compact />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {!presentationMode && uiMode !== "feed" ? (
        <Card className="bg-tsCard/95 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Stream History</CardTitle>
            <CardDescription className="text-white/70">
              Stored snapshots of the live stream for replay and comparison (last{" "}
              {Math.min(30, Math.max(1, Number.parseInt(historyDays || "7", 10) || 7))} days).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(historyData?.history || []).length === 0 ? (
                <div className="text-sm text-white/65">No stored history available yet.</div>
              ) : (
                historyData?.history.map((snapshot) => (
                  <div
                    key={snapshot.generatedAt}
                    className="rounded-lg border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-white">
                        {new Date(snapshot.generatedAt).toLocaleString()}
                      </div>
                      <div className="text-xs text-white/50">
                        {snapshot.filters?.source || "all sources"} |{" "}
                        {snapshot.filters?.stateCode || "all states"} |{" "}
                        {snapshot.filters?.county || "all counties"}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-white/80">
                      {snapshot.summary.truthNow || "No truth summary recorded."}
                    </div>
                    <div className="mt-2 text-xs text-white/55">
                      {snapshot.stream?.length || 0} entries captured
                    </div>
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-white/15 text-white/75"
                        onClick={() =>
                          setExpandedHistorySnapshot((prev) =>
                            prev === snapshot.generatedAt ? null : snapshot.generatedAt
                          )
                        }
                      >
                        {expandedHistorySnapshot === snapshot.generatedAt
                          ? "Hide captured entries"
                          : "Show captured entries"}
                      </Button>
                    </div>
                    {expandedHistorySnapshot === snapshot.generatedAt ? (
                      <div className="mt-3 space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
                        {(snapshot.stream || []).length === 0 ? (
                          <div className="text-xs text-white/55">
                            No entries stored in this snapshot.
                          </div>
                        ) : (
                          (snapshot.stream || []).map((entry) => (
                            <StreamEntryCard key={entry.id} item={entry} compact />
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
