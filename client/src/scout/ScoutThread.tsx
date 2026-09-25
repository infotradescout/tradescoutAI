import React from "react";
import clsx from "clsx";
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  MapPin,
  MessageSquareText,
  Mic,
  Search,
  Send,
  Shield,
  Sparkles,
  Star,
  Store,
  Users2,
} from "lucide-react";
import type { ScoutActionChip, ScoutLocality, ScoutMode } from "./api";
import type {
  ScoutAction,
  ScoutCluster,
  ScoutKnowledgeSource,
  ScoutMessage,
  ScoutStatus,
} from "./state";
import type { ScoutContextCard } from "./scoutContextCards";
import { isSafeLinkTarget, scoutAllowedActionToAction, validateAction } from "./actionValidation";
import { CommunityCTA } from "@/components/community/CommunityCTA";
import { OnboardingPrompt } from "./OnboardingPrompt";
import { safeScoutSourceUrl } from "./provenance";

/* ----------------------------------------------------------
   ScoutThread — Morphic OS v2
   All sub-components are annotated with @reusable tags.
   They can be imported and used independently anywhere in the app.
   ---------------------------------------------------------- */

type ScoutThreadProps = {
  messages: ScoutMessage[];
  status: ScoutStatus;
  mode?: ScoutMode;
  showControllerExtras?: boolean;
  currentTurnPrimaryAction?: ScoutAction | null;
  onAction?: (action: ScoutAction) => void;
  onResultLinkNavigate?: (url: string) => void;
  onQuickAction?: (text: string) => void;
  onOverride?: (option: NonNullable<ScoutMessage["overrideOption"]>) => void;
  overridePendingScope?: string | null;
  onSendMessage?: (payload: any) => void;
  onPrefill?: (text: string) => void;
  pendingContextCards?: ScoutContextCard[];
  locality?: ScoutLocality;
};

type ScoutThreadScrollTarget = Pick<HTMLElement, "scrollHeight" | "scrollTo">;
type ScoutThreadViewportTarget = Pick<HTMLElement, "clientHeight" | "scrollHeight" | "scrollTop">;
type ScoutThreadMessageTarget = Pick<HTMLElement, "getBoundingClientRect">;

const SCOUT_THREAD_NEAR_LATEST_PX = 32;

export function scrollScoutThreadToLatest(
  thread: ScoutThreadScrollTarget,
  behavior: ScrollBehavior = "auto"
): void {
  thread.scrollTo({ top: thread.scrollHeight, behavior });
}

export function isScoutThreadNearLatest(
  thread: ScoutThreadViewportTarget,
  threshold = SCOUT_THREAD_NEAR_LATEST_PX
): boolean {
  const remaining = thread.scrollHeight - thread.clientHeight - thread.scrollTop;
  return Math.max(0, remaining) <= threshold;
}

export function scrollScoutThreadToNewAnswerStart(
  thread: HTMLElement,
  message: ScoutThreadMessageTarget
): boolean {
  const messageBox = message.getBoundingClientRect();
  if (messageBox.height <= thread.clientHeight) return false;

  const threadBox = thread.getBoundingClientRect();
  const top = thread.scrollTop + messageBox.top - threadBox.top;
  thread.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  return true;
}

function revealScoutSourceChecks(answer: HTMLDivElement): void {
  const thread = answer.closest<HTMLElement>(".scout-thread");
  const toggle = answer.parentElement?.querySelector<HTMLElement>(
    ".scout-message-details-toggle"
  );
  if (!thread || !toggle) return;

  const threadBox = thread.getBoundingClientRect();
  const toggleBox = toggle.getBoundingClientRect();
  const answerBox = answer.getBoundingClientRect();
  const dockBox = document.querySelector<HTMLElement>(".scout-search-dock-fixed")
    ?.getBoundingClientRect();
  const visibleTop = Math.max(0, threadBox.top);
  const visibleBottom = Math.min(
    threadBox.bottom,
    window.innerHeight,
    dockBox && dockBox.height > 0 ? dockBox.top : Infinity
  );
  if (visibleBottom <= visibleTop) return;

  // Keep the disclosure control in view while making its first few lines readable.
  const firstLinesBottom = answerBox.top + Math.min(72, answerBox.height) + 12;
  const needed = Math.max(0, firstLinesBottom - visibleBottom);
  const toggleRoom = Math.max(0, toggleBox.top - visibleTop - 12);
  const availableScroll = Math.max(0, thread.scrollHeight - thread.clientHeight - thread.scrollTop);
  const delta = Math.min(needed, toggleRoom, availableScroll);
  if (delta > 0) {
    thread.scrollTo({ top: thread.scrollTop + delta, behavior: "instant" });
  }
}

function findLatestAssistantMessageId(messages: ScoutMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant") return message.id;
  }
  return null;
}

const SUMMARY_MAX_CHARS = 150;
const MIXED_DISCOVERY_SUMMARY_MAX_CHARS = 150;

function firstUsefulParagraph(content: string): string {
  return (
    String(content || "")
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .find((part) => part.length > 0) ?? ""
  );
}

function trimToSummary(content: string): string {
  const clean = firstUsefulParagraph(content).replace(/\s+/g, " ").trim();
  if (clean.length <= SUMMARY_MAX_CHARS) return clean;

  const sentenceMatch = clean.match(/^(.{70,150}?[.!?])\s/);
  if (sentenceMatch?.[1]) return sentenceMatch[1].trim();

  return `${clean.slice(0, SUMMARY_MAX_CHARS - 3).trim()}...`;
}

