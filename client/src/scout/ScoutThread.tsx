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
import type { ScoutLocality, ScoutMode } from "./api";
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
  onAction?: (action: ScoutAction) => void;
  onQuickAction?: (text: string) => void;
  onOverride?: (option: NonNullable<ScoutMessage["overrideOption"]>) => void;
  overridePendingScope?: string | null;
  onSendMessage?: (payload: any) => void;
  onPrefill?: (text: string) => void;
  pendingContextCards?: ScoutContextCard[];
  locality?: ScoutLocality;
};

type ScoutFrameScheduler = (callback: FrameRequestCallback) => number;

export function scrollOpenScoutTaskHistoryToLatest(
  history: HTMLDetailsElement,
  scheduleFrame: ScoutFrameScheduler = requestAnimationFrame
): void {
  if (!history.open) return;

  scheduleFrame(() => {
    const thread = history.querySelector<HTMLElement>(".scout-thread");
    if (!thread) return;
    thread.scrollTo({ top: thread.scrollHeight, behavior: "auto" });
  });
}

const SUMMARY_MAX_CHARS = 150;

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
  if (!shouldSummarizeAssistantMessage(msg)) return displayContent;

  const frame = msg.frame;
  const framedSummary =
    frame?.directionLine?.trim() ||
    frame?.meaningLine?.trim() ||
    (Array.isArray(frame?.truthLines) ? frame?.truthLines?.find((line) => line.trim()) : "");

  return trimToSummary(framedSummary || displayContent);
}