function businessAwareMixedDiscoverySummary(clean: string): string | null {
  // The message record retains the server answer, but not metadata.businessCheck.
  // Recognize only the server's controlled sentences before describing a business check.
  if (!/Pages, tools, and other requests were not checked\. Nothing was sent\.$/i.test(clean))
    return null;

  const firstSentence = clean.match(
    /^(.+?)(?= (?:It also found \d+ posted Scout TradeDeals?|It checked Scout promotions|Scout promotions could not|It does not verify deals)\b)/i
  )?.[1];
  const foundPost = firstSentence?.match(
    /^This Scout result includes (\d{1,4}) published county posts? from the last 7 days in (.+)\.$/i
  );
  const emptyPost = firstSentence?.match(
    /^Scout checked published county posts from the last 7 days in (.+); none were returned\.$/i
  );
  const failedPost = firstSentence?.match(
    /^Published county posts from the last 7 days in (.+) could not be checked right now\.$/i
  );
  const unverifiedPost = firstSentence?.match(
    /^This Scout result does not verify a county post from the last 7 days in (.+)\.$/i
  );
  if (!foundPost && !emptyPost && !failedPost && !unverifiedPost) return null;

  const rawArea = (
    foundPost?.[2] ||
    emptyPost?.[1] ||
    failedPost?.[1] ||
    unverifiedPost?.[1] ||
    ""
  ).trim();
  const area =
    (/^[a-z .'-]+, [a-z]{2}$/i.test(rawArea) && rawArea.length <= 45) || rawArea === "your county"
      ? rawArea
      : "your county";
  const postedDeals = clean.match(
    /\bIt also found (\d{1,4}) posted Scout TradeDeals? for (.+?)\. These are promotional listings; terms and availability are not independently verified\. Confirm when each offer ends before acting\./i
  );
  const emptyDeals = clean.match(
    /\bIt checked Scout promotions for (.+?); no eligible TradeDeals were returned\. Other deal sources were not checked\./i
  );
  const failedDeals = /\bScout promotions could not be checked right now\./i.test(clean);
  const uncheckedDeals = /\bIt does not verify deals\./i.test(clean);
  const foundBusiness = clean.match(
    /\bScout also found (\d{1,4}) public business profiles? listed for (.+?)\. Business profiles were not filtered to this week; check current services and availability before contact\./i
  );
  const emptyBusiness = clean.match(
    /\bScout checked public business profiles for (.+?); none were returned\./i
  );
  const failedBusiness = clean.match(
    /\bPublic business profiles for (.+?) could not be checked right now\./i
  );
  const uncheckedBusiness = /\bBusinesses were not checked\./i.test(clean);
  if (
    (!postedDeals && !emptyDeals && !failedDeals && !uncheckedDeals) ||
    (!foundBusiness && !emptyBusiness && !failedBusiness && !uncheckedBusiness)
  )
    return null;

  const scopedAreas = [
    postedDeals?.[2],
    emptyDeals?.[1],
    foundBusiness?.[2],
    emptyBusiness?.[1],
    failedBusiness?.[1],
  ].filter((value): value is string => Boolean(value));
  if (scopedAreas.some((value) => value.trim().toLowerCase() !== rawArea.toLowerCase())) {
    return trimToSummary(clean);
  }

  const post = foundPost
    ? `${foundPost[1]} post${foundPost[1] === "1" ? "" : "s"} (7 days)`
    : emptyPost
      ? "no posts (7 days)"
      : failedPost
        ? "posts could not be checked"
        : "posts not verified";
  const deal = postedDeals
    ? `${postedDeals[1]} TradeDeal${postedDeals[1] === "1" ? "" : "s"}`
    : emptyDeals
      ? "no eligible TradeDeals"
      : failedDeals
        ? "promotions could not be checked"
        : "deals not checked";
  const business = foundBusiness
    ? `${foundBusiness[1]} public business${foundBusiness[1] === "1" ? "" : "es"}`
    : emptyBusiness
      ? "no public businesses"
      : failedBusiness
        ? "businesses could not be checked"
        : "businesses not checked";
  const format = (place: string) =>
    `${place}: ${post}, ${deal}, ${business}. Other sources unchecked. Nothing was sent.`;
  const summary = format(area);
  return summary.length <= MIXED_DISCOVERY_SUMMARY_MAX_CHARS ? summary : format("your county");
}

function mixedDiscoverySummary(content: string): string {
  const clean = content.replace(/\s+/g, " ").trim();
  const businessAwareSummary = businessAwareMixedDiscoverySummary(clean);
  if (businessAwareSummary) return businessAwareSummary;
  if (
    /^Set your county to browse nearby posts\./i.test(clean) &&
    /does not verify county posts, deals, businesses, pages, tools, or requests/i.test(clean) &&
    /nothing was sent/i.test(clean)
  ) {
    return "Set your county to browse nearby posts. Posts, deals, businesses, pages, tools and requests unchecked. Nothing sent.";
  }

  const checkedEmptyPost = clean.match(
    /^Scout checked published county posts from the last 7 days in ([^;]{0,80}); none were returned\./i
  );
  const failedPost = clean.match(
    /^Published county posts from the last 7 days in (.{0,80}?) could not be checked right now\./i
  );
  const legacyFailedPost = /^County posts could not be checked right now\./i.test(clean);
  if ((checkedEmptyPost || failedPost || legacyFailedPost) && /nothing was sent/i.test(clean)) {
    // This area comes only from the exact opening sentence built by the server.
    const rawArea = (checkedEmptyPost?.[1] || failedPost?.[1] || "").trim();
    const area =
      (/^[a-z .'-]+, [a-z]{2}$/i.test(rawArea) && rawArea.length <= 80) || rawArea === "your county"
        ? rawArea
        : "your county";
    const postUnavailable = Boolean(failedPost || legacyFailedPost);
    const postedDeals = clean.match(/\bIt also found (\d+) posted Scout TradeDeals? for /i);
    if (
      postedDeals &&
      !/These are promotional listings; terms and availability are not independently verified/i.test(
        clean
      )
    ) {
      return trimToSummary(clean);
    }
    const dealStatus = postedDeals
      ? `${postedDeals[1]} promotional TradeDeal${postedDeals[1] === "1" ? "" : "s"}. Terms/end unverified`
      : /It checked Scout promotions for .+?; no eligible TradeDeals were returned/i.test(clean)
        ? "no eligible Scout TradeDeals"
        : /Scout promotions could not be checked right now/i.test(clean)
          ? "Scout promotions unavailable"
          : "deals unchecked";
    const formatSummary = (compact: boolean, place: string) => {
      const postStatus = postUnavailable
        ? compact
          ? "published posts from last 7 days unavailable"
          : "published county posts from last 7 days unavailable"
        : compact
          ? "no published posts in last 7 days"
          : "no published county posts returned in last 7 days";
      const visibleDealStatus =
        compact && postedDeals
          ? `${postedDeals[1]} TradeDeal promotion${postedDeals[1] === "1" ? "" : "s"}. Terms/end unverified`
          : dealStatus;
      const readablePostStatus = place
        ? postStatus
        : `${postStatus[0].toUpperCase()}${postStatus.slice(1)}`;
      return `${place ? `${place}: ` : ""}${readablePostStatus}; ${visibleDealStatus}. Other sources unchecked. Nothing sent.`;
    };
    let summary = formatSummary(false, area);
    if (summary.length > SUMMARY_MAX_CHARS) summary = formatSummary(true, area);
    if (summary.length > SUMMARY_MAX_CHARS && area) {
      // The full place name remains under More detail when an unusual label is long.
      const room = SUMMARY_MAX_CHARS - (summary.length - area.length) - 3;
      summary = formatSummary(true, `${area.slice(0, room).trimEnd()}...`);
    }
    return summary;
  }

  // Prefer the server's validated county-label shape so periods inside a county name stay intact.
  const found =
    clean.match(
      /^This Scout result includes (\d+) published county (post|posts) from the last 7 days in ([a-z .'-]+, [a-z]{2}|your county)\./i
    ) ??
    clean.match(
      /^This Scout result includes (\d+) published county (post|posts) from the last 7 days in (.{0,80}?)\./i
    );
  const missing =
    clean.match(
      /^This Scout result does not verify a county post from the last 7 days in ([a-z .'-]+, [a-z]{2}|your county)\./i
    ) ??
    clean.match(
      /^This Scout result does not verify a county post from the last 7 days in (.{0,80}?)\./i
    );
  if ((!found && !missing) || !/nothing was sent/i.test(clean)) return trimToSummary(clean);

  const rawArea = (found?.[3] || missing?.[1] || "").trim();
  const area =
    (/^[a-z .'-]+, [a-z]{2}$/i.test(rawArea) && rawArea.length <= 80) || rawArea === "your county"
      ? rawArea
      : "your county";
  const postedDeals = clean.match(/\bIt also found (\d+) posted Scout TradeDeals? for /i);
  const checkedNoDeals =
    /It checked Scout promotions for .+?; no eligible TradeDeals were returned/i.test(clean);
  const failedDeals = /Scout promotions could not be checked right now/i.test(clean);
  const uncheckedDeals = /It does not verify deals/i.test(clean);
  if (
    (postedDeals &&
      !/These are promotional listings; terms and availability are not independently verified/i.test(
        clean
      )) ||
    (!postedDeals && !checkedNoDeals && !failedDeals && !uncheckedDeals)
  ) {
    return trimToSummary(clean);
  }

  const formatPositiveSummary = (compact: boolean, place: string) => {
    const postStatus = found
      ? compact
        ? `${found[1]} published 7-day ${found[2]}`
        : `${found[1]} published ${found[2]} in last 7 days`
      : compact
        ? "no 7-day post verified"
        : "no post verified in last 7 days";
    const dealStatus = postedDeals
      ? compact
        ? `${postedDeals[1]} TradeDeal promo${postedDeals[1] === "1" ? "" : "s"}. Offer unverified; check end`
        : `${postedDeals[1]} promotional TradeDeal${postedDeals[1] === "1" ? "" : "s"}. Offer unverified; confirm end`
      : checkedNoDeals
        ? "no eligible Scout TradeDeals"
        : failedDeals
          ? "Scout promotions unavailable"
          : "deals unchecked";
    return `${place}: ${postStatus}; ${dealStatus}. Other sources unchecked. Nothing sent.`;
  };
  let summary = formatPositiveSummary(false, area);
  if (summary.length > SUMMARY_MAX_CHARS) summary = formatPositiveSummary(true, area);
  if (summary.length > SUMMARY_MAX_CHARS) {
    // Keep the state visible; the full county label remains under More detail.
    const room = SUMMARY_MAX_CHARS - (summary.length - area.length) - 3;
    const state = area.match(/, [a-z]{2}$/i)?.[0] || "";
    const shortArea =
      room > state.length + 6
        ? `${area.slice(0, room - state.length).trimEnd()}...${state}`
        : "your county";
    summary = formatPositiveSummary(true, shortArea);
  }
  return summary;
}

type DiscoveryCheckStatus = "checked" | "error" | "not_checked";

type DiscoveryCheck = {
  status: DiscoveryCheckStatus;
  shownCount: number;
  topicFiltered: boolean;
};

type DiscoveryChecks = {
  areaLabel: string;
  topic: string | null;
  posts: DiscoveryCheck;
  deals: DiscoveryCheck;
  businesses: DiscoveryCheck;
};

function readDiscoveryChecks(msg: ScoutMessage): DiscoveryChecks | null {
  if (msg.provenance?.sourceUsed !== "scout_mixed_discovery_recovery") return null;
  const metadata = msg.metadata;
  const raw = metadata?.discoveryChecks;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const values = raw as Record<string, unknown>;
  const readCheck = (value: unknown): DiscoveryCheck | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const check = value as Record<string, unknown>;
    if (
      check.status !== "checked" &&
      check.status !== "error" &&
      check.status !== "not_checked"
    )
      return null;
    if (
      typeof check.shownCount !== "number" ||
      !Number.isInteger(check.shownCount) ||
      check.shownCount < 0 ||
      check.shownCount > 100
    )
      return null;
    return {
      status: check.status,
      shownCount: check.shownCount,
      topicFiltered: check.topicFiltered === true,
    };
  };
  const posts = readCheck(values.posts);
  const deals = readCheck(values.deals);
  const businesses = readCheck(values.businesses);
  if (!posts || !deals || !businesses) return null;
  const areaLabel =
    typeof values.areaLabel === "string" && values.areaLabel.trim().length <= 80
      ? values.areaLabel.trim()
      : "your county";
  const rawTopic = metadata?.discoveryTopic;
  const topic =
    typeof rawTopic === "string" && rawTopic.trim().length > 0 && rawTopic.trim().length <= 60
      ? rawTopic.trim()
      : null;
  return { areaLabel, topic, posts, deals, businesses };
}

function topicDiscoverySummary(msg: ScoutMessage): string | null {
  const checks = readDiscoveryChecks(msg);
  if (!checks?.topic || !checks.posts.topicFiltered || !checks.businesses.topicFiltered)
    return null;
  const topic = checks.topic.length <= 24 ? checks.topic : `${checks.topic.slice(0, 21).trimEnd()}...`;
  const posts =
    checks.posts.status === "checked"
      ? `${checks.posts.shownCount} post match${checks.posts.shownCount === 1 ? "" : "es"} (7 days)`
      : checks.posts.status === "error"
        ? "posts unavailable"
        : "posts unchecked";
  const businesses =
    checks.businesses.status === "checked"
      ? `${checks.businesses.shownCount} business name match${checks.businesses.shownCount === 1 ? "" : "es"}`
      : checks.businesses.status === "error"
        ? "businesses unavailable"
        : "businesses unchecked";
  const deals =
    checks.deals.status === "checked"
      ? `${checks.deals.shownCount} county TradeDeal${checks.deals.shownCount === 1 ? "" : "s"} (topic unchecked)`
      : checks.deals.status === "error"
        ? "deals unavailable"
        : "deals unchecked";
  const format = (place: string) =>
    `${place}: ${topic}: ${posts}, ${businesses}; ${deals}. Other sources unchecked. Nothing sent.`;
  const area =
    /^[a-z .'-]+, [a-z]{2}$/i.test(checks.areaLabel) && checks.areaLabel.length <= 45
      ? checks.areaLabel
      : "Your county";
  const summary = format(area);
  if (summary.length <= MIXED_DISCOVERY_SUMMARY_MAX_CHARS) return summary;
  const countySummary = format("Your county");
  if (countySummary.length <= MIXED_DISCOVERY_SUMMARY_MAX_CHARS) return countySummary;
  return `${topic}: ${posts}, ${businesses}; ${deals}. More sources unchecked. Nothing sent.`;
}

function tryParseScoutEnvelope(raw: string): Record<string, unknown> | null {
  const text = String(raw || "").trim();
  if (!text || (!text.startsWith("{") && !text.startsWith("["))) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function coerceReadableAssistantContent(content: string): string {
  const envelope = tryParseScoutEnvelope(content);
  if (!envelope) return content;

  const nestedResponse =
    envelope.response && typeof envelope.response === "object" && !Array.isArray(envelope.response)
      ? (envelope.response as Record<string, unknown>)
      : null;

  const primaryMessage = [
    envelope.message,
    envelope.summary,
    envelope.answer,
    envelope.text,
    nestedResponse?.message,
    nestedResponse?.text,
  ].find((value) => typeof value === "string" && value.trim().length > 0) as string | undefined;

  if (!primaryMessage) return content;

  const intent =
    typeof envelope.intent === "string" && envelope.intent.trim().length > 0
      ? humanizeToken(envelope.intent)
      : "";

  if (!intent) return primaryMessage.trim();
  return `${primaryMessage.trim()}\n\nIntent: ${intent}`;
}

function shouldSummarizeAssistantMessage(msg: ScoutMessage): boolean {
  const hasResultSurface = Boolean(
    msg.resultContract ||
    msg.frame ||
    (Array.isArray(msg.clusters) && msg.clusters.length > 0) ||
    (Array.isArray(msg.suggestedActions) && msg.suggestedActions.length > 0) ||
    msg.overrideOption ||
    msg.onboarding?.active
  );
  return hasResultSurface && String(msg.content || "").trim().length > SUMMARY_MAX_CHARS;
}

function buildAssistantSummary(msg: ScoutMessage, displayContent: string): string {
  if (msg.provenance?.sourceUsed === "scout_mixed_discovery_recovery") {
    return topicDiscoverySummary(msg) || mixedDiscoverySummary(displayContent);
  }
  if (!shouldSummarizeAssistantMessage(msg)) return displayContent;

  const frame = msg.frame;
  const framedSummary =
    frame?.directionLine?.trim() ||
    frame?.meaningLine?.trim() ||
    (Array.isArray(frame?.truthLines) ? frame?.truthLines?.find((line) => line.trim()) : "");

  return trimToSummary(framedSummary || displayContent);
}

function hasExplicitMixedCoverage(msg: ScoutMessage, answer: string): boolean {
  return (
    msg.provenance?.sourceUsed === "scout_mixed_discovery_recovery" &&
    /(?:^|[.!?]\s+)Pages, tools, and other requests were not checked\. Nothing was sent\.$/i.test(
      answer.trim()
    )
  );
}

function mixedDiscoverySourceChecks(msg: ScoutMessage, answer: string): Array<{ source: string; status: string }> {
  const checks = readDiscoveryChecks(msg);
  if (checks) {
    const status = (check: DiscoveryCheck, checked: string) =>
      check.status === "checked"
        ? checked
        : check.status === "error"
          ? "Could not check"
          : "Not checked";
    return [
      {
        source: "County posts (past 7 days)",
        status: status(checks.posts, checks.topic ? "Checked for topic" : "Checked"),
      },
      {
        source: "Scout TradeDeals",
        status: status(
          checks.deals,
          checks.topic ? "Checked county offers; not topic matched" : "Checked promotions"
        ),
      },
      {
        source: "Public business profiles",
        status: status(
          checks.businesses,
          checks.topic ? "Checked names for topic; not this week" : "Checked; not this week"
        ),
      },
      { source: "Pages, tools and requests", status: "Not checked" },
    ];
  }
  const clean = answer.replace(/\s+/g, " ").trim();
  const postsChecked =
    /(?:This Scout result includes \d+ published county posts? from the last 7 days|Scout checked published county posts from the last 7 days)/i.test(
      clean
    );
  const dealsChecked =
    /(?:It also found \d+ posted Scout TradeDeals?|It checked Scout promotions for)/i.test(clean);
  const businessesChecked =
    /(?:Scout also found \d+ public business profiles?|Scout checked public business profiles for)/i.test(
      clean
    );
  return [
    {
      source: "County posts (past 7 days)",
      status: postsChecked
        ? "Checked"
        : /Published county posts from the last 7 days .+ could not be checked right now\./i.test(clean)
          ? "Could not check"
          : "Not verified",
    },
    {
      source: "Scout TradeDeals",
      status: dealsChecked
        ? "Checked promotions"
        : /Scout promotions could not be checked right now\./i.test(clean)
          ? "Could not check"
          : "Not verified",
    },
    {
      source: "Public business profiles",
      status: businessesChecked
        ? "Checked; not limited to this week"
        : /Public business profiles for .+ could not be checked right now\./i.test(clean)
          ? "Could not check"
          : "Not checked",
    },
    { source: "Pages, tools and requests", status: "Not checked" },
  ];
}

function AssistantMessageBubble({ summary }: { summary: string }) {
  return summary ? <p className="whitespace-pre-line leading-relaxed">{summary}</p> : null;
}

function humanizeToken(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeActionText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function actionTarget(action: ScoutAction): string {
  return String(action.to || action.path || action.prompt || action.payload?.route || action.type);
}

function actionsMatch(left: ScoutAction, right: ScoutAction): boolean {
  const identity = (action: ScoutAction) => {
    const target =
      action.to ||
      action.path ||
      action.prompt ||
      action.payload?.route ||
      action.payload?.name ||
      JSON.stringify(action.payload || {});
    return [
      action.type,
      normalizeActionText(action.label || ""),
      String(target).toLowerCase(),
    ].join("::");
  };

  return identity(left) === identity(right);
}

function validatedEntityUrl(url: unknown): string | undefined {
  if (typeof url !== "string" || !isSafeLinkTarget(url)) return undefined;
  const action = validateAction({ type: "NAVIGATE", to: url, label: "Open result" });
  return action?.type === "NAVIGATE" && (action.to || action.path) === url ? url : undefined;
}

export function inAppScoutResultPath(safeUrl: string, origin: string): string | null {
  let path = safeUrl;
  if (!safeUrl.startsWith("/") || safeUrl.startsWith("//")) {
    try {
      const parsed = new URL(safeUrl);
      if (
        parsed.protocol !== "https:" ||
        parsed.origin !== origin ||
        parsed.username ||
        parsed.password
      ) {
        return null;
      }
      path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return null;
    }
  }
  const action = validateAction({ type: "NAVIGATE", to: path, label: "Open result" });
  return action?.type === "NAVIGATE" && (action.to || action.path) === path ? path : null;
}

function frameChipToAction(chip: ScoutActionChip): ScoutAction {
  const args =
    chip.args && typeof chip.args === "object" ? (chip.args as Record<string, unknown>) : undefined;
  if (chip.kind === "NAVIGATE") {
    return {
      type: "NAVIGATE",
      label: chip.label,
      to: chip.target,
      path: chip.target,
      payload: args,
      primary: chip.priority === "primary",
    };
  }
  return {
    type: chip.kind,
    label: chip.label,
    payload: { ...(args || {}), name: chip.target },
    primary: chip.priority === "primary",
  };
}

function clusterKindMeta(kind: ScoutCluster["kind"]) {
  switch (kind) {
    case "pros":
      return { label: "Local help", icon: Users2, emoji: "🔧" };
    case "marketplace":
      return { label: "Exchange", icon: Store, emoji: "🛒" };
    case "community":
      return { label: "Local posts", icon: MessageSquareText };
    case "projects":
      return { label: "Saved local request", icon: ClipboardList };
    case "rules":
      return { label: "What to check", icon: BadgeCheck };
    case "site":
      return { label: "Search", icon: Search };
    case "account":
      return { label: "Account", icon: BadgeCheck, emoji: "👤" };
    default:
      return { label: "Result", icon: Search, emoji: "📌" };
  }
}

function mergeClusterActions(cluster: ScoutCluster): ScoutAction[] {
  const candidates = [
    ...(cluster.primaryAction ? [{ ...cluster.primaryAction, primary: true }] : []),
    ...(Array.isArray(cluster.actions) ? cluster.actions : []),
  ];
  const seen = new Set<string>();
  const merged: ScoutAction[] = [];
  for (const action of candidates) {
    const key = [action.type, normalizeActionText(action.label || ""), actionTarget(action)].join(
      "|"
    );
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(action);
  }
  return merged;
}

function buildEvidenceChips(msg: ScoutMessage): string[] {
  const provenance = msg.provenance;
  if (!provenance) return [];
  const chips: string[] = [];
  if (provenance.sourceUsed) chips.push(`Source: ${humanizeToken(provenance.sourceUsed)}`);
  if (provenance.confidenceBand)
    chips.push(`Confidence: ${humanizeToken(provenance.confidenceBand)}`);
  if (typeof provenance.knowledgeLayer === "number")
    chips.push(`Layer: ${provenance.knowledgeLayer}`);
  if (provenance.fallbackUsed) chips.push("Fallback: Active");
  if (provenance.degradationReason)
    chips.push(`Degraded: ${humanizeToken(provenance.degradationReason)}`);
  if (provenance.blockingReason)
    chips.push(`Authority: Gated (${humanizeToken(provenance.blockingReason)})`);
  else if (Array.isArray(provenance.allowedActions) && provenance.allowedActions.length > 0)
    chips.push("Authority: Clear");
  return chips;
}

/* ----------------------------------------------------------
   @reusable: EvidenceStrip
  Use: Collapsible "Why this answer" strip below any Scout message.
   Shows provenance chips and source titles when expanded.
   ---------------------------------------------------------- */
export function EvidenceSourceList({ sources }: { sources: ScoutKnowledgeSource[] }) {
  const usableSources = sources.filter(
    (source) => source.type !== "url_citation" || Boolean(safeScoutSourceUrl(source.url))
  );
  if (usableSources.length === 0) return null;
  const linkedSources = usableSources.filter((source) => safeScoutSourceUrl(source.url));
  const contextSources = usableSources.filter((source) => !safeScoutSourceUrl(source.url));

  const renderSources = (items: ScoutKnowledgeSource[]) =>
    items.map((source, index) => {
      const url = safeScoutSourceUrl(source.url);
      return (
        <React.Fragment key={`${source.title}-${url || index}`}>
          {index > 0 ? " · " : null}
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {source.title}
            </a>
          ) : (
            <span>{source.title}</span>
          )}
        </React.Fragment>
      );
    });

  return (
    <div className="space-y-1 text-xs leading-relaxed text-[color:var(--text-secondary)]">
      {linkedSources.length > 0 ? <div>Sources: {renderSources(linkedSources)}</div> : null}
      {contextSources.length > 0 ? <div>Context: {renderSources(contextSources)}</div> : null}
    </div>
  );
}

function EvidenceStrip({ msg, enabled }: { msg: ScoutMessage; enabled: boolean }) {
  const [open, setOpen] = React.useState(false);
  const chips = React.useMemo(() => buildEvidenceChips(msg), [msg]);
  const evidenceSources = React.useMemo(() => {
    const detailedSources = Array.isArray(msg.provenance?.sources) ? msg.provenance.sources : [];
    const sourceTitles = Array.isArray(msg.provenance?.sourceTitles)
      ? msg.provenance?.sourceTitles
      : [];
    const merged = [...detailedSources];
    for (const title of sourceTitles) {
      if (!merged.some((source) => source.title === title)) merged.push({ title });
    }
    return [
      ...merged.filter((source) => safeScoutSourceUrl(source.url)),
      ...merged.filter((source) => !safeScoutSourceUrl(source.url)),
    ].slice(0, 2);
  }, [msg.provenance?.sourceTitles, msg.provenance?.sources]);

  if (!enabled) return null;
  if (chips.length === 0 && evidenceSources.length === 0) return null;

  return (
    <div className="scout-evidence-strip mt-2 px-1" aria-label="Scout evidence and authority">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-full px-3 py-1 transition-colors"
        style={{
          color: "rgba(249,115,22,0.7)",
          background: "rgba(249,115,22,0.06)",
          border: "1px solid rgba(249,115,22,0.15)",
        }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "Hide details" : "Why this helps"}
        <Shield size={10} />
      </button>
      {open && (
        <div
          className="mt-2 space-y-1.5 rounded-xl p-3"
          style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle)" }}
        >
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <span
                  key={`${msg.id}-${chip}`}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(250,250,250,0.5)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
          <EvidenceSourceList sources={evidenceSources} />
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------
   @reusable: ClusterCard (Morphic OS upgrade)
   Use: Renders a single Scout result cluster as a dark card with optional
   featured (orange border) treatment, status badges, meta rows, and action buttons.
   Drop-in replacement for the legacy .scout-result-card anywhere in the app.
   ---------------------------------------------------------- */
function ClusterCard({
  cluster,
  onAction,
  currentTurnPrimaryAction,
}: {
  cluster: ScoutCluster;
  onAction?: (action: ScoutAction) => void;
  currentTurnPrimaryAction?: ScoutAction | null;
}) {
  const handleAction = (action: ScoutAction) => {
    if (onAction) {
      const validated = validateAction(action);
      if (validated) onAction(validated);
    }
  };

  const [showAllActions, setShowAllActions] = React.useState(false);
  const kindMeta = clusterKindMeta(cluster.kind);
  const KindIcon = kindMeta.icon;
  const isFeatured = Boolean(cluster.primaryAction);

  const prioritizedActions = React.useMemo(() => {
    const actions = mergeClusterActions(cluster).filter(
      (action) =>
        !(
          currentTurnPrimaryAction &&
          action.primary === true &&
          actionsMatch(action, currentTurnPrimaryAction)
        )
    );
    return [...actions].sort((a, b) => {
      if (a.primary !== b.primary) return a.primary ? -1 : 1;
      const aIsNavigate = a.type === "NAVIGATE";
      const bIsNavigate = b.type === "NAVIGATE";
      if (aIsNavigate !== bIsNavigate) return aIsNavigate ? -1 : 1;
      const aIsAsk = a.type === "ASK_SCOUT";
      const bIsAsk = b.type === "ASK_SCOUT";
      if (aIsAsk !== bIsAsk) return aIsAsk ? 1 : -1;
      return 0;
    });
  }, [cluster, currentTurnPrimaryAction]);

  const visibleActions = React.useMemo(
    () => (showAllActions ? prioritizedActions : prioritizedActions.slice(0, 3)),
    [prioritizedActions, showAllActions]
  );

  return (
    <article className={clsx("scout-cluster-card", isFeatured && "scout-cluster-card--featured")}>
      {/* Featured tag */}
      {isFeatured && (
        <div className="scout-cluster-card__tag">
          <Star size={10} />
          Best next step
        </div>
      )}

      {/* Header row */}
      <div className="scout-cluster-card__header">
        <div className="scout-cluster-card__icon-wrap">
          <span aria-hidden="true">{kindMeta.emoji}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="scout-cluster-card__title">{cluster.title || kindMeta.label}</div>
          <div className="scout-cluster-card__subtitle">{kindMeta.label}</div>
        </div>
        <div className="scout-cluster-card__chevron" aria-hidden="true">
          <ChevronRight size={14} />
        </div>
      </div>

      {/* Body text */}
      {cluster.body && (
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "rgba(250,250,250,0.6)" }}>
          {cluster.body}
        </p>
      )}

      {/* Items list */}
      {cluster.items && cluster.items.length > 0 && (
        <ul className="mt-3 space-y-2 list-none p-0">
          {cluster.items.map((item) => (
            <li
              key={item.id}
              className="flex gap-2.5 rounded-xl p-2.5"
              style={{
                background: "var(--surface-intermediate)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <Bookmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ts-orange" />
              <span className="min-w-0">
                <span
                  className="block text-[13px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {item.label}
                </span>
                {item.description && (
                  <span
                    className="mt-0.5 block text-[11px]"
                    style={{ color: "rgba(250,250,250,0.45)" }}
                  >
                    {item.description}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Meta row */}
      {(cluster as any).distance && (
        <div className="scout-cluster-card__meta-row mt-3">
          <span className="scout-cluster-card__meta-item">
            <MapPin size={11} />
            {(cluster as any).distance}
          </span>
          {(cluster as any).walkTime && (
            <span className="scout-cluster-card__meta-item">{(cluster as any).walkTime}</span>
          )}
          {(cluster as any).availability && (
            <span className="scout-cluster-card__meta-item">{(cluster as any).availability}</span>
          )}
        </div>
      )}

      {/* Action buttons */}
      {prioritizedActions.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {visibleActions.map((action) => (
              <button
                key={`${cluster.id}-${action.type}-${action.label}-${actionTarget(action)}`}
                type="button"
                onClick={() => handleAction(action)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors",
                  action.primary
                    ? "scout-tool-tray__btn--primary scout-tool-tray__btn"
                    : "scout-tool-tray__btn--secondary scout-tool-tray__btn"
                )}
                style={{ minHeight: "36px", textTransform: "none", letterSpacing: "normal" }}
              >
                {action.type === "ASK_SCOUT" ? <HelpCircle size={13} /> : <ArrowRight size={13} />}
                <span className="flex flex-col items-start text-left">
                  <span>{action.label}</span>
                  {action.subtitle && (
                    <span className="text-[10px] opacity-75">{action.subtitle}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
          {prioritizedActions.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllActions((v) => !v)}
              className="text-[10px] font-semibold rounded-full px-3 py-1"
              style={{
                color: "rgba(249,115,22,0.7)",
                background: "rgba(249,115,22,0.06)",
                border: "1px solid rgba(249,115,22,0.15)",
              }}
            >
              {showAllActions ? "Show fewer" : `More actions (${prioritizedActions.length - 3})`}
            </button>
          )}
        </div>
      )}

      {/* CommunityCTA */}
      {cluster.ctaSource && cluster.ctaContextId && (
        <div className="mt-3 space-y-1">
          {cluster.ctaLabel && cluster.ctaSource === "trade_deal" && (
            <div className="text-[11px]" style={{ color: "rgba(250,250,250,0.4)" }}>
              {cluster.ctaLabel}
            </div>
          )}
          <CommunityCTA
            layout="inline"
            source={cluster.ctaSource}
            contextId={cluster.ctaContextId}
            ownerUserId={cluster.ctaOwnerUserId}
            canDirectConnect={cluster.ctaCanDirectConnect}
            canMessage={cluster.ctaCanMessage}
            disableDirectConnect={cluster.ctaDisableDirectConnect}
          />
        </div>
      )}
    </article>
  );
}

/* ----------------------------------------------------------
   @reusable: MessageExtras
   Use: Renders action chips, cluster cards, override options, suggestions,
  and onboarding prompts below any Scout message.
   ---------------------------------------------------------- */
function MessageExtras({
  msg,
  isUser,
  showControllerExtras,
  currentTurnPrimaryAction,
  fullAnswer,
  answerSummary,
  onAction,
  onResultLinkNavigate,
  onQuickAction,
  onOverride,
  overridePendingScope,
  onSendMessage,
}: {
  msg: ScoutMessage;
  isUser: boolean;
  showControllerExtras: boolean;
  currentTurnPrimaryAction?: ScoutAction | null;
  fullAnswer?: string;
  answerSummary?: string;
  onAction?: (action: ScoutAction) => void;
  onResultLinkNavigate?: (url: string) => void;
  onQuickAction?: (text: string) => void;
  onOverride?: (option: NonNullable<ScoutMessage["overrideOption"]>) => void;
  overridePendingScope?: string | null;
  onSendMessage?: (payload: any) => void;
}) {
  if (isUser) return null;

  const hasResultContract = msg.resultContract?.contract_version === "scout_result.v1";
  const contractActionEntries = React.useMemo(
    () =>
      (msg.resultContract?.allowed_actions || []).flatMap((source) => {
        const action = scoutAllowedActionToAction(source);
        return action ? [{ source, action }] : [];
      }),
    [msg.resultContract?.allowed_actions]
  );
  const ambiguityActions = React.useMemo(
    () =>
      (msg.resultContract?.ambiguity_options || []).flatMap((option) => {
        const entry = contractActionEntries.find(
          ({ source }) => source.action_id === option.action_id
        );
        return entry ? [{ option, action: entry.action }] : [];
      }),
    [contractActionEntries, msg.resultContract?.ambiguity_options]
  );
  const ambiguityActionIds = React.useMemo(
    () => new Set((msg.resultContract?.ambiguity_options || []).map((option) => option.action_id)),
    [msg.resultContract?.ambiguity_options]
  );
  const contractEntities = msg.resultContract?.entities || [];
  const entityActionIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const entity of contractEntities) {
      const safeUrl = validatedEntityUrl(entity.url);
      if (!safeUrl) continue;
      const entry = contractActionEntries.find(
        ({ action }) => action.type === "NAVIGATE" && (action.to || action.path) === safeUrl
      );
      if (entry) ids.add(entry.source.action_id);
    }
    return ids;
  }, [contractActionEntries, contractEntities]);
  const remainingContractActions = React.useMemo(
    () =>
      contractActionEntries.filter(
        ({ source }) =>
          !ambiguityActionIds.has(source.action_id) && !entityActionIds.has(source.action_id)
      ),
    [ambiguityActionIds, contractActionEntries, entityActionIds]
  );
  const standalonePrimaryAction = remainingContractActions.find(
    ({ source }) => source.primary === true
  );
  const secondaryContractActions = remainingContractActions.filter(
    ({ source }) => source.action_id !== standalonePrimaryAction?.source.action_id
  );
  const hasContractActions = ambiguityActions.length > 0 || secondaryContractActions.length > 0;
  const hasContractEntities = contractEntities.length > 0;
  const hasLegacyPrimaryAction = !hasResultContract && Boolean(currentTurnPrimaryAction);
  const hasClusters = !hasResultContract && Boolean(msg.clusters && msg.clusters.length > 0);
  const hasOverride = !hasResultContract && Boolean(msg.overrideOption);
  const hasOnboardingPrompt = Boolean(
    msg.onboarding?.active && Boolean(msg.onboarding.question) && Boolean(onSendMessage)
  );
  const hasAnswerDetails = Boolean(
    fullAnswer && answerSummary && fullAnswer.trim() !== answerSummary.trim()
  );
  const hasMixedDiscoveryCoverage = hasExplicitMixedCoverage(msg, fullAnswer || "");

  const [controllerOpen, setControllerOpen] = React.useState(() => !showControllerExtras);
  const [controllerShowAll, setControllerShowAll] = React.useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = React.useState(false);
  const [answerOpen, setAnswerOpen] = React.useState(false);
  const [refineOpen, setRefineOpen] = React.useState(false);
  const [refineTopic, setRefineTopic] = React.useState("");
  const [refineError, setRefineError] = React.useState("");
  const canRefineCountyResults =
    hasMixedDiscoveryCoverage &&
    Boolean(onAction) &&
    !/^Set your county to browse nearby posts\./i.test(fullAnswer || "");
  const revealSourceChecksOnMount = React.useCallback((answer: HTMLDivElement | null) => {
    if (answer) revealScoutSourceChecks(answer);
  }, []);

  const prioritizedActionChips = React.useMemo(() => {
    const chips = Array.isArray(msg.frame?.actionChips) ? msg.frame.actionChips : [];
    const availableChips = chips.filter(
      (chip) =>
        !(
          currentTurnPrimaryAction &&
          chip.priority === "primary" &&
          actionsMatch(frameChipToAction(chip), currentTurnPrimaryAction)
        )
    );
    return [...availableChips].sort((a, b) => {
      const aIsNavigate = a.kind === "NAVIGATE";
      const bIsNavigate = b.kind === "NAVIGATE";
      if (aIsNavigate !== bIsNavigate) return aIsNavigate ? -1 : 1;
      const aHasSubtitle = Boolean(a.subtitle);
      const bHasSubtitle = Boolean(b.subtitle);
      if (aHasSubtitle !== bHasSubtitle) return aHasSubtitle ? -1 : 1;
      return 0;
    });
  }, [currentTurnPrimaryAction, msg.frame?.actionChips]);
  const hasActionChips = !hasResultContract && prioritizedActionChips.length > 0;

  const visibleActionChips = React.useMemo(
    () => (controllerShowAll ? prioritizedActionChips : prioritizedActionChips.slice(0, 2)),
    [controllerShowAll, prioritizedActionChips]
  );

  const visibleClusters = React.useMemo(() => {
    const clusters = Array.isArray(msg.clusters) ? msg.clusters : [];
    return controllerShowAll ? clusters : clusters.slice(0, 2);
  }, [controllerShowAll, msg.clusters]);

  const dedupedSuggestions = React.useMemo(() => {
    const suggestions = Array.isArray(msg.suggestedActions) ? msg.suggestedActions : [];
    if (!suggestions.length) return [];
    const taken = new Set<string>();
    for (const chip of msg.frame?.actionChips || []) {
      if (chip.label) taken.add(normalizeActionText(chip.label));
    }
    for (const cluster of msg.clusters || []) {
      if (cluster.title) taken.add(normalizeActionText(cluster.title));
      if (cluster.primaryAction?.label) taken.add(normalizeActionText(cluster.primaryAction.label));
      for (const action of cluster.actions || []) {
        if (action.label) taken.add(normalizeActionText(action.label));
      }
    }
    const seen = new Set<string>();
    const filtered: string[] = [];
    for (const suggestion of suggestions) {
      const key = normalizeActionText(suggestion);
      if (!key || seen.has(key) || taken.has(key)) continue;
      seen.add(key);
      filtered.push(suggestion);
    }
    return filtered;
  }, [msg.suggestedActions, msg.frame?.actionChips, msg.clusters]);

  const hasSuggestions = dedupedSuggestions.length > 0;
  const shouldShowSuggestions =
    !hasResultContract && hasSuggestions && !hasActionChips && !hasClusters;
  const hasAnything =
    hasContractEntities ||
    hasContractActions ||
    Boolean(standalonePrimaryAction) ||
    hasLegacyPrimaryAction ||
    hasAnswerDetails ||
    hasMixedDiscoveryCoverage ||
    hasActionChips ||
    hasClusters ||
    hasOverride ||
    shouldShowSuggestions ||
    hasOnboardingPrompt;

  if (!hasAnything) return null;

  return (
    <div className="scout-message-extras mt-3 space-y-3">
      {hasLegacyPrimaryAction && currentTurnPrimaryAction && (
        <button
          type="button"
          className="scout-result-action scout-result-action--primary"
          onClick={() => onAction?.(currentTurnPrimaryAction)}
          disabled={!onAction}
          data-testid="scout-primary-next-action"
        >
          {currentTurnPrimaryAction.label || "Open next step"}
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      )}
      {canRefineCountyResults && (
        <div className="scout-result-refine">
          <button
            type="button"
            className="scout-result-refine__toggle"
            aria-expanded={refineOpen}
            onClick={() => setRefineOpen((open) => !open)}
          >
            Narrow by trade or job
          </button>
          {refineOpen && (
            <form
              className="scout-result-refine__form"
              onSubmit={(event) => {
                event.preventDefault();
                const topic = refineTopic.replace(/\s+/g, " ").trim();
                if (topic.length < 2 || topic.length > 60) {
                  setRefineError("Enter a trade or job in 2 to 60 characters.");
                  return;
                }
                setRefineError("");
                onAction?.({
                  type: "ASK_SCOUT",
                  label: `Search county results for ${topic}`,
                  prompt: `Find TradeScout posts and deals about ${topic} in my county this week. Include public posts linked to requests and local businesses.`,
                });
              }}
            >
              <label htmlFor={`scout-refine-${msg.id}`}>Trade or job</label>
              <div className="scout-result-refine__fields">
                <input
                  id={`scout-refine-${msg.id}`}
                  type="text"
                  maxLength={60}
                  value={refineTopic}
                  placeholder="e.g. plumbing"
                  onChange={(event) => {
                    setRefineTopic(event.target.value);
                    if (refineError) setRefineError("");
                  }}
                />
                <button type="submit">Search county</button>
              </div>
              {refineError && <p role="alert">{refineError}</p>}
            </form>
          )}
        </div>
      )}
      {hasContractEntities && (
        <div className="scout-result-list space-y-2" aria-label="Scout results">
          {contractEntities.length > 1 && (
            <div className="scout-result-list__guide">
              <span>{contractEntities.length} results from checked sources</span>
              <button
                type="button"
                onClick={(event) => {
                  const scroller = event.currentTarget.closest<HTMLElement>(".scout-thread");
                  const next = scroller?.querySelector<HTMLElement>(
                    `[data-scout-result-index="${msg.id}-1"]`
                  );
                  if (!scroller || !next) return;
                  scroller.scrollTo({
                    top:
                      scroller.scrollTop +
                      next.getBoundingClientRect().top -
                      scroller.getBoundingClientRect().top -
                      8,
                    behavior: "smooth",
                  });
                }}
              >
                See next result <ArrowRight size={12} aria-hidden="true" />
              </button>
            </div>
          )}
          {contractEntities.map((entity, index) => {
            const entityName = entity.name || entity.type;
            const safeUrl = validatedEntityUrl(entity.url);
            const inAppPath = safeUrl
              ? inAppScoutResultPath(
                  safeUrl,
                  typeof window === "undefined" ? "" : window.location.origin
                )
              : null;
            const entityAction = safeUrl
              ? contractActionEntries.find(
                  ({ action }) =>
                    action.type === "NAVIGATE" && (action.to || action.path) === safeUrl
                )
              : undefined;
            return (
              <article
                key={`${msg.id}-entity-${entity.id}`}
                className="scout-result-card"
                data-scout-result-index={`${msg.id}-${index}`}
              >
                <div className="scout-result-card__kind">
                  {entity.type === "community_post"
                    ? "Published county post"
                    : entity.type === "trade_deal"
                      ? "Promotional TradeDeal"
                      : entity.type === "business"
                        ? "Public business profile"
                        : "Scout result"}
                </div>
                {safeUrl && !entityAction ? (
                  <a
                    href={safeUrl}
                    className="scout-result-card__title underline underline-offset-2"
                    onClick={(event) => {
                      if (
                        !onResultLinkNavigate ||
                        !inAppPath ||
                        event.button !== 0 ||
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      ) {
                        return;
                      }
                      event.preventDefault();
                      onResultLinkNavigate(inAppPath);
                    }}
                  >
                    {entityName}
                  </a>
                ) : (
                  <div className="scout-result-card__title">{entityName}</div>
                )}
                {Array.isArray(entity.match_reasons) && entity.match_reasons.length > 0 && (
                  <ul className="scout-result-card__reasons">
                    {entity.match_reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
                {entityAction && (
                  <button
                    type="button"
                    className={clsx(
                      "scout-result-action",
                      entityAction.source.primary && "scout-result-action--primary"
                    )}
                    onClick={() => onAction?.(entityAction.action)}
                    disabled={!onAction}
                    data-testid={
                      entityAction.source.primary ? "scout-primary-next-action" : undefined
                    }
                  >
                    {entityAction.action.label}
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {standalonePrimaryAction && (
        <button
          type="button"
          className="scout-result-action scout-result-action--primary"
          onClick={() => onAction?.(standalonePrimaryAction.action)}
          disabled={!onAction}
          data-testid="scout-primary-next-action"
        >
          {standalonePrimaryAction.action.label}
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      )}

      {hasContractActions && (
        <div aria-label="Scout result actions" className="scout-result-secondary-actions">
          {ambiguityActions.length > 0 && (
            <div className="space-y-2">
              <div className="scout-section-label mb-0">
                <Sparkles size={11} className="scout-section-label__icon" />
                Choose what you mean
              </div>
              <div className="flex flex-wrap gap-2">
                {ambiguityActions.map(({ option, action }) => (
                  <button
                    key={`${msg.id}-ambiguity-${option.action_id}`}
                    type="button"
                    onClick={() => onAction?.(action)}
                    disabled={!onAction}
                    className="scout-tool-tray__btn scout-tool-tray__btn--secondary scout-result-secondary-action"
                    style={{
                      minHeight: "40px",
                      fontSize: "12px",
                      textTransform: "none",
                      letterSpacing: "normal",
                      padding: "0 14px",
                    }}
                  >
                    <ArrowRight size={12} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {secondaryContractActions.length > 0 && (
            <div className="space-y-2">
              <div className="scout-section-label mb-0">More ways to browse</div>
              <div className="flex flex-wrap gap-2">
                {secondaryContractActions.map(({ source, action }) => (
                  <button
                    key={`${msg.id}-contract-action-${source.action_id}`}
                    type="button"
                    onClick={() => onAction?.(action)}
                    disabled={!onAction}
                    className={clsx(
                      "scout-tool-tray__btn scout-result-secondary-action",
                      action.primary
                        ? "scout-tool-tray__btn--primary"
                        : "scout-tool-tray__btn--secondary"
                    )}
                    style={{
                      minHeight: "40px",
                      fontSize: "12px",
                      textTransform: "none",
                      letterSpacing: "normal",
                      padding: "0 14px",
                    }}
                  >
                    <ArrowRight size={12} />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action chips + clusters block */}
      {(hasActionChips || hasClusters || (showControllerExtras && hasOverride)) && (
        <div
          aria-label="Next steps"
          className="rounded-2xl p-3 space-y-3"
          style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle)" }}
        >
          {/* Section label */}
          <div className="flex items-center justify-between">
            <div className="scout-section-label mb-0">
              <Sparkles size={11} className="scout-section-label__icon" />
              Here are the best next steps
            </div>
            <button
              type="button"
              className="text-[10px] font-semibold rounded-full px-2.5 py-0.5 transition-colors"
              style={{
                color: "rgba(250,250,250,0.4)",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              onClick={() => setControllerOpen((v) => !v)}
              aria-expanded={controllerOpen}
            >
              {controllerOpen ? "Hide" : "Show"}
            </button>
          </div>

          {controllerOpen && (
            <div className="space-y-3">
              {/* Action chips */}
              {hasActionChips && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {visibleActionChips.map((chip) => (
                      <button
                        key={`${msg.id}-chip-${chip.id}`}
                        type="button"
                        onClick={() => {
                          if (!onAction) return;
                          if (chip.kind === "NAVIGATE") {
                            onAction({
                              type: "NAVIGATE",
                              label: chip.label,
                              to: chip.target,
                              path: chip.target,
                              payload:
                                chip.args && typeof chip.args === "object"
                                  ? (chip.args as Record<string, unknown>)
                                  : undefined,
                            });
                          }
                        }}
                        className="scout-tool-tray__btn scout-tool-tray__btn--secondary"
                        style={{
                          minHeight: "40px",
                          fontSize: "12px",
                          textTransform: "none",
                          letterSpacing: "normal",
                          padding: "0 14px",
                        }}
                      >
                        <ArrowRight size={12} />
                        <div className="flex flex-col items-start text-left">
                          <span>{chip.label}</span>
                          {chip.subtitle && (
                            <span className="text-[10px] opacity-75">{chip.subtitle}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  {prioritizedActionChips.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setControllerShowAll((v) => !v)}
                      className="text-[10px] font-semibold rounded-full px-3 py-1"
                      style={{
                        color: "rgba(249,115,22,0.7)",
                        background: "rgba(249,115,22,0.06)",
                        border: "1px solid rgba(249,115,22,0.15)",
                      }}
                    >
                      {controllerShowAll
                        ? "Show fewer"
                        : `More actions (${prioritizedActionChips.length - 2})`}
                    </button>
                  )}
                </div>
              )}

              {/* Cluster cards */}
              {msg.clusters && msg.clusters.length > 0 && (
                <div className="space-y-2">
                  {visibleClusters.map((cluster) => (
                    <ClusterCard
                      key={cluster.id}
                      cluster={cluster}
                      onAction={onAction}
                      currentTurnPrimaryAction={currentTurnPrimaryAction}
                    />
                  ))}
                  {msg.clusters.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setControllerShowAll((v) => !v)}
                      className="text-[10px] font-semibold rounded-full px-3 py-1"
                      style={{
                        color: "rgba(249,115,22,0.7)",
                        background: "rgba(249,115,22,0.06)",
                        border: "1px solid rgba(249,115,22,0.15)",
                      }}
                    >
                      {controllerShowAll
                        ? "Show fewer sections"
                        : `More sections (${msg.clusters.length - 2})`}
                    </button>
                  )}
                </div>
              )}

              {/* Override option */}
              {showControllerExtras && msg.overrideOption && (
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: "var(--surface-intermediate)",
                    border: "1px dashed rgba(249,115,22,0.25)",
                  }}
                >
                  <div className="text-[12px] mb-2" style={{ color: "rgba(250,250,250,0.6)" }}>
                    {msg.overrideOption.message}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOverride && onOverride(msg.overrideOption!)}
                    disabled={overridePendingScope === (msg.overrideOption.scope ?? "global")}
                    className="scout-tool-tray__btn scout-tool-tray__btn--secondary"
                    style={{
                      minHeight: "36px",
                      fontSize: "12px",
                      textTransform: "none",
                      letterSpacing: "normal",
                      padding: "0 14px",
                    }}
                  >
                    {overridePendingScope === (msg.overrideOption.scope ?? "global")
                      ? "Logging override..."
                      : msg.overrideOption.label}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(hasAnswerDetails || hasMixedDiscoveryCoverage) && (
        <div className="scout-answer-detail">
          {hasAnswerDetails && (
            <>
              <button
                type="button"
                className="scout-message-details-toggle"
                onClick={() => setAnswerOpen((open) => !open)}
                aria-expanded={answerOpen}
              >
                {hasMixedDiscoveryCoverage
                  ? answerOpen
                    ? "Hide source checks"
                    : "See source checks and limits"
                  : answerOpen
                    ? "Short version"
                    : "More detail"}
              </button>
              {answerOpen && (
                <div
                  ref={hasMixedDiscoveryCoverage ? revealSourceChecksOnMount : undefined}
                  data-testid={hasMixedDiscoveryCoverage ? "scout-source-check-body" : undefined}
                  className="mt-2 space-y-2 text-sm leading-relaxed text-[color:var(--text-secondary)]"
                >
                  {hasMixedDiscoveryCoverage && (
                    <div className="space-y-2 text-xs" aria-label="Scout source checks">
                      <p className="font-semibold text-[color:var(--text-primary)]">What Scout checked</p>
                      <dl className="space-y-1.5">
                        {mixedDiscoverySourceChecks(msg, fullAnswer || "").map(({ source, status }) => (
                          <div key={source} className="flex items-start justify-between gap-3">
                            <dt>{source}</dt>
                            <dd className="shrink-0 text-right font-semibold text-[color:var(--text-primary)]">
                              {status}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p>Nothing was sent.</p>
                      <EvidenceSourceList sources={msg.provenance?.sources || []} />
                    </div>
                  )}
                  <p className="whitespace-pre-line">{fullAnswer}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Suggestions block */}
      {shouldShowSuggestions && (
        <div
          className="rounded-2xl p-3"
          style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="scout-section-label mb-0">
              <MessageSquareText size={11} className="scout-section-label__icon" />
              Keep going
            </div>
            <button
              type="button"
              className="text-[10px] font-semibold rounded-full px-2.5 py-0.5"
              style={{
                color: "rgba(250,250,250,0.4)",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              onClick={() => setSuggestionsOpen((v) => !v)}
              aria-expanded={suggestionsOpen}
            >
              {suggestionsOpen ? "Hide" : `Show (${dedupedSuggestions.length})`}
            </button>
          </div>
          {suggestionsOpen && (
            <div className="flex flex-wrap gap-2">
              {dedupedSuggestions.map((act) => (
                <button
                  key={act}
                  type="button"
                  onClick={() => onQuickAction && onQuickAction(act)}
                  className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
                  style={{
                    background: "var(--surface-intermediate)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-secondary, rgba(250,250,250,0.7))",
                  }}
                >
                  {act}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Onboarding prompt */}
      {msg.onboarding?.active && msg.onboarding.question && onSendMessage && (
        <OnboardingPrompt
          onboarding={msg.onboarding}
          mode="card"
          onAnswer={(value) =>
            onSendMessage({
              onboardingAnswer: {
                sessionId: msg.onboarding!.sessionId,
                questionKey: msg.onboarding!.question!.key,
                value,
              },
            })
          }
          onSkip={() =>
            onSendMessage({
              onboardingAnswer: {
                sessionId: msg.onboarding!.sessionId,
                questionKey: msg.onboarding!.question!.key,
                skipped: true,
              },
            })
          }
        />
      )}
    </div>
  );
}

/* ----------------------------------------------------------
   Main ScoutThread component
   ---------------------------------------------------------- */
const ScoutThread: React.FC<ScoutThreadProps> = ({
  messages,
  status,
  showControllerExtras = true,
  currentTurnPrimaryAction,
  onAction,
  onResultLinkNavigate,
  onQuickAction,
  onOverride,
  overridePendingScope,
  onSendMessage,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const retainLatestOnResizeRef = React.useRef(true);
  const lastPresentedMessageIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;
    if (lastPresentedMessageIdRef.current === lastMessage.id) return;
    lastPresentedMessageIdRef.current = lastMessage.id;

    if (lastMessage.role === "assistant" && retainLatestOnResizeRef.current) {
      const messageNode = Array.from(node.children).find(
        (child) => child.getAttribute("data-scout-message-id") === lastMessage.id
      );
      if (
        messageNode instanceof HTMLElement &&
        scrollScoutThreadToNewAnswerStart(node, messageNode)
      ) {
        retainLatestOnResizeRef.current = false;
        return;
      }
    }

    if (!retainLatestOnResizeRef.current && lastMessage.role !== "user") return;
    scrollScoutThreadToLatest(node, "auto");
    retainLatestOnResizeRef.current = true;
  }, [messages]);

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const rememberReaderPosition = () => {
      retainLatestOnResizeRef.current = isScoutThreadNearLatest(node);
    };
    rememberReaderPosition();
    node.addEventListener("scroll", rememberReaderPosition, { passive: true });

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (!retainLatestOnResizeRef.current) return;
            scrollScoutThreadToLatest(node, "auto");
          });
    resizeObserver?.observe(node);

    return () => {
      resizeObserver?.disconnect();
      node.removeEventListener("scroll", rememberReaderPosition);
    };
  }, []);

  const showProgress = status !== "idle" && status !== "error";
  const statusLabel =
    status === "executing_action" ? "Completing the selected action..." : "Scout is working...";
  const currentTurnMessageId = currentTurnPrimaryAction
    ? findLatestAssistantMessageId(messages)
    : null;

  return (
    <div
      ref={containerRef}
      className="scout-thread scout-thread--task-loop space-y-4 flex-1 min-h-0 overflow-y-auto"
      role="log"
      aria-label="Conversation and result record"
      aria-live="polite"
      aria-relevant="additions text"
      tabIndex={0}
    >
      {messages.map((msg) => {
        const isUser = msg.role === "user";

        // Strip frame-duplicated content from display
        let displayContent = msg.content;
        if (!isUser && msg.frame && typeof msg.content === "string") {
          const { truthLines, meaningLine, directionLine } = msg.frame;
          const toStrip = [
            ...(Array.isArray(truthLines) ? truthLines : []),
            meaningLine,
            directionLine,
          ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

          if (toStrip.length > 0) {
            const paragraphs = msg.content
              .split(/\n{2,}/)
              .map((p) => p.trim())
              .filter((p) => p.length > 0);
            const filtered = paragraphs.filter((p) => !toStrip.some((line) => p === line.trim()));
            displayContent = filtered.join("\n\n");
          }
        }

        if (!isUser) {
          displayContent = coerceReadableAssistantContent(displayContent);
        }
        const assistantSummary = isUser ? "" : buildAssistantSummary(msg, displayContent);

        const msgTime = msg.timestamp
          ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
          : "";

        return (
          <div key={msg.id} className="space-y-3" data-scout-message-id={msg.id}>
            {isUser ? (
              /* ---- USER BUBBLE ---- */
              /* @reusable: scout-user-bubble — see index.css */
              <div className="scout-user-bubble">
                <div className="scout-user-bubble__meta">
                  <span className="scout-user-bubble__name">You</span>
                  {msgTime && <span className="scout-user-bubble__time">{msgTime}</span>}
                  <div className="scout-user-bubble__avatar" aria-hidden="true">
                    U
                  </div>
                </div>
                <div className="scout-user-bubble__body">{displayContent}</div>
              </div>
            ) : (
              /* ---- ASSISTANT BUBBLE ---- */
              /* @reusable: scout-assistant-bubble — see index.css */
              <div className="scout-assistant-bubble">
                <div className="scout-assistant-bubble__meta">
                  <div className="scout-assistant-bubble__avatar" aria-hidden="true">
                    <img src="/tradescout-logo.png" alt="Scout" />
                  </div>
                  <span className="scout-assistant-bubble__name">Scout</span>
                  {msg.resultContract && (
                    <span className="scout-assistant-bubble__badge">
                      {msg.provenance?.sourceUsed === "scout_mixed_discovery_recovery"
                        ? msg.resultContract.entities.length > 0
                          ? "County results"
                          : "Scout update"
                        : humanizeToken(msg.resultContract.intent)}
                    </span>
                  )}
                  {msgTime && <span className="scout-assistant-bubble__time">{msgTime}</span>}
                </div>
                {displayContent && (
                  <div className="scout-assistant-bubble__body">
                    <AssistantMessageBubble summary={assistantSummary} />
                  </div>
                )}
              </div>
            )}

            <MessageExtras
              msg={msg}
              isUser={isUser}
              showControllerExtras={showControllerExtras}
              currentTurnPrimaryAction={
                msg.id === currentTurnMessageId ? currentTurnPrimaryAction : null
              }
              fullAnswer={displayContent}
              answerSummary={assistantSummary}
              onAction={onAction}
              onResultLinkNavigate={onResultLinkNavigate}
              onQuickAction={onQuickAction}
              onOverride={onOverride}
              overridePendingScope={overridePendingScope}
              onSendMessage={onSendMessage}
            />
            {!isUser && (
              <EvidenceStrip
                msg={msg}
                enabled={
                  !hasExplicitMixedCoverage(msg, displayContent) &&
                  (showControllerExtras || Boolean(msg.resultContract))
                }
              />
            )}
          </div>
        );
      })}

      {showProgress && (
        <div
          className="rounded-2xl border p-3"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "var(--surface-card)",
            boxShadow: "var(--surface-card-shadow)",
          }}
        >
          <div className="flex items-start gap-3">
            <div className="scout-avatar mt-0.5" aria-hidden="true">
              TS
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                {statusLabel}
              </div>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                Nothing will be sent, published, or changed without your approval.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoutThread;