function AssistantMessageBubble({
  msg,
  displayContent,
}: {
  msg: ScoutMessage;
  displayContent: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const summary = React.useMemo(
    () => buildAssistantSummary(msg, displayContent),
    [displayContent, msg]
  );
  const hasDetails = summary.trim() !== displayContent.trim();
  const content = expanded || !hasDetails ? displayContent : summary;

  return (
    <>
      {content && <p className="whitespace-pre-line leading-relaxed">{content}</p>}
      {hasDetails && (
        <button
          type="button"
          className="scout-message-details-toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? "Short version" : "More detail"}
        </button>
      )}
    </>
  );
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
    <div className="space-y-1 text-[10px]" style={{ color: "rgba(250,250,250,0.35)" }}>
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
}: {
  cluster: ScoutCluster;
  onAction?: (action: ScoutAction) => void;
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
    const actions = mergeClusterActions(cluster);
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
  }, [cluster]);

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
  onAction,
  onQuickAction,
  onOverride,
  overridePendingScope,
  onSendMessage,
}: {
  msg: ScoutMessage;
  isUser: boolean;
  showControllerExtras: boolean;
  onAction?: (action: ScoutAction) => void;
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
  const remainingContractActions = React.useMemo(
    () => contractActionEntries.filter(({ source }) => !ambiguityActionIds.has(source.action_id)),
    [ambiguityActionIds, contractActionEntries]
  );
  const hasContractActions = contractActionEntries.length > 0;
  const contractEntities = msg.resultContract?.entities || [];
  const hasContractEntities = contractEntities.length > 0;
  const hasActionChips =
    !hasResultContract && Boolean(msg.frame?.actionChips && msg.frame.actionChips.length > 0);
  const hasClusters = !hasResultContract && Boolean(msg.clusters && msg.clusters.length > 0);
  const hasOverride = !hasResultContract && Boolean(msg.overrideOption);
  const hasOnboardingPrompt = Boolean(
    msg.onboarding?.active && Boolean(msg.onboarding.question) && Boolean(onSendMessage)
  );

  const [controllerOpen, setControllerOpen] = React.useState(() => !showControllerExtras);
  const [controllerShowAll, setControllerShowAll] = React.useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = React.useState(false);

  const prioritizedActionChips = React.useMemo(() => {
    const chips = Array.isArray(msg.frame?.actionChips) ? msg.frame.actionChips : [];
    return [...chips].sort((a, b) => {
      const aIsNavigate = a.kind === "NAVIGATE";
      const bIsNavigate = b.kind === "NAVIGATE";
      if (aIsNavigate !== bIsNavigate) return aIsNavigate ? -1 : 1;
      const aHasSubtitle = Boolean(a.subtitle);
      const bHasSubtitle = Boolean(b.subtitle);
      if (aHasSubtitle !== bHasSubtitle) return aHasSubtitle ? -1 : 1;
      return 0;
    });
  }, [msg.frame?.actionChips]);

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
    hasActionChips ||
    hasClusters ||
    hasOverride ||
    shouldShowSuggestions ||
    hasOnboardingPrompt;

  if (!hasAnything) return null;

  return (
    <div className="mt-3 space-y-3">
      {hasContractEntities && (
        <div className="space-y-2" aria-label="Scout results">
          {contractEntities.map((entity) => {
            const entityName = entity.name || entity.type;
            const safeUrl =
              typeof entity.url === "string" && isSafeLinkTarget(entity.url)
                ? entity.url
                : undefined;
            return (
              <article
                key={`${msg.id}-entity-${entity.id}`}
                className="rounded-2xl p-3"
                style={{
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {safeUrl ? (
                  <a href={safeUrl} className="text-sm font-semibold underline underline-offset-2">
                    {entityName}
                  </a>
                ) : (
                  <div className="text-sm font-semibold">{entityName}</div>
                )}
                {Array.isArray(entity.match_reasons) && entity.match_reasons.length > 0 && (
                  <ul
                    className="mt-2 space-y-1 pl-4 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {entity.match_reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}

      {hasContractActions && (
        <div
          aria-label="Scout result actions"
          className="rounded-2xl p-3 space-y-3"
          style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle)" }}
        >
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
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {remainingContractActions.length > 0 && (
            <div className="space-y-2">
              <div className="scout-section-label mb-0">
                <Sparkles size={11} className="scout-section-label__icon" />
                Available actions
              </div>
              <div className="flex flex-wrap gap-2">
                {remainingContractActions.map(({ source, action }) => (
                  <button
                    key={`${msg.id}-contract-action-${source.action_id}`}
                    type="button"
                    onClick={() => onAction?.(action)}
                    disabled={!onAction}
                    className={clsx(
                      "scout-tool-tray__btn",
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
              {!isUser && msg.frame?.actionChips && msg.frame.actionChips.length > 0 && (
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
                    <ClusterCard key={cluster.id} cluster={cluster} onAction={onAction} />
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
  onAction,
  onQuickAction,
  onOverride,
  overridePendingScope,
  onSendMessage,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;
    if (lastMessage.role === "assistant") {
      const target = node.querySelector<HTMLElement>(`[data-scout-message-id="${lastMessage.id}"]`);
      if (target) {
        target.scrollIntoView({ block: "end", behavior: "smooth" });
        return;
      }
    }
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const showProgress = status !== "idle" && status !== "error";
  const statusLabel =
    status === "executing_action" ? "Completing the selected action..." : "Scout is working...";

  return (
    <div
      ref={containerRef}
      className="scout-thread scout-thread--task-loop space-y-4 flex-1 min-h-0 overflow-y-auto"
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
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
                      {humanizeToken(msg.resultContract.intent)}
                    </span>
                  )}
                  {msgTime && <span className="scout-assistant-bubble__time">{msgTime}</span>}
                </div>
                {displayContent && (
                  <div className="scout-assistant-bubble__body">
                    <AssistantMessageBubble msg={msg} displayContent={displayContent} />
                  </div>
                )}
                <EvidenceStrip
                  msg={msg}
                  enabled={showControllerExtras || Boolean(msg.resultContract)}
                />
              </div>
            )}

            <MessageExtras
              msg={msg}
              isUser={isUser}
              showControllerExtras={showControllerExtras}
              onAction={onAction}
              onQuickAction={onQuickAction}
              onOverride={onOverride}
              overridePendingScope={overridePendingScope}
              onSendMessage={onSendMessage}
            />
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
