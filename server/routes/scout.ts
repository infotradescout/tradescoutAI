/* eslint-disable @typescript-eslint/no-explicit-any -- Scout ingests dynamic JSON (LLM + integrations); harden types iteratively. */

import { recordQuery, recordFallback, getAnalytics, getAuditLog } from "../services/adminAnalytics";
import { Router, type Request, Response } from "express";
import {
  extractUserMessage,
  extractMetadata,
  type RawScoutOutput,
} from "../utils/extractUserMessage";
import { createCapabilityChecker, buildCapabilitySignals } from "../utils/userCapabilities";
import { runScoutAction, type ScoutActionContext } from "../utils/scoutActionGuard";
import {
  buildScoutLlmProviders,
  generateWithFallback,
  getLlmProviderFailoverRuntimeState,
  type LLMProvider,
  type ScoutLlmModelTier,
} from "../services/llmProvider";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  GeminiRateLimitError,
  generateGeminiTextWithFallback,
  getGeminiFallbackRuntimeState,
} from "../ai/geminiFallback";
import type { User } from "../assistantActions";
import {
  resolveKnowledge,
  getLocalGuide,
  getLocalMarkdownGuide,
  loadComprehensiveKnowledge,
  getKnowledgeBaseStatus,
  type KnowledgeSourceReference,
} from "../services/knowledgeService";
import {
  enforceTradeScoutIdentityBoundary,
  hasExplicitExternalScoutReference,
  isOnboardingOrIdentityQuery,
  TRADE_SCOUT_IDENTITY_FALLBACK_MESSAGE,
} from "../scout/brandGuard";
import { maybeHandleDeterministicIntent } from "../services/scoutDeterministicIntent";
import type { DeterministicContext } from "../services/scoutDeterministicIntent";
import { loadSystemPrompt } from "../services/promptService";
import {
  buildUserContext,
  formatUserContextForPrompt,
  generateThinkingContext,
} from "../services/userContextService";
import { storage } from "../storage";
import { callExternalActions } from "../services/externalActionsClient";
import { resolveCountyFips, resolveRegionSlug } from "../services/regionResolver";
import { shouldInjectSponsored } from "../services/sponsoredEligibility";
import { COMMUNITY_TONE } from "../../shared/communityLanguage";
import { CURRENT_PROFILE_VERSION } from "../../shared/profile";
import {
  buildScoutLaunchContextCacheKey,
  normalizeScoutLaunchContext,
  type ScoutLaunchContext,
} from "../../shared/scoutLaunchContext";
import { db, pool } from "../db";
import {
  leads,
  workRequestAssignments,
  workRequests,
  scoutInteractionFailureReasonEnum,
  type InsertScoutInteraction,
} from "../../shared/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { createHash } from "crypto";
import { govern } from "../scout/governor";
import { recordOutcomeEvent, updateUserConfidenceStateFromOutcome } from "../scout/outcomeTracker";
import { syncObjectiveFromScoutMessage } from "../scout/objectivesService";
import { recordScoutInteraction } from "../services/missionControl";
import { logCompletedAction } from "../services/preferredSource";
import { ensureFollowUpQuestion } from "../scout/responseShape";
import { finalizeScoutResponse } from "../scout/scoutResponseContract";
import { normalizeScoutRequest } from "../scout/scoutRequestNormalizer";
import { runScoutDecisionPipeline } from "../scout/scoutDecisionPipeline";
import { sanitizeScoutUserFacingText } from "../scout/userFacingSanitizer";
import {
  sanitizeScoutActionsForPolicy,
  sanitizeScoutMessageForPolicy,
  sanitizeScoutSuggestionsForPolicy,
} from "../services/scoutPolicy";
import { UnifiedScoutRouter, type UnifiedScoutUserContext } from "../services/unifiedScoutRouter";
import { registerScoutAdminRoutes } from "../scout/scoutAdminRoutes";
import { registerScoutOpsRoutes } from "../scout/scoutOpsRoutes";
import {
  buildWelcomeIntroDraft,
  buildCommunityPrefill,
  buildWelcomeIntroVariants,
  inferSourceConfidenceBand,
  isExchangeListingRequest,
  isTradeDealIntent,
  isWelcomeIntroRequest,
  normalizeConfidenceLabel,
  shapeActionsByConfidence,
  shapeDealsForScout,
  type SourceConfidenceBand,
} from "../scout/scoutDeterministicHelpers";
import { assessEnhancedV4ProxyResponse } from "../scout/scoutEnhancedV4Fallback";
import { buildDecisionPipelineBehaviorResponse } from "../scout/scoutBehaviorHandlers";
import { maybeHandleHomeProjectRouting } from "../scout/scoutHomeProjectRouting";
import { applyCommunityBehaviorOwnership } from "../scout/scoutCommunityBehaviorOwner";
import {
  applyMarketplaceListingNavigationOwnership,
  buildExchangeListingDraft,
} from "../scout/scoutMarketplaceBehaviorOwner";
import { applyProviderBehaviorOwnership } from "../scout/scoutProviderBehaviorOwner";
import { applySupportBehaviorOwnership } from "../scout/scoutSupportBehaviorOwner";
import { buildAuthRequiredScoutResponse } from "../scout/scoutAuthRequiredResponse";
import {
  buildScoutProfileUpdateResponse,
  inferScoutProfileUpdateDraft,
  sanitizeScoutProfileUpdatePayload,
} from "../scout/scoutProfileUpdateAssistant";
import {
  projectRequesterDirectConnectReadiness,
  projectResponderDirectConnectReadiness,
  resolveLiveReadiness,
  type DirectConnectReadinessItem,
} from "../../shared/liveReadiness";
import {
  buildScoutLiveReadinessResponse,
  isLiveReadinessQuestion,
} from "../scout/scoutLiveReadinessResponse";
import type { SituationAnalysisInput } from "../services/scoutSituationAnalyzer";
import ScoutTrustIntegration, { type ScoutTrustContext } from "../services/scoutTrustIntegration";
import ScoutObjectiveOnboarding from "../services/scoutObjectiveOnboarding";
import ScoutProactiveWatchdog from "../services/scoutProactiveWatchdog";
import ScoutToneAwareBuilder, { type ToneScenario } from "../services/scoutToneAwareBuilder";
import scoutNormalizeRouter from "./scout-normalize";
import {
  buildScoutRequestRejectionResponse,
  buildScoutUnavailableResponse,
  createScoutRequestLimiters,
  validateScoutRequestBounds,
} from "../scout/scoutRequestHardening";
import ScoutMemoryService from "../services/scoutMemoryService";
import {
  buildBoundedScoutHistory,
  buildScoutSynthesisMemoryBlocks,
  extractExplicitScoutMemoryUpdate,
  type ScoutReasoningMemoryContext,
} from "../scout/scoutWorkingMemory";
// ⚠️ IMPORT ZONE — NO EXECUTABLE CODE ALLOWED
// Any logic here will break the entire Scout router
import {
  initializeOnboardingSession,
  getOnboardingSession,
  saveOnboardingSession,
  getNextQuestion,
  recordAnswer,
  recordSkip,
  checkAutoExpiration,
  expireOnboarding,
  applySofterLanguage,
  getQuestionPrompt,
  type OnboardingSession,
} from "../utils/onboardingService";

const router = Router();
const scoutRequestLimiters = createScoutRequestLimiters();

async function loadLiveReadinessDirectConnectItems(
  userId: string
): Promise<DirectConnectReadinessItem[]> {
  const requesterRows = await db
    .select({
      id: workRequests.id,
      status: workRequests.status,
    })
    .from(workRequests)
    .where(and(eq(workRequests.createdByUserId, userId), eq(workRequests.source, "direct_connect")))
    .orderBy(desc(workRequests.updatedAt))
    .limit(5);

  const requestIds = requesterRows.map((row) => String(row.id));
  const requesterAssignments = requestIds.length
    ? await db
        .select({
          workRequestId: workRequestAssignments.workRequestId,
          id: workRequestAssignments.id,
          status: workRequestAssignments.status,
        })
        .from(workRequestAssignments)
        .where(inArray(workRequestAssignments.workRequestId, requestIds))
    : [];

  const assignmentsByRequest = new Map<string, typeof requesterAssignments>();
  for (const assignment of requesterAssignments) {
    const key = String(assignment.workRequestId);
    const existing = assignmentsByRequest.get(key) || [];
    existing.push(assignment);
    assignmentsByRequest.set(key, existing);
  }

  const requesterItems = requesterRows.map((requestRow) => {
    const assignments = assignmentsByRequest.get(String(requestRow.id)) || [];
    const suggestedCount = assignments.filter(
      (assignment) => assignment.status === "suggested" || assignment.status === "invited"
    ).length;
    const accepted = assignments.find((assignment) => assignment.status === "accepted");
    return projectRequesterDirectConnectReadiness({
      status: requestRow.status,
      dcSuggestedCount: suggestedCount,
      dcAcceptedAssignmentId: accepted?.id ?? null,
      dcConversationThreadId: null,
    });
  });

  const responderAssignments = await db
    .select({
      status: workRequestAssignments.status,
    })
    .from(workRequestAssignments)
    .where(eq(workRequestAssignments.responderUserId, userId))
    .orderBy(desc(workRequestAssignments.updatedAt))
    .limit(5);

  const responderItems = responderAssignments.map((assignment) =>
    projectResponderDirectConnectReadiness({
      assignment: { status: assignment.status },
      conversationThreadId: null,
    })
  );

  return [...requesterItems, ...responderItems];
}

const SCOUT_CORS_ALLOWED_ORIGINS = new Set(
  [
    "https://www.thetradescout.com",
    "https://tradescoutai.onrender.com",
    "https://thetradescout.com",
  ].map((o) => o.toLowerCase())
);

function isDevOrigin(origin: string): boolean {
  // In local/dev, the UI can be served from a different port (or a local proxy).
  // Allow localhost-style origins so Scout endpoints work without requiring
  // production domains.
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") {
      return true;
    }
    // Replit-style preview origins (dev-only).
    if (host.endsWith(".replit.dev")) return true;
    return false;
  } catch {
    return false;
  }
}

const VALID_SCOUT_FAILURE_REASONS = new Set(scoutInteractionFailureReasonEnum.enumValues);

function normalizeFailureReason(
  reason: InsertScoutInteraction["failureReason"] | null | undefined
): InsertScoutInteraction["failureReason"] | null {
  if (reason && VALID_SCOUT_FAILURE_REASONS.has(reason)) return reason;
  return null;
}

function ensureFailureReason(
  reason: InsertScoutInteraction["failureReason"] | null | undefined
): InsertScoutInteraction["failureReason"] {
  return normalizeFailureReason(reason) ?? "unclear_copy";
}

type ScoutTurnFailureClass =
  | "none"
  | "input_error"
  | "auth_required"
  | "governor_blocked"
  | "governor_redirect"
  | "provider_fallback"
  | "route_unmatched"
  | "system_error"
  | "unknown";
type ScoutDegradationReason =
  | "provider_unavailable"
  | "schema_violation"
  | "json_parse_error"
  | "synthesis_rate_limited"
  | "synthesis_system_error"
  | "enhanced_confidence_gate"
  | "enhanced_proxy_error"
  | "route_exception";

function deriveScoutTurnFailureClass(
  statusCode: number,
  interaction: InsertScoutInteraction | null,
  explicit: ScoutTurnFailureClass
): ScoutTurnFailureClass {
  if (explicit !== "none") return explicit;
  if (statusCode >= 500) return "system_error";
  if (statusCode < 400) return "none";

  const reason = interaction?.failureReason;
  if (reason === "missing_data") return "input_error";
  if (reason === "permission") return "auth_required";
  if (reason === "no_route") return "route_unmatched";
  return "unknown";
}

router.use((req, res, next) => {
  const originHeader = req.headers.origin;
  if (typeof originHeader === "string") {
    const normalized = originHeader.toLowerCase();
    const allowDev =
      process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_CORS !== "false";

    if (SCOUT_CORS_ALLOWED_ORIGINS.has(normalized) || (allowDev && isDevOrigin(originHeader))) {
      res.setHeader("Access-Control-Allow-Origin", originHeader);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
  }

  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Origin, Accept");
    return res.sendStatus(204);
  }

  next();
});

router.use(scoutNormalizeRouter);

function normalizeScoutRole(role?: string | null): InsertScoutInteraction["userRole"] {
  if (!role) return "homeowner";
  const lower = role.toLowerCase();
  if (lower.includes("admin") || lower.includes("moderator")) return "admin";
  if (lower.includes("contractor") || lower.includes("service") || lower.includes("provider"))
    return "contractor";
  return "homeowner";
}

function isGuestDirectoryBrowsingIntent(message: string): boolean {
  const lower = String(message || "").toLowerCase();
  const hasTradeNeed =
    /\b(roofer|roofing|plumber|plumbing|electrician|electrical|hvac|contractor|painter|handyman)\b/.test(
      lower
    );
  const hasLookupLanguage =
    /\b(need|find|looking for|show|compare|browse|in my area|near me|this week|available)\b/.test(
      lower
    );
  const isContactAction = /\b(contact|message|call|hire now|book now)\b/.test(lower);
  return hasTradeNeed && hasLookupLanguage && !isContactAction;
}

function buildUnifiedRouterContext(
  req: Request,
  incoming?: Partial<UnifiedScoutUserContext> | null
): UnifiedScoutUserContext {
  const user = (req as any)?.user;
  const userId =
    typeof user?.id === "string"
      ? user.id
      : typeof user?.claims?.sub === "string"
        ? user.claims.sub
        : undefined;

  const rawRole = typeof user?.role === "string" ? user.role : incoming?.userRole;
  const normalizedRole =
    typeof rawRole === "string"
      ? rawRole.trim().toLowerCase() === "owner"
        ? "super_admin"
        : rawRole.trim().toLowerCase() === "head_admin"
          ? "super_admin"
          : rawRole.trim().toLowerCase()
      : undefined;

  const trustLevel =
    user?.trustLevel === "low" || user?.trustLevel === "medium" || user?.trustLevel === "high"
      ? user.trustLevel
      : undefined;

  const location =
    incoming?.location &&
    typeof incoming.location === "object" &&
    (typeof incoming.location.county === "string" ||
      typeof incoming.location.state === "string" ||
      typeof incoming.location.region === "string")
      ? {
          county:
            typeof incoming.location.county === "string" ? incoming.location.county : undefined,
          state: typeof incoming.location.state === "string" ? incoming.location.state : undefined,
          region:
            typeof incoming.location.region === "string" ? incoming.location.region : undefined,
        }
      : undefined;

  return {
    userId,
    isAuthenticated: Boolean(userId),
    userRole: normalizedRole,
    trustLevel,
    location,
    permissions: Array.isArray(incoming?.permissions)
      ? incoming?.permissions.filter((p): p is string => typeof p === "string")
      : undefined,
  };
}

function toFiniteNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildServerTrustContext(req: Request): ScoutTrustContext | undefined {
  const authUser = (req as any)?.user;
  if (!authUser || typeof authUser !== "object") {
    return undefined;
  }

  const snapshotRaw =
    authUser.trustSnapshot && typeof authUser.trustSnapshot === "object"
      ? (authUser.trustSnapshot as Record<string, unknown>)
      : null;

  const userId =
    typeof authUser.id === "string"
      ? authUser.id
      : typeof authUser.claims?.sub === "string"
        ? authUser.claims.sub
        : undefined;

  const riskFlagsFromSnapshot = Array.isArray(snapshotRaw?.riskFlags)
    ? snapshotRaw?.riskFlags.filter((v): v is string => typeof v === "string")
    : undefined;

  const riskFlagsFromUser = Array.isArray(authUser.riskFlags)
    ? authUser.riskFlags.filter((v: unknown): v is string => typeof v === "string")
    : undefined;

  return {
    userId,
    countyFips:
      typeof snapshotRaw?.countyFips === "string"
        ? snapshotRaw.countyFips
        : typeof authUser.countyFips === "string"
          ? authUser.countyFips
          : undefined,
    cvsScore: toFiniteNumber(snapshotRaw?.cvsScore ?? authUser.cvsScore ?? authUser.trustScore),
    verifiedJobsCount: toFiniteNumber(snapshotRaw?.verifiedJobsCount ?? authUser.verifiedJobsCount),
    verifiedRecommendationsCount: toFiniteNumber(
      snapshotRaw?.verifiedRecommendationsCount ?? authUser.verifiedRecommendationsCount
    ),
    verificationStatus:
      snapshotRaw?.verificationStatus === "approved" ||
      snapshotRaw?.verificationStatus === "pending" ||
      snapshotRaw?.verificationStatus === "rejected" ||
      snapshotRaw?.verificationStatus === "suspended" ||
      snapshotRaw?.verificationStatus === "unknown"
        ? snapshotRaw.verificationStatus
        : authUser.verificationStatus === "approved" ||
            authUser.verificationStatus === "pending" ||
            authUser.verificationStatus === "rejected" ||
            authUser.verificationStatus === "suspended" ||
            authUser.verificationStatus === "unknown"
          ? authUser.verificationStatus
          : undefined,
    riskFlags: riskFlagsFromSnapshot ?? riskFlagsFromUser,
    confidenceLevel:
      snapshotRaw?.confidenceLevel === "low" ||
      snapshotRaw?.confidenceLevel === "medium" ||
      snapshotRaw?.confidenceLevel === "high"
        ? snapshotRaw.confidenceLevel
        : undefined,
  };
}

function buildUnifiedRoutingOptions(
  req: Request,
  body: unknown
): {
  situation?: Omit<SituationAnalysisInput, "intent" | "userContext">;
  trust?: ScoutTrustContext;
  tone?: {
    scenario?: ToneScenario;
    countyLabel?: string;
    roleLabel?: string;
    includeNextStep?: boolean;
  };
} {
  const source = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const situationRaw =
    source.situation && typeof source.situation === "object"
      ? (source.situation as Record<string, unknown>)
      : null;
  const toneRaw =
    source.tone && typeof source.tone === "object"
      ? (source.tone as Record<string, unknown>)
      : null;
  const trust = buildServerTrustContext(req);

  const situation = situationRaw
    ? {
        activeObjectives: Array.isArray(situationRaw.activeObjectives)
          ? (situationRaw.activeObjectives as any[])
          : undefined,
        recentEvents: Array.isArray(situationRaw.recentEvents)
          ? (situationRaw.recentEvents as any[])
          : undefined,
        urgencySignals: Array.isArray(situationRaw.urgencySignals)
          ? (situationRaw.urgencySignals as any[])
          : undefined,
        now:
          typeof situationRaw.now === "string" || situationRaw.now instanceof Date
            ? new Date(String(situationRaw.now))
            : undefined,
      }
    : undefined;

  const tone = toneRaw
    ? {
        scenario:
          toneRaw.scenario === "default" ||
          toneRaw.scenario === "technical_fallback" ||
          toneRaw.scenario === "confidence_low" ||
          toneRaw.scenario === "blocked_action" ||
          toneRaw.scenario === "next_step_prompt"
            ? (toneRaw.scenario as ToneScenario)
            : undefined,
        countyLabel: typeof toneRaw.countyLabel === "string" ? toneRaw.countyLabel : undefined,
        roleLabel: typeof toneRaw.roleLabel === "string" ? toneRaw.roleLabel : undefined,
        includeNextStep:
          typeof toneRaw.includeNextStep === "boolean" ? toneRaw.includeNextStep : undefined,
      }
    : undefined;

  return {
    situation,
    trust,
    tone,
  };
}

function normalizeScoutIntent(
  intent?: string | null,
  message?: string | null
): InsertScoutInteraction["intent"] {
  const source = (intent || "").toLowerCase();
  const text = (message || "").toLowerCase();

  if (source.includes("hire") || text.includes("hire") || text.includes("connect")) return "hire";
  if (source.includes("collab") || text.includes("collaborate") || text.includes("partner"))
    return "collaborate";
  if (source.includes("advis") || text.includes("advice") || text.includes("help")) return "advise";
  return "unknown";
}

function confidenceToScore(confidence: unknown): number {
  if (typeof confidence === "number" && Number.isFinite(confidence)) {
    const bounded = Math.max(0, Math.min(1, confidence));
    return Math.round(bounded * 100);
  }
  const label = typeof confidence === "string" ? confidence.toLowerCase() : "";
  if (label === "high") return 85;
  if (label === "medium") return 60;
  if (label === "low") return 30;
  return 0;
}

function hashMessageForScout(message: string | null | undefined): string | undefined {
  if (!message || !message.trim()) return undefined;
  return createHash("sha256").update(message).digest("hex").slice(0, 32);
}

// Lightweight fraud/scam guard for generated answers
const FRAUD_PATTERNS = [
  /gift\s*card/i,
  /wire\s*transfer/i,
  /bitcoin|crypto|usdt|wallet/i,
  /western\s*union|moneygram/i,
  /send\s+money|pay\s+immediately/i,
  /routing\s*number|account\s*number/i,
  /ssn|social\s*security/i,
];

const ALLOWED_OUTCOME_CONTEXTS = new Set([
  "direct_connect",
  "community",
  "trade_deal",
  "tool",
  "general",
]);

type DealRoomStage = "EMPTY" | "MATERIALS" | "ESTIMATE" | "CONTRACT" | "INVOICE" | "RECEIPT";

type AllowedAction =
  | "OPEN_DEAL_ROOM"
  | "START_MATERIAL_LIST"
  | "SEND_MATERIAL_LIST"
  | "SEND_ESTIMATE"
  | "APPROVE_ESTIMATE"
  | "SEND_CONTRACT"
  | "SIGN_CONTRACT"
  | "GENERATE_INVOICE"
  | "SEND_INVOICE"
  | "MARK_INVOICE_PAID"
  | "ISSUE_RECEIPT";

interface ResolvedContext {
  stage: DealRoomStage;
  blockingReason: string | null;
  allowedActions: AllowedAction[];
  confidence: "low" | "medium" | "high";
  requiresLLM: boolean;
}

function sanitizeSuspiciousContent(text: string): { flagged: boolean; message: string } {
  const flagged = FRAUD_PATTERNS.some((pattern) => pattern.test(text));
  const scrubbed = text.replace(/https?:\/\/\S+/g, "[link removed]");
  if (!flagged) {
    return { flagged: false, message: scrubbed };
  }

  const notice =
    "Safety notice: Potential scam content detected. Do not send money, gift cards, crypto, or share sensitive information.";
  return {
    flagged: true,
    message: `${scrubbed}\n\n${notice}`,
  };
}

const DEFAULT_AUTO_PROMPT = "What can TradeScout do for my community?";
const DEFAULT_SUGGESTIONS = [
  "Find roofers available this week",
  "List my pressure washer for $250",
  "Start the Community Builder for my area",
  "Support a local cause through the Foundation",
  "Draft 3 welcome post options for my local feed",
  "Show me top marketplace listings this week",
];

// Cache auto-prompt to avoid regenerating on every page load
let cachedAutoPrompt: {
  autoPrompt: string;
  suggestions: string[];
  source: "fallback" | "gemini";
  timestamp: number;
} | null = null;
const AUTO_PROMPT_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Cache comprehensive knowledge to avoid reloading on every request
let cachedComprehensiveKnowledge: string | null = null;
let lastKnowledgeCache = 0;
const KNOWLEDGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached comprehensive knowledge or reload if stale
 */
async function getCachedComprehensiveKnowledge(): Promise<string> {
  const now = Date.now();
  if (cachedComprehensiveKnowledge && now - lastKnowledgeCache < KNOWLEDGE_CACHE_TTL) {
    return cachedComprehensiveKnowledge;
  }

  cachedComprehensiveKnowledge = await loadComprehensiveKnowledge();
  lastKnowledgeCache = now;
  return cachedComprehensiveKnowledge;
}

/**
 * Detect if a message is an intro/overview question
 */
function isIntroQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  const introPatterns = [
    /^\s*scout\s*[?.!]*\s*$/i,
    /what\s+can\s+you\s+do(\s+for\s+me)?/i,
    /what\s+can\s+scout\s+do(\s+for\s+me)?/i,
    /what\s+can\s+tradescout\s+do/i,
    /how\s+can\s+you\s+help(\s+me)?/i,
    /how\s+can\s+scout\s+help(\s+me)?/i,
    /help\s+me\s+with\s+scout/i,
    /what\s+do\s+you\s+need\s+done/i,
    /help\s+me\s+understand\s+what\s+(you|scout|tradescout)\s+can\s+do/i,
    /what\s+is\s+tradescout/i,
    /how\s+does\s+tradescout\s+work/i,
    /tell\s+me\s+about\s+tradescout/i,
    /overview\s+of\s+tradescout/i,
    /tradescout\s+features/i,
    /tradescout\s+capabilities/i,
  ];

  return introPatterns.some((pattern) => pattern.test(lower));
}

/**
 * Generate smart synthesis response using comprehensive knowledge (for intro questions)
 */
async function generateSmartSynthesis(
  message: string,
  _gemini: GoogleGenerativeAI | null,
  llmProviders: LLMProvider[]
): Promise<{
  message: string;
  provider: string;
  degradationReason?: ScoutDegradationReason;
}> {
  if (!llmProviders.some((p) => p.isConfigured())) {
    return {
      message:
        "Scout can orient you right now: TradeScout helps people find trusted next steps across Direct Connect, Community, and Exchange.",
      provider: "fallback",
    };
  }

  try {
    // Use cached comprehensive knowledge
    const comprehensiveKnowledge = await getCachedComprehensiveKnowledge();

    // Create a synthesis-focused prompt focused on TRANSFORMATION, ROLES, and OS MENTAL MODEL
    const synthPrompt = `You are Scout, TradeScout's local search and summary surface. Your job is to give people a mind-opening orientation to TradeScout as their COMMUNITY OPERATING SYSTEM b7 not just "an app".

  IDENTITY LOCK (NON-NEGOTIABLE):
  - In /api/scout, the word "Scout" means TradeScout's local search and summary surface.
  - Never reinterpret Scout as an external brand unless the user explicitly asks about that external brand.
  - Never mention Scout.com, 247Sports, athletic recruiting, or "formerly known as Scout.com".
  - Never say "assuming this context".

  User asked: "${message}"

  Using the knowledge below, you MUST clearly explain:
  1. THE OS MENTAL MODEL
    - TradeScout is the operating system for a local community, where Scout (you) is the controller.
    - The chat is the front door: people can start almost anything by talking to Scout.
    - Pages like contractors, marketplace, groups, HOA, dashboards, and Community Builder are "tools" Scout can open and coordinate, not random separate sites.

  2. WHO IT IS FOR (ROLES ECOSYSTEM)
    - Homeowners, renters, contractors, helpers, realtors, dealers, HOA boards, property managers, small business owners, community leaders, and local organizers.
    - Make it obvious that EACH role fits into one shared ecosystem instead of everyone using separate platforms.

  3. WHAT IT DOES FOR THEM (OUTCOMES)
    - For a homeowner: finding vetted pros, tracking projects, seeing local updates, keeping money local.
    - For a contractor: winning better jobs, telling their story, managing leads, building trust in their county.
    - For realtors/dealers/property managers/HOA: seeing the same local graph, coordinating vendors, communicating with their people.
    - Make this feel like a connected system, not a list of tabs.

  4. MONEY FLOWS AND COMMUNITY IMPACT (HIGH LEVEL ONLY)
    - Local money stays in the community through things like community vaults, Community Builder, and county-focused initiatives.
    - Mention that when people use TradeScout, part of the value can flow back into local causes, trade school scholarships, or county projects (without going deep into mechanics).

  5. HOW SCOUT WORKS RIGHT NOW
    - Explain that Scout:
      * Understand what they are trying to do.
      * Open the right part of TradeScout (contractors, marketplace, groups, dashboards, etc.).
      * Surfaces planning context, estimates, and tracking paths for projects or ideas over time.

  DO NOT:
  - Describe backend mechanics or technical details (no databases, no Stripe, no LLMs).
  - Dump a long bullet list of micro-features.
  - Call yourself an AI, bot, model, or assistant.
  - Explain how you are implemented; stay in character as Scout, a local search and summary surface.
  - Use marketing buzzwords without concrete meaning.

  TONE & SHAPE:
  - Be conversational, confident, and grounded in the real world.
  - Use short paragraphs and occasional very short lists only when they make scanning easier.
  - This is their FIRST ORIENTATION to the OS, so it can be longer than a normal reply (several tight paragraphs), but it must NOT feel like a 10-page essay.
  - Always anchor the explanation in what this means for THEM and THEIR COMMUNITY, not abstract concepts.

  Available Knowledge Base:
  ${comprehensiveKnowledge}

  Now write an inspiring but concrete orientation that helps this person immediately understand what TradeScout is, who it serves, and how Scout will run the operating system for their community:`;

    const { text, provider } = await generateWithFallback(synthPrompt, llmProviders, {
      modelTier: "standard",
      promptCacheKey: "scout:intro_orientation",
    });
    // Allow a richer, orientation-style answer for intro questions
    return {
      message: trimResponseToScreenFit(text, { mode: "intro" }),
      provider,
    };
  } catch (error) {
    console.error("[Scout] Synthesis error:", error);
    recordFallback(isGeminiRateLimitFailure(error) ? "intro_rate_limited" : "intro_error");
    if (isGeminiRateLimitFailure(error)) {
      return {
        message:
          "TradeScout is your local operating system. Scout can move local outcomes forward across Community, Direct Connect, Exchange, and Community Builders without breaking trust gates.",
        provider: "fallback",
        degradationReason: "synthesis_rate_limited",
      };
    }
    return {
      message:
        "Scout surfaces local context, and TradeScout routes your next step through Community, Direct Connect, Exchange, and Community Builders. Tell me the outcome you want to move and I will open the best next step.",
      provider: "fallback",
      degradationReason: "synthesis_system_error",
    };
  }
}

/**
 * Generate smart synthesis using knowledge + conversation context
 * Enhanced version that elaborates and explains the knowledge intelligently
 * Now includes user-specific language and personalization
 * Returns structured response with message and suggestedActions
 *
 * ENFORCES MANDATORY EXECUTION CONTRACT:
 * - Required response schema with intent, message, suggestedActions
 * - Comprehensive state injection every turn
 * - No fallback paths - schema is mandatory
 */
function isGeminiRateLimitFailure(error: unknown): boolean {
  if (error instanceof GeminiRateLimitError) return true;
  const status = Number((error as any)?.status || (error as any)?.response?.status || 0);
  if (status === 429) return true;
  const message = String((error as any)?.message || "")
    .trim()
    .toLowerCase();
  return (
    message.includes("too many requests") ||
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("resource exhausted")
  );
}

function chooseScoutSynthesisModelTier(userMessage: string): ScoutLlmModelTier {
  const lower = String(userMessage || "").toLowerCase();
  if (
    /\b(code|codes|permit|permits|inspection|inspector|load-bearing|structural|foundation|electrical|breaker|panel|gas line|carbon monoxide|safety|hazard|asbestos|mold)\b/.test(
      lower
    )
  ) {
    return "reasoning";
  }

  return "standard";
}

function buildContextualSynthesisFallbackMessage(
  knowledgeAnswer: string | undefined,
  opts?: { rateLimited?: boolean }
): string {
  const scrubbed = sanitizeScoutUserFacingText(String(knowledgeAnswer || ""), {
    fallback: "",
    maxChars: 520,
  });
  const base = scrubbed.text.trim();
  if (base.length > 0) {
    const suffix = opts?.rateLimited
      ? "\n\nChoose the strongest next step below and I will keep moving this forward."
      : "";
    return trimResponseToScreenFit(`${base}${suffix}`);
  }

  if (opts?.rateLimited) {
    return trimResponseToScreenFit(
      "TradeScout can still move this forward through Community, Direct Connect, Exchange, or Community Builders. Choose the next step below and I will keep going from there."
    );
  }
  return trimResponseToScreenFit(
    "Scout surfaces local context, and TradeScout routes your next step through Community, Direct Connect, Exchange, and Community Builders without bypassing contact rules. Tell me the outcome you want to move and I will open the best next step."
  );
}

async function synthesizeResponse(
  userMessage: string,
  knowledge: {
    answer: string;
    sources: KnowledgeSourceReference[];
    layer: number;
    confidence: string;
  },
  _gemini: GoogleGenerativeAI | null,
  llmProviders: LLMProvider[],
  systemPrompt: string,
  conversationHistory: string,
  userContext?: any,
  historyMessages?: { role: string; content: string }[],
  durableMemoryContext?: ScoutReasoningMemoryContext | null,
  recentActivityPrompt?: string,
  requestState?: {
    auth: boolean;
    role: string;
    route?: string;
    capabilities?: string[];
    last_intent?: string;
    locality: { county?: string; state?: string; region?: string };
    launchContext?: ScoutLaunchContext;
  },
  resolvedContext?: ResolvedContext | null
): Promise<{
  message: string;
  suggestedActions: string[];
  intent?: string;
  provider?: string;
  degradationReason?: ScoutDegradationReason;
}> {
  const DEFAULT_ACTIONS = [
    "Find contractors in my area",
    "Explore Exchange deals",
    "Start Community Builder",
  ];

  if (!llmProviders.some((p) => p.isConfigured())) {
    return {
      message: knowledge.answer,
      suggestedActions: DEFAULT_ACTIONS,
      provider: "fallback",
      degradationReason: "provider_unavailable",
    }; // Fall back to raw knowledge if no Gemini
  }

  try {
    const tradeTopic = inferTradeTopicHint(userMessage);
    const tradeHintBlock = `
TRADE TOPIC HINT: ${tradeTopic ? tradeTopic.toUpperCase() : "NONE"}
`;
    const communityTopic = detectCommunityTopic(userMessage);
    const communityHintBlock = `
COMMUNITY TOPIC HINT: ${communityTopic ? communityTopic.toUpperCase() : "NONE"}
`;

    // [STATE INJECTION - COMPREHENSIVE]
    let stateInjection = "";
    if (requestState) {
      stateInjection = `
CURRENT STATE (injected every turn):
- auth: ${requestState.auth ? "logged in" : "guest"}
- role: ${requestState.role}
- route: ${requestState.route || "unknown"}
- capabilities: ${requestState.capabilities?.join(", ") || "basic navigation"}
- last_intent: ${requestState.last_intent || "none"}
- locality: ${requestState.locality.county || "unknown"}, ${requestState.locality.state || "unknown"}
`;
    }

    let resolvedContextInjection = "";
    if (resolvedContext) {
      resolvedContextInjection = `
RESOLVED PROJECT CONTEXT (deterministic, no raw documents):
${JSON.stringify(resolvedContext, null, 2)}
`;
    }

    let launchContextInjection = "";
    if (requestState?.launchContext) {
      launchContextInjection = `
CLASSIC VIEW CONTEXT (sanitized, user-selected reference):
${JSON.stringify(requestState.launchContext, null, 2)}
- Use this only to understand what the user was viewing when they opened Scout.
- Never invent missing details from an identifier.
- Visibility still does not grant contact, access, authority, or permission.
- Any contact path must continue through Intent -> Decision Card -> Contact.
`;
    }

    // [USER-CONTEXT INJECTION]
    // Build user context for personalized language
    let userContextPrompt = "";
    if (userContext) {
      userContextPrompt = formatUserContextForPrompt(userContext);
      userContextPrompt += `\n${generateThinkingContext(userContext, userMessage)}\n`;
    }

    const activityContext = recentActivityPrompt ? `\n${recentActivityPrompt}\n` : "";
    const synthesisMemoryBlocks = buildScoutSynthesisMemoryBlocks({
      conversationHistory,
      historyMessages: Array.isArray(historyMessages)
        ? historyMessages.filter(
            (item): item is { role: "user" | "assistant"; content: string } =>
              (item?.role === "user" || item?.role === "assistant") &&
              typeof item?.content === "string"
          )
        : [],
      durableMemory: durableMemoryContext,
    });

    // Smart synthesis that ENFORCES the execution contract
    const synthesisPrompt = `${systemPrompt}

  ${stateInjection}

  ${resolvedContextInjection}

  ${launchContextInjection}

  ${userContextPrompt}

  ${activityContext}

  ${synthesisMemoryBlocks}

  ${tradeHintBlock}
  ${communityHintBlock}

LOCALITY & ASSUMPTIONS (CRITICAL):
- CURRENT STATE locality tells you what area to assume for this user.
- If locality has a real county or state (not "unknown"), you MUST treat that as the user's area by default.
- Do NOT ask the user where they are unless BOTH county and state are unknown or the user explicitly says they are asking about a different area.
- When you talk about activity, pros, pricing, or community, assume the conversation is about the CURRENT STATE locality unless the user clearly overrides it.
- Locality is only for TradeScout routing and relevance. It must NEVER be used to infer product identity or reinterpret what "Scout" means.

User asked: "${userMessage}"

IDENTITY LOCK (NON-NEGOTIABLE):
- In /api/scout, "Scout" means TradeScout's built-in guide unless user explicitly names another product.
- Do not reinterpret Scout as Scout.com, 247Sports, or an athletic recruiting platform.
- Never write "assuming this context".

Knowledge from TradeScout (Layer ${knowledge.layer}):
${knowledge.answer}

KNOWLEDGE HANDLING RULES (CRITICAL):
- The knowledge block above is the only evidence source for codes, prices, eligibility, providers, and external facts.
- Active-thread and durable memory may establish the user's goals, preferences, corrections, and prior decisions, but never external facts.
- If wider-web findings were available, they are already reflected in the knowledge block above.
- NEVER tell the user "I can't search the internet" or "I cannot browse the web" in your message.
- Instead:
  - If Layer 1 or 2: speak confidently from TradeScout/local data.
  - If Layer 3: clearly say this includes wider-web or non-TradeScout findings.
  - If Layer 4: say you do not yet have enough verified information and move them to the strongest next step inside TradeScout.

SCOUT VOICE (USER-FACING MESSAGE ONLY):
- Sound like a calm local guide, not a generic chat interface, debugger, dispatcher, or legal disclaimer.
- Use plain homeowner/business language: "I found", "Start with", "Choose what fits", "Open here", "Ask before calling".
- Avoid system words in message and suggestedActions: route, routing, trust gates, controller, OS, surface, layer, verified live results, fallback, confidence, synthesis.
- Do not over-apologize or sound empty. If data is thin, say what to do next instead of dwelling on what is missing.
- Scout may open workspaces when asked, but default language should keep the work on this page: compare, review, draft, save, ask before contacting.
- Never say Scout can pay. For payments, say the user can open the payment page and complete it themselves.
- Do not answer a generic "find local help / best options" request with social-service referrals, emergency-resource referrals, or unrelated public programs unless the user asked for housing, utilities, food, emergency help, or assistance programs.
- For broad local-help requests, the message should summarize findings and paths, not be the whole result: "I'm treating this as [need]. The best paths are [path 1], [path 2], or [path 3]. Nothing is sent, posted, or shared until you approve it."
- If there are two likely interpretations, present both options directly; do not end by asking which one they mean.

COMPETITIVE PATTERN RULES:
- Copy the good interaction patterns from existing systems, not their bad incentives.
- Like Thumbtack: collect only details that change the match or path; do not trap the user in a long form.
- Like Yelp: summarize local signals instead of dumping raw reviews/posts.
- Like Google Local Services: keep trust/verification visible, but never imply paid placement or guaranteed quality.
- Like Houzz: keep project planning, materials, price factors, and pros together when the user is doing work.
- Like app connectors: open or draft the right action surface only when useful, and never imply Scout already booked, ordered, paid, messaged, posted, quoted, invoiced, or contacted anyone.

**YOU MUST RESPOND WITH THIS JSON SHAPE - NO EXCEPTIONS:**

{
  "intent": "string - classified user intent (e.g., find_contractor, ask_pricing, list_item, get_help)",
  "message": "string - your actual response to the user (max 3 short sentences; no bullet lists unless user explicitly asked for a list; must follow SCOUT VOICE; should read as findings + recommended paths, not a long answer)",
  "suggestedActions": [
    "Action prompt 1",
    "Action prompt 2",
    "Action prompt 3"
  ]
}

CRITICAL EXECUTION RULES:
1. You MUST classify user intent explicitly
2. Do not expose internal reasoning to the user-facing response
4. If user is not authenticated (auth: guest) and asks for action that requires login, you MUST:
   - Set intent to "auth_required"
   - Explain briefly why auth is needed in the message
   - Include the direct link to /pre-scout-setup?mode=create in the message
5. Keep message brief (max 3 sentences; no bullet or numbered lists unless the user explicitly asked you to list things)
6. Focus the message on: what Scout understood, the best next paths, and what is protected before anything is sent/shared. Avoid ending with a question unless the user explicitly asked Scout to choose between two unknowns.
7. Always generate exactly 3 suggestedActions
8. suggestedActions are your THREE BEST GUESSES for what the user most likely wants to do next based on:
  - Their latest message
  - The conversation history
  - CURRENT STATE, RESOLVED PROJECT CONTEXT, and TRADE TOPIC HINT
9. Each suggestedAction MUST be a concrete, user-facing next step, such as:
  - "Find vetted [trade] pros for this job in [county]"
  - "Turn this into a trackable project on my board"
  - "Show me local groups, feeds, or dashboards that matter for this"
  - "Help me compare DIY vs hire-out options for this"
10. NEVER use vague or meta actions like "Ask another question" or "Explain more". Every action should clearly move the user forward in a real-world flow.
11. Align suggestedActions with the user's auth state and capabilities:
  - Guests: prefer exploration, learning, and light planning actions that don't require posting/applying/messaging.
  - Logged-in users: you MAY include actions that create or update things (tasks, listings, projects, groups, applications) when consistent with intent.
12. Order suggestedActions from highest expected utility to lowest expected utility.

HOME & TRADE PROJECT ENRICHMENT (IMPORTANT):
TRADE TOPIC HINT is a pre-detected signal that this is a trade or home-repair question. If TRADE TOPIC HINT is not "NONE", you MUST treat it as a trade/home-repair problem and apply these rules conservatively.
- If the user is asking about a home repair, improvement, or trade-specific problem (plumbing, electrical, HVAC, roofing, foundation, framing, concrete, etc.) and you are routing toward contractors or next steps, your message SHOULD, **only when you have reliable information**, also:
  - Briefly include a realistic price RANGE **only if** you can base it on trusted data (admin cache, TradeScout data, or well-known non-local cost guides). If you do not have a safe basis for a range, explicitly say you don't know exact pricing and avoid specific numbers.
  - Briefly mention the main MATERIALS or components likely involved **only if** they are standard for that trade and not speculative. Keep them high-level (for example, "common PVC drain components" instead of an exhaustive parts list).
  - Briefly call out 1–3 relevant building code or permit TOPICS by name or section reference **only if** they are generally applicable topics, and ALWAYS remind the user that final requirements come from their local building department and licensed professionals.
- Keep this enrichment inside the same 2–3 sentence limit by writing dense, information-rich sentences instead of lists, and prefer honesty over speculation.

COMMUNITY & GROUPS ENRICHMENT (IMPORTANT):
COMMUNITY TOPIC HINT is a pre-detected signal that this is a question about local community, neighbors, groups, HOAs, boards, or events.
- If COMMUNITY TOPIC HINT is not "NONE", you MUST base your answer on what TradeScout can do FIRST:
  - Community feed and local updates
  - Local groups, HOAs, boards, and building/association views
  - Community Builder, causes, and local initiatives
- Prefer TradeScout workspaces and flows instead of generic internet advice, but use plain labels like "See local posts" or "Open Home Vault".
- You MAY mention "other sites or apps you already use" in generic terms, but DO NOT name or promote specific external platforms unless the user explicitly asks you about them by name.
- If local data is thin, be honest about that, but still show how Scout surfaces local context, and TradeScout routes the next step for what they want to do with their community.

AUTH-REQUIRED ACTIONS:
- Posting tasks, items, listings
- Applying to jobs
- Messaging contractors
- Joining groups/communities
- Creating causes or campaigns
- Any "create", "post", "apply", "message", "join" action

If user requests auth-required action while guest:
- intent: "auth_required"
- message: "To [do that action], you'll need a TradeScout account. [Click here to create one](/pre-scout-setup?mode=create) - it takes less than a minute!"

${knowledge.layer === 1 || knowledge.layer === 2 ? "This is TradeScout data - speak with confidence and authority." : ""}
${knowledge.layer === 3 ? "This is from the internet, not local TradeScout data - be clear about that." : ""}
${knowledge.layer === 4 ? "You don't have reliable info - return the safest next-step guidance." : ""}

RESPOND WITH VALID JSON ONLY - NO MARKDOWN, NO CODE FENCES, JUST RAW JSON.`;

    const { text: rawGeneratedText, provider } = await generateWithFallback(
      synthesisPrompt,
      llmProviders,
      {
        modelTier: chooseScoutSynthesisModelTier(userMessage),
        responseFormat: "scout_synthesis_json",
        promptCacheKey: "scout:turn_synthesis",
      }
    );
    let rawResponse = rawGeneratedText;

    // Strip markdown code fences if present
    rawResponse = rawResponse
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Parse JSON response with enforced schema
    try {
      let parsed: any = null;
      try {
        parsed = JSON.parse(rawResponse);
      } catch (strictParseError) {
        // Recovery path: some providers wrap JSON with prefatory/trailing text.
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw strictParseError;
        parsed = JSON.parse(jsonMatch[0]);
      }

      // Validate schema — only message is a hard requirement.
      // intent is soft-required: auto-fill if missing rather than hard-failing to fallback.
      if (!parsed.message) {
        console.warn("[Scout] LLM response missing required 'message' field, using fallback");
        recordFallback("schema_violation");
        return {
          intent: "unknown",
          message: buildContextualSynthesisFallbackMessage(knowledge.answer),
          suggestedActions: DEFAULT_ACTIONS,
          provider: "fallback",
          degradationReason: "schema_violation",
        };
      }
      // Auto-fill intent so downstream telemetry never crashes
      if (!parsed.intent) parsed.intent = "general";

      // Enforce length limit on message
      parsed.message = trimResponseToScreenFit(parsed.message);

      // Normalize and clamp suggested actions: always return 3 concrete, unique options
      let actions: string[] = Array.isArray(parsed.suggestedActions)
        ? parsed.suggestedActions
            .filter((a: unknown) => typeof a === "string" && a.trim().length > 0)
            .map((a: string) => a.trim())
        : [];

      // Hard cap length per action to keep chips readable
      actions = actions.map((a) => (a.length > 80 ? `${a.slice(0, 77)}...` : a));

      const unique: string[] = [];
      for (const a of actions) {
        if (unique.length >= 3) break;
        if (a && !unique.includes(a)) {
          unique.push(a);
        }
      }

      let idx = 0;
      while (unique.length < 3 && idx < DEFAULT_ACTIONS.length) {
        const fallback = DEFAULT_ACTIONS[idx++];
        if (!unique.includes(fallback)) unique.push(fallback);
      }

      const finalActions = unique.slice(0, 3);

      return {
        intent: parsed.intent,
        message: parsed.message,
        suggestedActions: finalActions,
        provider,
      };
    } catch (parseError) {
      console.error("[Scout] Failed to parse LLM JSON response:", parseError);
      console.error("[Scout] Raw response was:", rawResponse);
      recordFallback("json_parse_error");

      // NO FALLBACK PATHS - Return structured error
      return {
        intent: "parse_error",
        message: buildContextualSynthesisFallbackMessage(knowledge.answer),
        suggestedActions: DEFAULT_ACTIONS,
        provider: "fallback",
        degradationReason: "json_parse_error",
      };
    }
  } catch (error) {
    console.error("[Scout] Synthesis error:", error);
    const isRateLimited = isGeminiRateLimitFailure(error);
    recordFallback(isRateLimited ? "synthesis_rate_limited" : "synthesis_system_error");

    // Even errors must follow the contract
    return {
      intent: isRateLimited ? "llm_rate_limited" : "system_error",
      message: buildContextualSynthesisFallbackMessage(knowledge.answer, {
        rateLimited: isRateLimited,
      }),
      suggestedActions: DEFAULT_ACTIONS,
      provider: "fallback",
      degradationReason: isRateLimited ? "synthesis_rate_limited" : "synthesis_system_error",
    };
  }
}

/**
 * Parse structured JSON response from LLM with fail-safes
 * Ensures valid format: { message: string, suggestedActions: string[] }
 */
/**
 * Trim response to ensure it fits on screen without scrolling.
 * For general answers we keep things tight; for the first OS orientation
 * (intro questions) we allow a bit more depth while still staying mobile-friendly.
 */
function trimResponseToScreenFit(response: string, opts?: { mode?: "default" | "intro" }): string {
  const mode = opts?.mode ?? "default";

  // Approximate a "no scroll" viewport using conservative text caps.
  // Intro mode is allowed more headroom so Scout can fully orient new users
  // without turning into a long wall of text.
  const MAX_CHARS = mode === "intro" ? 1100 : 600;
  const MAX_LINES = mode === "intro" ? 12 : 8;

  if (!response) return "";

  // Normalize whitespace and split into paragraphs
  const normalized = response.replace(/\r\n/g, "\n").replace(/\s+$/gm, "").trim();
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  let result = "";
  let charCount = 0;
  let lineCount = 0;

  for (const para of paragraphs) {
    if (!para) continue;

    const next = (result ? "\n\n" : "") + para;
    const nextCharCount = charCount + next.length;
    const paraLines = Math.max(1, Math.ceil(para.length / 80));
    const nextLineCount = lineCount + paraLines + (result ? 1 : 0); // account for blank line between

    if (nextCharCount > MAX_CHARS || nextLineCount > MAX_LINES) {
      break;
    }

    result += next;
    charCount = nextCharCount;
    lineCount = nextLineCount;
  }

  if (!result) {
    // Fallback: take a hard slice if everything is oversized
    const slice = normalized.slice(0, MAX_CHARS);
    return slice.endsWith(".") || slice.endsWith("!") || slice.endsWith("?")
      ? slice
      : slice + "...";
  }

  // If we dropped paragraphs, add a soft cue at the end
  if (result.length < normalized.length) {
    console.log("[Scout] viewport trim applied", { chars: charCount, lines: lineCount });
    result +=
      "\n\nI've summarized this to keep it readable. Use the actions below to go deeper where you need.";
  }

  return ensureFollowUpQuestion(result);
}

/**
 * Prepend a short, local-aware first line so Scout feels like a
 * confident local guide instead of a generic assistant. This is
 * ONLY applied on the first turn of a conversation when we know
 * the user's county or state.
 */
function prependLocalIntro(
  message: string,
  opts: {
    countyCode?: string;
    stateCode?: string;
    historyLength: number;
    communityPostCount: number;
    contractorCount: number;
  }
): string {
  // Disabled for now: this intro line was producing generic copy that felt fake/noisy in production.
  // Keep function signature for compatibility with existing call sites.
  void opts;
  return message;

  /*
  if (!message) return message;

  // Only shape the very first answer in a thread.
  if (opts.historyLength > 0) return message;

  const hasLocation = Boolean(opts.countyCode || opts.stateCode);
  if (!hasLocation) return message;

  const area = opts.countyCode || opts.stateCode || "your area";

  // Avoid double "Here's..." prefixes if the model already opened that way.
  const lowerFirstLine = message.split("\n")[0]?.trim().toLowerCase() ?? "";
  if (lowerFirstLine.startsWith("here's") || lowerFirstLine.startsWith("heres")) {
    return message;
  }

  const hasSignals = opts.communityPostCount > 0 || opts.contractorCount > 0;
  const header = hasSignals
    ? `Here's what's active around you in ${area}.`
    : `Based on what's happening in ${area}, here's how I'd approach this.`;

  return `${header}\n\n${message}`;
  */
}

function detectCommunityTopic(message: string): string | null {
  const lower = message.toLowerCase();

  if (
    /(connect|meet|talk|message|chat|get to know).*(neighbors?|neighbours?|people|community)/.test(
      lower
    )
  ) {
    return "community_connect";
  }

  if (
    /(community|neighbors?|neighbours?|local people|my area|my town).*(group|groups|club|clubs|meetup|events?)/.test(
      lower
    )
  ) {
    return "community_groups";
  }

  if (/(hoa|homeowners' association|condo board|board meeting|association meeting)/.test(lower)) {
    return "hoa";
  }

  if (/(volunteer|serve|help out|give back).*(community|neighborhood|county)/.test(lower)) {
    return "community_serve";
  }

  return null;
}

function inferTradeTopicHint(message: string): string | null {
  const lower = message.toLowerCase();

  if (
    /(leak|clog|backup|sewer|drain|cleanout|p-trap|ptrap|trap arm|vent stack|sump pump|water heater|tankless|supply line|shutoff valve)/.test(
      lower
    )
  ) {
    return "plumbing";
  }

  if (
    /(panel upgrade|service panel|breaker panel|subpanel|gfci|g.f.c.i|afci|arc-fault|receptacle|outlet|dedicated circuit|240v|240 v|220v|220 v|load calculation|lighting circuit)/.test(
      lower
    )
  ) {
    return "electrical";
  }

  if (
    /(furnace|air handler|condenser|heat pump|mini split|hvac|ac not working|no cooling|no heat|refrigerant|freon)/.test(
      lower
    )
  ) {
    return "hvac";
  }

  if (
    /(shingle|roof deck|underlayment|flashing|ridge vent|soffit vent|drip edge|hail damage|wind damage|roof leak)/.test(
      lower
    )
  ) {
    return "roofing";
  }

  if (
    /(foundation crack|settling|heaving|pier and beam|slab foundation|mudjacking|helical pier|concrete leveling|spalling)/.test(
      lower
    )
  ) {
    return "foundation";
  }

  if (
    /(deck|decking|porch|patio|stairs|railing|guardrail|joist hanger|ledger board|composite deck|treated lumber)/.test(
      lower
    )
  ) {
    return "decking";
  }

  if (/(fence|fencing|gate post|privacy fence|chain link|wood fence|vinyl fence)/.test(lower)) {
    return "fencing";
  }

  if (/(siding|hardie|fiber cement|lap siding|board and batten|soffit|fascia)/.test(lower)) {
    return "siding";
  }

  if (
    /(concrete patio|driveway pour|slab pour|rebar grid|control joints|expansion joint|stamped concrete)/.test(
      lower
    )
  ) {
    return "concrete";
  }

  if (
    /(framing|load-bearing wall|header beam|lintel|rim joist|floor joist|wall stud|sister joist)/.test(
      lower
    )
  ) {
    return "framing";
  }

  return null;
}

async function generateAutoPrompt(gemini: GoogleGenerativeAI | null) {
  // Return cached version if still fresh
  const now = Date.now();
  if (cachedAutoPrompt && now - cachedAutoPrompt.timestamp < AUTO_PROMPT_CACHE_TTL) {
    return cachedAutoPrompt;
  }

  if (!gemini) {
    const result = {
      source: "fallback" as const,
      autoPrompt: DEFAULT_AUTO_PROMPT,
      suggestions: DEFAULT_SUGGESTIONS,
      timestamp: now,
    };
    cachedAutoPrompt = result;
    return result;
  }

  try {
    const prompt = `You are designing the very first question a brand new person should run through Scout search, TradeScout's local search and summary surface b7 a community operating system, not just an app.

Create a SINGLE best starter prompt that will cause Scout to give a rich orientation to TradeScout as their community OS b7 what it is, who it serves, and how it can run their local projects and community flows.

Guidelines for autoPrompt:
- It should sound natural for a normal person who has never heard of TradeScout.
- It should invite Scout to explain the OS and how it can help THEM and THEIR COMMUNITY, not just list features.
- Keep it concise (under 140 characters) and in the form of a question.

Also return 6 short suggestion prompts that help them explore high-impact things Scout can do for them (finding pros, starting projects, connecting community, etc.). None of the suggestions or the autoPrompt should describe Scout as an AI, bot, or model.

Return JSON with keys autoPrompt (string) and suggestions (string array).`;
    const { text } = await generateGeminiTextWithFallback(gemini, prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const autoPrompt =
        typeof parsed.autoPrompt === "string" && parsed.autoPrompt.trim().length > 0
          ? parsed.autoPrompt.trim()
          : DEFAULT_AUTO_PROMPT;
      const suggestions =
        Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
          ? parsed.suggestions.slice(0, 6).map((s: any) => String(s))
          : DEFAULT_SUGGESTIONS;

      const generated = { source: "gemini" as const, autoPrompt, suggestions, timestamp: now };
      cachedAutoPrompt = generated;
      return generated;
    }
  } catch (error) {
    console.warn("[Scout] Auto-prompt generation failed; falling back to defaults", error);
  }

  const fallback = {
    source: "fallback" as const,
    autoPrompt: DEFAULT_AUTO_PROMPT,
    suggestions: DEFAULT_SUGGESTIONS,
    timestamp: now,
  };
  cachedAutoPrompt = fallback;
  return fallback;
}

// Initialize LLM providers (add more as needed)
const llmProviders: LLMProvider[] = buildScoutLlmProviders();

// Dedicated Gemini client for knowledge layer (internet search)
const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ScoutRequest {
  message: string;
  history?: ChatMessage[];
  countyCode?: string;
  stateCode?: string;
  countyHint?: string; // Phase 3B: County FIPS for jurisdiction-aware bias
  locality?: {
    lat?: number;
    lng?: number;
  };
  intent?: string;
  launchContext?: ScoutLaunchContext;
  roles?: string[];
  recentActivity?: Array<{
    type: string;
    ts: string;
    path?: string;
    to?: string;
    label?: string;
    meta?: Record<string, unknown>;
  }>;
  shownAdIds?: string[];
  onboarding?: boolean; // D2-1: Onboarding flag
  sessionId?: string; // D2-1: Session tracking
  onboardingAnswer?: string; // D2-2: Answer to onboarding question
  onboardingQuestionKey?: string; // D2-2: Which question is being answered
}

interface ScoutActionChip {
  id: string;
  label: string;
  kind: "NAVIGATE" | "CALL_TOOL";
  target: string;
  args?: unknown;
  priority?: "primary" | "secondary";
  subtitle?: string;
}

interface ScoutResponseFrame {
  templateId?: string;
  truthLines: string[];
  meaningLine?: string;
  directionLine?: string;
  actionChips?: ScoutActionChip[];
  suggestedPrompts?: string[];
  workingContextDelta?: {
    topic?: "finances" | "projects" | "community" | "docs";
    jobId?: string;
    communityId?: string;
  };
}

interface ScoutWorkingContext {
  lastTopic?: "finances" | "projects" | "community" | "docs";
  lastJobId?: string;
  lastCommunityId?: string;
  lastTemplateId?: string;
}

interface ScoutPublicEntityBase {
  id: string;
  href?: string;
}

interface ScoutPublicTradeDeal extends ScoutPublicEntityBase {
  type: "trade_deal";
  ownerUserId?: string | null;
  canDirectConnect?: boolean;
  canMessage?: boolean;
}

interface ScoutPublicCommunityPost extends ScoutPublicEntityBase {
  type: "community_post";
  authorId?: string | null;
  canDirectConnect?: boolean;
  canMessage?: boolean;
}

interface ScoutPublicDirectConnectRequest extends ScoutPublicEntityBase {
  type: "direct_connect_request";
  authorId?: string | null;
  canDirectConnect?: boolean;
  canMessage?: boolean;
}

type ScoutPublicEntity =
  | ScoutPublicTradeDeal
  | ScoutPublicCommunityPost
  | ScoutPublicDirectConnectRequest;

function isExternalFoodIntent(messageText: string) {
  if (!messageText) return false;
  return /(hungry|food|eat|taco|bbq|burger|pizza|coffee|food truck|near me|lunch|dinner|breakfast)/i.test(
    messageText
  );
}

function coerceFiniteNumber(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

interface ScoutCtaHintServer {
  type: "trade_deal" | "community_post" | "direct_connect_request";
  id: string;
  ownerUserId?: string | null;
  authorId?: string | null;
  canDirectConnect?: boolean;
  canMessage?: boolean;
  label?: string;
}

export interface ScoutResponse {
  message: string;
  suggestedActions?: string[];
  actions?: ScoutClientAction[];
  actionResults?: any[];
  frame?: ScoutResponseFrame;
  workingContext?: ScoutWorkingContext;
  sponsored?: {
    id: string;
    title: string;
    content: string;
    imageUrl?: string | null;
    linkUrl?: string | null;
    isAffiliate?: boolean | null;
    targetLocation?: string | null;
  } | null;
  /**
   * Structured, public entities that Scout surfaced while answering.
   * These are safe to show in UI and can be used for CTAs and deep-links.
   */
  publicEntities?: ScoutPublicEntity[];
  /**
   * Lightweight CTA hints derived from publicEntities or deterministic tools.
   * The client maps this 1:1 to ScoutCtaHint in client/src/scout/ctaHelpers.ts.
   */
  ctaHints?: ScoutCtaHintServer[];
  overrideOption?: {
    label: string;
    message: string;
    scope?: string;
    logAction: "ignored_advice";
    contextType?: string;
    contextId?: string | null;
  };
  metadata?: {
    intent?: string;
    decision?: string;
    scaffoldDecision?: string;
    scaffoldReason?: string;
    behaviorKey?: string;
    redirect?: string;
    sourceUsed?: string;
    attemptedSource?: string;
    fallbackUsed?: boolean;
    degradationReason?: ScoutDegradationReason;
    confidenceBand?: SourceConfidenceBand;
    resolvedContext?: ResolvedContext | null;
    currentJobId?: string;
    governorAction?: string;
    governorRole?: string;
    governorReasoning?: string;
    situation?: {
      goal: string;
      risks: import("../scout/governor").Risk[];
      unknowns: string[];
      confidence: "low" | "medium" | "high";
    };
    outcomeGraph?: import("../scout/governor").OutcomeGraph | null;
  };
}

function getClientSafeScoutMetadata(metadata: ScoutResponse["metadata"] | undefined) {
  if (!metadata) return undefined;
  const {
    thought_flow: _thoughtFlow,
    decision: _decision,
    reasoning: _reasoning,
    analysis: _analysis,
    ...clientMetadata
  } = metadata as Record<string, unknown>;
  return clientMetadata as ScoutResponse["metadata"];
}

function isTaskOrProblemIntent(message: string): boolean {
  return /(fix|repair|replace|install|build|need help|looking for|how much|estimate|cost|materials for)/i.test(
    message
  );
}

function isClearProviderServiceIntent(message: string): boolean {
  const lower = message.toLowerCase();

  const explicitPhrases =
    /(ac\s+repair|roof\s+leak|broken\s+pipe|not\s+cooling|need\s+help\s+today)/i;
  if (explicitPhrases.test(lower)) return true;

  const hasTradeSurface =
    /(ac\b|hvac|air\s*condition|furnace|roof|roofer|shingle|gutter|plumb|pipe|drain|toilet|faucet|electri|panel|breaker|outlet|water\s*heater|drywall|floor|tile|carpet|garage\s*door|septic|mold)/i.test(
      lower
    );

  const hasServiceNeed =
    /(repair|fix|install|replace|broken|not\s+working|stopped\s+working|need\s+someone|need\s+help|urgent|asap|today|leak)/i.test(
      lower
    );

  return hasTradeSurface && hasServiceNeed;
}

function isDealHelpfulForTask(message: string): boolean {
  return /(materials|supplies|lumber|roofing|plumbing|electrical|hvac|concrete|windows|insulation)/i.test(
    message
  );
}

function isDealSuppressedContext(message: string): boolean {
  return /(who do you recommend|best contractor|is this normal|what should i do|legal|code|permit|inspection|complaint|scam)/i.test(
    message
  );
}

const SCOUT_DEAL_ASSIST_ENABLED = process.env.SCOUT_DEAL_ASSIST !== "false";

export type ScoutClientAction = {
  type:
    | "NAVIGATE"
    | "CALL_TOOL"
    | "PREFILL_INPUT"
    | "OPEN_APP_DRAWER"
    | "OPEN_TOOLS_DRAWER"
    | "ASK_SCOUT"
    | "NOOP"
    | string;
  label: string;
  to?: string;
  path?: string;
  prompt?: string;
  payload?: Record<string, unknown>;
  subtitle?: string;
  why?: string;
  primary?: boolean;
};

export type ScoutAction = ScoutClientAction;

type OutcomeActionTelemetry = {
  ownerModule: string;
  target: string;
  confidenceBand: "high" | "medium" | "low" | "unknown";
  payloadCompleteness: number;
};

function resolveOutcomeActionTelemetry(action: any): OutcomeActionTelemetry | null {
  const payload = action?.payload && typeof action.payload === "object" ? action.payload : null;
  if (!payload) return null;

  const source = typeof payload.source === "string" ? payload.source : "";
  const target = typeof payload.target === "string" ? payload.target : "";
  if (!source || !target) return null;

  const prefill = payload.prefill && typeof payload.prefill === "object" ? payload.prefill : {};
  const confidenceBand =
    payload.confidenceBand === "high" ||
    payload.confidenceBand === "medium" ||
    payload.confidenceBand === "low"
      ? payload.confidenceBand
      : "unknown";

  const requiredByTarget: Record<string, string[]> = {
    direct_connect_request: ["jobType", "location", "scope", "urgency"],
    exchange_listing: ["title", "category", "location", "price", "description"],
    community_post: ["title", "body", "countyCode", "category", "visibility"],
  };

  const required = requiredByTarget[target] || [];
  const present = required.filter((k) => {
    const v = (prefill as any)?.[k];
    if (v === undefined || v === null) return false;
    if (typeof v === "string" && v.trim().length === 0) return false;
    return true;
  }).length;
  const payloadCompleteness = required.length > 0 ? present / required.length : 1;

  return {
    ownerModule: source,
    target,
    confidenceBand,
    payloadCompleteness,
  };
}

function inferJobIdFromActivity(recentActivity: ScoutRequest["recentActivity"]): string | null {
  if (!recentActivity || !recentActivity.length) return null;

  for (let i = recentActivity.length - 1; i >= 0; i -= 1) {
    const evt = recentActivity[i];
    if (!evt) continue;

    const metaJobId = (evt.meta as any)?.jobId;
    if (typeof metaJobId === "string" && metaJobId.trim()) {
      return metaJobId.trim();
    }

    const target = evt.to || evt.path;
    if (typeof target === "string" && target.includes("jobId=")) {
      try {
        const url = new URL(target, "https://dummy.local");
        const jobId = url.searchParams.get("jobId");
        if (jobId && jobId.trim()) return jobId.trim();
      } catch {
        // ignore malformed URLs
      }
    }
  }

  return null;
}

async function getPrimaryProjectIdForUser(
  userId: string,
  userRole: string | undefined
): Promise<string | null> {
  try {
    if (!userId) return null;

    if (userRole === "contractor") {
      const contractor = await storage.getContractorByUserId(userId);
      if (!contractor) return null;

      const rows = await db
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.contractorId, contractor.id))
        .orderBy(desc(leads.createdAt))
        .limit(1);

      return rows[0]?.id ? String(rows[0].id) : null;
    }

    if (userRole === "homeowner") {
      const rows = await db
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.userId, userId))
        .orderBy(desc(leads.createdAt))
        .limit(1);

      return rows[0]?.id ? String(rows[0].id) : null;
    }

    return null;
  } catch (err) {
    console.error("[Scout] Failed to resolve primary project id", err);
    return null;
  }
}

function extractProfileIdFromText(text: string): string | null {
  const match = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0] : null;
}

function extractDollarAmount(text: string): number | null {
  // Prefer explicit currency markers to avoid picking up years or counts.
  const dollar = text.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  if (dollar?.[1]) {
    const n = Number(dollar[1]);
    return Number.isFinite(n) ? n : null;
  }

  const words = text.match(/(\d+(?:\.\d{1,2})?)\s*(?:usd|dollars?)/i);
  if (words?.[1]) {
    const n = Number(words[1]);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return "$0";
  const rounded = Math.round(amount * 100) / 100;
  return rounded % 1 === 0 ? `$${rounded.toFixed(0)}` : `$${rounded.toFixed(2)}`;
}

function appendFinanceConfidenceLine(message: string): string {
  // Avoid duplicating the confidence line if we already added it earlier
  if (message.includes("TradeScout invoices and expenses")) {
    return message;
  }

  const confidenceLine =
    "When I quote amounts here, they're pulled directly from your TradeScout invoices and expenses, not estimates or guesses.";

  return trimResponseToScreenFit(`${message}\n\n${confidenceLine}`);
}

type ScoutFinanceQueryable = { query: typeof pool.query };

export async function getStandaloneAccountingSnapshotForUser(
  userId: string,
  queryable: ScoutFinanceQueryable = pool
): Promise<{
  totalInvoiced: number;
  totalPaid: number;
  totalUnpaid: number;
  clientCount: number;
  largestOpenClient?: { name: string; amount: number } | null;
}> {
  // Reuse the same document model as the standalone Finances workspace.
  const { rows } = await queryable.query(
    `SELECT
        COALESCE(payload->>'clientName', '(no client)') AS client_name,
        status,
        COALESCE((payload->>'total')::numeric, 0) AS total
      FROM documents
      WHERE type = 'INVOICE'
        AND created_by = $1
        AND job_id IS NULL
        AND left(payload->>'accountingGroupId', 5) = 'acct_'
        AND permissions->>'lineageKind' = 'standalone_accounting'`,
    [userId]
  );

  console.info("[Scout][Finance] standalone accounting snapshot", {
    userId,
    invoiceCount: Array.isArray(rows) ? rows.length : 0,
  });

  let totalInvoiced = 0;
  let totalPaid = 0;
  const perClientOpen: Record<string, number> = {};

  for (const row of rows as any[]) {
    const clientName: string = row.client_name || "(no client)";
    const status: string = row.status || "draft";
    const amount: number = Number(row.total) || 0;

    totalInvoiced += amount;
    if (status === "paid") {
      totalPaid += amount;
    } else {
      perClientOpen[clientName] = (perClientOpen[clientName] || 0) + amount;
    }
  }

  const totalUnpaid = Math.max(0, totalInvoiced - totalPaid);
  const clientNames = Object.keys(perClientOpen);
  let largestOpenClient: { name: string; amount: number } | null = null;
  for (const name of clientNames) {
    const amount = perClientOpen[name];
    if (!largestOpenClient || amount > largestOpenClient.amount) {
      largestOpenClient = { name, amount };
    }
  }

  return {
    totalInvoiced,
    totalPaid,
    totalUnpaid,
    clientCount: clientNames.length,
    largestOpenClient,
  };
}

export async function getStandaloneVendorSnapshotForUser(
  userId: string,
  queryable: ScoutFinanceQueryable = pool
): Promise<{
  totalExpenses: number;
  vendorCount: number;
  topVendor?: { name: string; amount: number } | null;
}> {
  const { rows } = await queryable.query(
    `SELECT
        COALESCE(payload->>'vendorName', '(no vendor)') AS vendor_name,
        COALESCE((payload->>'total')::numeric, 0) AS total
      FROM documents
      WHERE type = 'EXPENSE'
        AND created_by = $1
        AND job_id IS NULL
        AND left(payload->>'accountingGroupId', 5) = 'acct_'
        AND permissions->>'lineageKind' = 'standalone_accounting'`,
    [userId]
  );

  console.info("[Scout][Finance] standalone vendor snapshot", {
    userId,
    expenseCount: Array.isArray(rows) ? rows.length : 0,
  });

  let totalExpenses = 0;
  const perVendor: Record<string, number> = {};

  for (const row of rows as any[]) {
    const vendorName: string = row.vendor_name || "(no vendor)";
    const amount: number = Number(row.total) || 0;
    totalExpenses += amount;
    perVendor[vendorName] = (perVendor[vendorName] || 0) + amount;
  }

  const vendorNames = Object.keys(perVendor);
  let topVendor: { name: string; amount: number } | null = null;
  for (const name of vendorNames) {
    const amount = perVendor[name];
    if (!topVendor || amount > topVendor.amount) {
      topVendor = { name, amount };
    }
  }

  return {
    totalExpenses,
    vendorCount: vendorNames.length,
    topVendor,
  };
}

async function getJobFinancesSnapshot(jobId: string): Promise<{
  income: number;
  collected: number;
  outstanding: number;
  expenses: number;
  net: number;
}> {
  const { rows } = await pool.query(
    `SELECT type,
            status,
            COALESCE((payload->>'total')::numeric, 0) AS total
       FROM documents
       WHERE job_id = $1`,
    [jobId]
  );

  console.info("[Scout][Finance] job finances snapshot", {
    jobId,
    documentCount: Array.isArray(rows) ? rows.length : 0,
  });

  let income = 0;
  let collected = 0;
  let expenses = 0;

  for (const row of rows as any[]) {
    const type: string = row.type || "";
    const status: string = row.status || "";
    const amount: number = Number(row.total) || 0;

    if (type === "INVOICE") {
      income += amount;
      if (status === "paid") {
        collected += amount;
      }
    } else if (type === "EXPENSE") {
      expenses += amount;
    }
  }

  const outstanding = Math.max(0, income - collected);
  const net = income - expenses;

  return { income, collected, outstanding, expenses, net };
}

async function getLatestInProgressDirectConnectForContractor(
  userId: string | null | undefined
): Promise<{
  requestId: string;
  title: string;
  clientName?: string | null;
} | null> {
  try {
    if (!userId) return null;

    const contractor = await storage.getContractorByUserId(String(userId));
    if (!contractor) return null;

    const { rows } = await pool.query(
      `SELECT
         wr.id AS request_id,
         wr.title AS title,
         COALESCE(
           NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''),
           u.email
         ) AS client_name
       FROM work_request_assignments a
       JOIN work_requests wr ON wr.id = a.work_request_id
       LEFT JOIN users u ON u.id = wr.created_by_user_id
       WHERE a.contractor_id = $1
         AND a.status = 'accepted'
         AND wr.status = 'in_progress'
         AND wr.source = 'direct_connect'
       ORDER BY a.updated_at DESC
       LIMIT 1`,
      [String(contractor.id)]
    );

    if (!rows || rows.length === 0) return null;

    const row: any = rows[0];
    return {
      requestId: String(row.request_id),
      title: String(row.title || "Direct Connect job"),
      clientName: row.client_name ? String(row.client_name) : null,
    };
  } catch (err) {
    console.error(
      "[Scout][DirectConnect] Failed to resolve in-progress Direct Connect job for contractor",
      err
    );
    return null;
  }
}

function getRegionFromState(stateCode: string): string {
  const regions: Record<string, string> = {
    // Northeast
    CT: "Northeast",
    ME: "Northeast",
    MA: "Northeast",
    NH: "Northeast",
    RI: "Northeast",
    VT: "Northeast",
    NJ: "Northeast",
    NY: "Northeast",
    PA: "Northeast",
    // Southeast
    DE: "Southeast",
    FL: "Southeast",
    GA: "Southeast",
    MD: "Southeast",
    NC: "Southeast",
    SC: "Southeast",
    VA: "Southeast",
    WV: "Southeast",
    KY: "Southeast",
    TN: "Southeast",
    AL: "Southeast",
    MS: "Southeast",
    AR: "Southeast",
    LA: "Southeast",
    // Midwest
    IL: "Midwest",
    IN: "Midwest",
    MI: "Midwest",
    OH: "Midwest",
    WI: "Midwest",
    IA: "Midwest",
    KS: "Midwest",
    MN: "Midwest",
    MO: "Midwest",
    NE: "Midwest",
    ND: "Midwest",
    SD: "Midwest",
    // Southwest
    AZ: "Southwest",
    NM: "Southwest",
    OK: "Southwest",
    TX: "Southwest",
    // West
    CO: "West",
    ID: "West",
    MT: "West",
    NV: "West",
    UT: "West",
    WY: "West",
    AK: "West",
    CA: "West",
    HI: "West",
    OR: "West",
    WA: "West",
  };
  return regions[stateCode] || "Unknown";
}

function formatRecentActivityForPrompt(recentActivity: ScoutRequest["recentActivity"]): string {
  if (!recentActivity || recentActivity.length === 0) return "";

  const normalized = recentActivity
    .filter((e) => e && typeof e.type === "string")
    .slice(-10)
    .map((e) => {
      const bits = [
        e.type,
        e.label ? `label=${e.label}` : null,
        e.to ? `to=${e.to}` : null,
        e.path ? `path=${e.path}` : null,
      ].filter(Boolean);
      return `- ${bits.join(" | ")}`;
    });

  if (normalized.length === 0) return "";
  return `RECENT ACTIVITY (this session, client-reported):\n${normalized.join("\n")}`;
}

function buildDealRoomGuidanceFromDocs(
  docs: Array<{ type?: string; status?: string }>,
  userRole: string
): string | null {
  if (!Array.isArray(docs) || docs.length === 0) {
    if (userRole === "contractor") {
      return "No project documents exist yet for this job. Next step: open Finances Jobs and start a material list draft.";
    }
    if (userRole === "homeowner") {
      return "Your contractor hasn’t started any project documents yet. Next step: ask them to start a material list or estimate from Finances Jobs.";
    }
    return "There are no project documents yet. Next step: use Finances Jobs to start a material list or estimate.";
  }

  const latestByType: Record<string, { type?: string; status?: string } | undefined> = {};
  for (const d of docs) {
    if (!d || !d.type) continue;
    latestByType[d.type] = d;
  }

  const material = latestByType["MATERIAL_LIST"];
  const estimate = latestByType["ESTIMATE"];
  const contract = latestByType["CONTRACT"];
  const invoice = latestByType["INVOICE"];
  const receipt = latestByType["RECEIPT"];

  if (receipt) {
    return "This project already has a receipt on record. The document lifecycle is complete; you can still open Finances Jobs to review everything.";
  }

  if (invoice) {
    switch (invoice.status) {
      case "draft":
        return "There is an invoice draft for this project that hasn’t been sent yet. Next step: open Finances Jobs and send the invoice to the homeowner.";
      case "sent":
        return "An invoice has been sent for this project but is not marked paid yet. Next step: once payment is received, mark the invoice paid in Finances so you can issue a receipt.";
      case "paid":
        return "The invoice for this project is marked paid, but there is no receipt yet. Next step: open Finances and issue a receipt for this job.";
      default:
        break;
    }
  }

  if (contract) {
    switch (contract.status) {
      case "draft":
        if (userRole === "contractor") {
          return "There is a contract draft that hasn’t been sent yet. Next step: open Finances and send the contract for signature.";
        }
        return "A contract draft exists for this project but hasn’t been sent yet. Your contractor needs to send it from Finances before anyone can sign.";
      case "sent":
      case "partially_signed":
        if (userRole === "homeowner") {
          return "There is a contract waiting on signatures. Next step: open Finances and sign the contract if you’re ready to move forward.";
        }
        if (userRole === "contractor") {
          return "The contract is out for signatures and not fully signed yet. Next step: ensure both sides sign the contract from Finances.";
        }
        return "This project has a contract that isn’t fully signed yet. Next step: finish signatures in Finances before generating an invoice.";
      case "signed":
        if (!invoice) {
          if (userRole === "contractor") {
            return "The contract for this project is fully signed, but there’s no invoice yet. Next step: open Finances and generate an invoice from the contract.";
          }
          return "The contract for this project is fully signed. Next step: your contractor can generate an invoice from Finances.";
        }
        break;
      default:
        break;
    }
  }

  if (estimate) {
    switch (estimate.status) {
      case "draft":
        if (userRole === "contractor") {
          return "There is an estimate draft for this project that hasn’t been sent yet. Next step: open Finances and send the estimate to the homeowner.";
        }
        return "Your contractor has an estimate in draft form that hasn’t been sent yet. Next step: ask them to send the estimate from Finances so you can review it.";
      case "sent":
        if (userRole === "homeowner") {
          return "An estimate has been sent for this project. Next step: open Finances and approve the estimate if it looks right.";
        }
        if (userRole === "contractor") {
          return "An estimate has been sent and is waiting on homeowner approval. Next step: wait for the homeowner to approve from Finances or follow up with them.";
        }
        return "An estimate has been sent for this project and is waiting on approval. Next step: finalize approval in Finances so a contract can be created.";
      case "approved":
        if (!contract) {
          return "The estimate for this project is approved. Next step: create and send a contract from Finances so both sides can sign.";
        }
        break;
      default:
        break;
    }
  }

  if (material) {
    switch (material.status) {
      case "draft":
        if (userRole === "contractor") {
          return "There is a material list draft for this project. Next step: open Finances and send the material list so the homeowner can review it.";
        }
        return "Your contractor has started a material list but hasn’t sent it yet. Next step: they should send it from Finances so you can confirm selections.";
      case "pending_homeowner":
        if (userRole === "homeowner") {
          return "A material list has been sent and is waiting on your review. Next step: open Finances to review and finalize the material list.";
        }
        return "A material list has been sent to the homeowner and is pending their review. Next step: wait for the homeowner to confirm items in Finances.";
      default:
        break;
    }
  }

  return null;
}

function resolveDealRoomContextFromDocs(
  docs: Array<{ type?: string; status?: string }>,
  userRole: string
): ResolvedContext {
  if (!Array.isArray(docs) || docs.length === 0) {
    const blocking = buildDealRoomGuidanceFromDocs(docs, userRole);
    const allowed: AllowedAction[] = [];
    if (userRole === "contractor") {
      allowed.push("OPEN_DEAL_ROOM", "START_MATERIAL_LIST");
    } else {
      allowed.push("OPEN_DEAL_ROOM");
    }
    return {
      stage: "EMPTY",
      blockingReason: blocking,
      allowedActions: allowed,
      confidence: "medium",
      requiresLLM: true,
    };
  }

  const latestByType: Record<string, { type?: string; status?: string } | undefined> = {};
  for (const d of docs) {
    if (!d || !d.type) continue;
    latestByType[d.type] = d;
  }

  const material = latestByType["MATERIAL_LIST"];
  const estimate = latestByType["ESTIMATE"];
  const contract = latestByType["CONTRACT"];
  const invoice = latestByType["INVOICE"];
  const receipt = latestByType["RECEIPT"];

  let stage: DealRoomStage = "EMPTY";
  const allowedActions: AllowedAction[] = ["OPEN_DEAL_ROOM"];

  if (receipt) {
    stage = "RECEIPT";
  } else if (invoice) {
    stage = "INVOICE";
  } else if (contract) {
    stage = "CONTRACT";
  } else if (estimate) {
    stage = "ESTIMATE";
  } else if (material) {
    stage = "MATERIALS";
  }

  // Allowed actions mirror the frontend workflow state machine at a high level.
  if (!material && userRole === "contractor") {
    allowedActions.push("START_MATERIAL_LIST");
  }

  if (material && material.status === "draft" && userRole === "contractor") {
    allowedActions.push("SEND_MATERIAL_LIST");
  }

  if (estimate) {
    if (estimate.status === "draft" && userRole === "contractor") {
      allowedActions.push("SEND_ESTIMATE");
    }
    if (estimate.status === "sent" && userRole === "homeowner") {
      allowedActions.push("APPROVE_ESTIMATE");
    }
  }

  if (contract) {
    if (contract.status === "draft" && userRole === "contractor") {
      allowedActions.push("SEND_CONTRACT");
    }
    if (
      (contract.status === "sent" || contract.status === "partially_signed") &&
      (userRole === "homeowner" || userRole === "contractor")
    ) {
      allowedActions.push("SIGN_CONTRACT");
    }
    if (!invoice && contract.status === "signed" && userRole === "contractor") {
      allowedActions.push("GENERATE_INVOICE");
    }
  }

  if (invoice) {
    if (invoice.status === "draft" && userRole === "contractor") {
      allowedActions.push("SEND_INVOICE");
    }
    if ((invoice.status === "sent" || invoice.status === "approved") && userRole === "contractor") {
      allowedActions.push("MARK_INVOICE_PAID");
    }
    if (invoice.status === "paid" && !receipt && userRole === "contractor") {
      allowedActions.push("ISSUE_RECEIPT");
    }
  }

  const blockingReason = buildDealRoomGuidanceFromDocs(docs, userRole);
  return {
    stage,
    blockingReason: blockingReason || null,
    allowedActions,
    confidence: "high",
    requiresLLM: true,
  };
}

// (moved to services/regionResolver.ts)

/**
 * POST /api/scout
 * Main endpoint for AI Scout interactions with 4-layer knowledge resolution
 * Includes role-based access control and action execution
 */
router.post("/override", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { scope, contextType, contextId } = (req.body ?? {}) as {
      scope?: string;
      contextType?: string;
      contextId?: string;
    };

    const normalizedScope = typeof scope === "string" && scope.trim() ? scope.trim() : "global";
    const normalizedContext =
      typeof contextType === "string" && ALLOWED_OUTCOME_CONTEXTS.has(contextType)
        ? contextType
        : "general";

    const outcomeEvent = {
      userId: String(userId),
      contextType: normalizedContext as any,
      contextId: contextId ? String(contextId) : null,
      scope: normalizedScope,
      action: "ignored_advice" as const,
    } satisfies Parameters<typeof recordOutcomeEvent>[0];

    await recordOutcomeEvent(outcomeEvent);
    await updateUserConfidenceStateFromOutcome(String(userId), outcomeEvent, normalizedScope);

    return res.json({ status: "ok" });
  } catch (err) {
    console.error("[Scout] Failed to record override", err);
    return res.status(500).json({ message: "Failed to record override" });
  }
});

router.post("/", ...scoutRequestLimiters, async (req: Request, res: Response) => {
  recordQuery();
  const baseJson = res.json.bind(res);
  // Enforce canonical Scout response contract for this endpoint while leaving
  // non-Scout payloads (error/admin shapes) untouched.
  (res as any).json = (payload: unknown) =>
    baseJson(
      finalizeScoutResponse(payload, {
        requestId: ((req as any)?.requestId as string | undefined) || null,
        requestMessage:
          typeof (req.body as { message?: unknown } | undefined)?.message === "string"
            ? ((req.body as { message?: string }).message as string)
            : null,
        workingMemoryUpdate:
          ((res.locals as any)?.scoutWorkingMemoryUpdate as
            | Record<string, unknown>
            | undefined) ?? null,
      })
    );

  const requestUser = (req as any)?.user || {};
  const userAgent = String(req.headers["user-agent"] || "");
  const isTestRun =
    String(req.headers["x-test-run"] || "").toLowerCase() === "true" ||
    /scoutbot/i.test(userAgent) ||
    Boolean((requestUser as any)?.isTestAccount);
  let scoutInteractionLog: InsertScoutInteraction | null = null;
  const scoutTurnTelemetry: {
    provider: string;
    intent: string;
    sourceUsed: string;
    failureClass: ScoutTurnFailureClass;
    fallbackUsed: boolean;
    degradationReason?: ScoutDegradationReason;
  } = {
    provider: "unknown",
    intent: "unknown",
    sourceUsed: "unknown",
    failureClass: "none",
    fallbackUsed: false,
  };
  try {
    const rawBody = (req.body ?? {}) as Partial<ScoutRequest>;
    const requestBounds = validateScoutRequestBounds(rawBody);
    if (!requestBounds.ok) {
      scoutTurnTelemetry.provider = "request_guard";
      scoutTurnTelemetry.sourceUsed = "scout_request_bounds";
      scoutTurnTelemetry.failureClass = "system_error";
      scoutTurnTelemetry.fallbackUsed = false;
      return res
        .status(requestBounds.status)
        .json(buildScoutRequestRejectionResponse(requestBounds));
    }
    const message = typeof rawBody.message === "string" ? rawBody.message : "";
    const launchContext = normalizeScoutLaunchContext(rawBody.launchContext);
    const boundedHistory = buildBoundedScoutHistory(rawBody.history, message);
    const memoryUserIdCandidate =
      (requestUser as any)?.id ?? (requestUser as any)?.claims?.sub ?? null;
    const memoryUserId =
      typeof memoryUserIdCandidate === "string" && memoryUserIdCandidate.trim()
        ? memoryUserIdCandidate.trim()
        : null;
    const explicitMemoryUpdate = extractExplicitScoutMemoryUpdate(message);
    if (memoryUserId && explicitMemoryUpdate) {
      try {
        await ScoutMemoryService.storeExplicitReasoningMemory(memoryUserId, explicitMemoryUpdate);
        (res.locals as any).scoutWorkingMemoryUpdate = {
          applied: true,
          kind: explicitMemoryUpdate.kind,
          source: "explicit_user_message",
          user_confirmed: true,
          source_message_hash: explicitMemoryUpdate.sourceMessageHash,
        };
      } catch (error) {
        console.error("[Scout Memory] Failed to persist explicit user memory:", error);
        (res.locals as any).scoutWorkingMemoryUpdate = {
          applied: false,
          kind: explicitMemoryUpdate.kind,
          source: "explicit_user_message",
          user_confirmed: true,
          failure: "memory_store_unavailable",
        };
      }
    }
    const durableMemoryContext = memoryUserId
      ? await ScoutMemoryService.getReasoningMemoryContext(memoryUserId, {
          maxEntries: 12,
          maxChars: 6_000,
        })
      : null;

    // ===== SCOUT 2.0 OPTIMIZATION: Check cache and FAQ before processing =====
    const optimizationUserId = memoryUserId;
    if (optimizationUserId && message) {
      // Import optimization services
      const { generateQueryHash, checkFaqMatch, routeQuery } =
        await import("../services/scoutOptimizationEngine");

      const cacheContextKey = [
        buildScoutLaunchContextCacheKey(launchContext),
        `thread:${boundedHistory.digest}`,
        `memory:${durableMemoryContext?.revision || "none"}`,
      ]
        .filter(Boolean)
        .join("|");
      const queryHash = generateQueryHash(message, {
        county: rawBody.countyCode as string | undefined,
        state: rawBody.stateCode as string | undefined,
        trade: launchContext?.trade,
        contextKey: cacheContextKey,
      });

      // 1. Check if response is cached
      const cachedResponse = await ScoutMemoryService.getCachedResponse(
        optimizationUserId,
        queryHash
      );
      if (cachedResponse) {
        scoutTurnTelemetry.provider = "cache";
        scoutTurnTelemetry.sourceUsed = "cached_response";
        return res.json({
          ...cachedResponse,
          _optimization: { source: "cache", queryHash },
        });
      }

      // 2. Check if it's an FAQ
      const faqMatch = checkFaqMatch(message);
      if (faqMatch && faqMatch.cachedAnswer) {
        scoutTurnTelemetry.provider = "faq";
        scoutTurnTelemetry.sourceUsed = "faq";
        const faqResponse = {
          message: faqMatch.cachedAnswer,
          confidence: faqMatch.confidence,
          _optimization: { source: "faq", reason: faqMatch.reason },
        };
        // Cache the FAQ answer for future use
        await ScoutMemoryService.cacheScoutResponse(
          optimizationUserId,
          queryHash,
          faqResponse,
          1440
        ); // 24h TTL
        return res.json(faqResponse);
      }

      // 3. Route the query to determine processing path
      const route = routeQuery({
        query: message,
        userId: optimizationUserId,
        isAuthenticated: Boolean(optimizationUserId),
        county: rawBody.countyCode as string | undefined,
        state: rawBody.stateCode as string | undefined,
      });

      // Store routing decision for later use
      (req as any)._scoutOptimization = {
        route,
        queryHash,
        skipLlm: route.skipLlm,
      };
    }
    // ===== END SCOUT 2.0 OPTIMIZATION =====

    const normalizedRequest = normalizeScoutRequest({
      message: typeof rawBody.message === "string" ? rawBody.message : "",
      userId: (requestUser as any)?.id,
      isAuthenticated: Boolean((requestUser as any)?.id),
      userRole:
        typeof (requestUser as any)?.role === "string" ? (requestUser as any).role : undefined,
      countyCode: typeof rawBody.countyCode === "string" ? rawBody.countyCode : undefined,
      stateCode: typeof rawBody.stateCode === "string" ? rawBody.stateCode : undefined,
      countyFips: typeof rawBody.countyHint === "string" ? rawBody.countyHint : undefined,
      history: Array.isArray(rawBody.history) ? (rawBody.history as any[]) : [],
      intent: typeof rawBody.intent === "string" ? rawBody.intent : undefined,
      launchContext,
      sessionId: typeof rawBody.sessionId === "string" ? rawBody.sessionId : undefined,
    });
    const scaffoldDecision = runScoutDecisionPipeline(normalizedRequest);

    const normalizedMessage = typeof message === "string" ? message : "";
    scoutTurnTelemetry.intent =
      normalizeScoutIntent(rawBody.intent, normalizedMessage) || "unknown";
    const countyCandidate =
      (rawBody.countyHint as string | undefined) ||
      (rawBody.countyCode as string | undefined) ||
      (requestUser as any)?.countyFips ||
      (requestUser as any)?.county_fips;
    const normalizedFips =
      typeof countyCandidate === "string" && countyCandidate.trim().length >= 5
        ? countyCandidate.trim().slice(0, 5)
        : undefined;

    scoutInteractionLog = {
      userRole: normalizeScoutRole((requestUser as any)?.role),
      countyFips: normalizedFips,
      intent: normalizeScoutIntent(rawBody.intent, normalizedMessage),
      scoutConfidence: 0,
      // A successful HTTP response proves only that Scout answered or handed
      // off a next step. It is not verified task completion.
      outcome: "handed_off",
      failureReason: null,
      scoutMessageHash: hashMessageForScout(normalizedMessage),
    } as InsertScoutInteraction;

    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role || "user";
    const normalizedStateCode =
      typeof rawBody.stateCode === "string" && rawBody.stateCode.trim().length > 0
        ? rawBody.stateCode.trim().toUpperCase()
        : undefined;
    const syncObjectiveBestEffort = async (scoutResult?: { intent?: string | null }) => {
      if (process.env.OBJECTIVES_ENABLED !== "true") return;
      if (!userId || !normalizedMessage.trim()) return;
      const inferredIntent = normalizeScoutIntent(
        typeof scoutResult?.intent === "string" ? scoutResult.intent : rawBody.intent,
        normalizedMessage
      );
      try {
        const syncResult = await syncObjectiveFromScoutMessage({
          userId: String(userId),
          messageText: normalizedMessage,
          userRole,
          scoutIntent: inferredIntent,
          countyFips: normalizedFips,
          stateCode: normalizedStateCode,
        });
        if (syncResult?.rateLimitedReuse) {
          console.info("[Scout Objectives] Rate cap reuse", {
            userId: String(userId),
            intentClass: syncResult.intentClass,
            confidence: syncResult.confidence,
            topicShift: syncResult.wasTopicShift,
          });
        }
      } catch (e) {
        console.error("Objective sync failed", e);
        console.error("[Scout Objectives] Sync telemetry", {
          userId: String(userId),
          intentClass: null,
          confidence: null,
          topicShift: false,
          scoutIntent: inferredIntent,
        });
      }
    };

    if (!isTestRun) {
      res.on("finish", async () => {
        if (!scoutInteractionLog) return;
        if (!scoutInteractionLog.outcome) {
          scoutInteractionLog.outcome = res.statusCode >= 400 ? "blocked" : "handed_off";
        }
        if (res.statusCode >= 400 && !scoutInteractionLog.failureReason) {
          if (res.statusCode === 400) {
            scoutInteractionLog.failureReason = "missing_data";
          } else if (res.statusCode === 403) {
            scoutInteractionLog.failureReason = "permission";
          } else {
            scoutInteractionLog.failureReason = "ui_dead_end";
          }
        }

        if (
          scoutInteractionLog.outcome === "blocked" ||
          scoutInteractionLog.outcome === "abandoned"
        ) {
          scoutInteractionLog.failureReason = ensureFailureReason(
            scoutInteractionLog.failureReason || (res.statusCode >= 400 ? "ui_dead_end" : null)
          );
        } else {
          scoutInteractionLog.failureReason = null;
        }

        try {
          await recordScoutInteraction(scoutInteractionLog);

          // Track completed Scout actions for Preferred Source Prompt eligibility
          if (scoutInteractionLog.outcome === "completed" && (requestUser as any)?.id) {
            await logCompletedAction({
              userId: (requestUser as any).id,
              actionType: "scout_flow_completed",
              source: "scout",
            }).catch((err) => {
              console.error("[Scout][PreferredSource] failed to log completed action", err);
            });
          }

          const telemetryFailureClass = deriveScoutTurnFailureClass(
            res.statusCode,
            scoutInteractionLog,
            scoutTurnTelemetry.failureClass
          );
          await storage.logEvent("scout_turn_telemetry", {
            userId: (requestUser as any)?.id || null,
            requestId: (req as any)?.requestId || null,
            statusCode: res.statusCode,
            provider: scoutTurnTelemetry.provider,
            sourceUsed: scoutTurnTelemetry.sourceUsed,
            intent: scoutTurnTelemetry.intent,
            outcome: scoutInteractionLog.outcome,
            failureReason: scoutInteractionLog.failureReason || null,
            failureClass: telemetryFailureClass,
            fallbackUsed: Boolean(scoutTurnTelemetry.fallbackUsed),
            degradationReason: scoutTurnTelemetry.degradationReason || null,
          });
        } catch (err) {
          console.error("[Scout][MissionControl] failed to record scout interaction", err);
        }
      });
    }

    if (scaffoldDecision.type === "blocked" && scaffoldDecision.reason === "missing_message") {
      if (scoutInteractionLog) {
        scoutInteractionLog.outcome = "blocked";
        scoutInteractionLog.failureReason = "missing_data";
      }
      scoutTurnTelemetry.provider = "none";
      scoutTurnTelemetry.sourceUsed = "decision_pipeline";
      scoutTurnTelemetry.failureClass = "input_error";
      return res.status(400).json({
        error: "Invalid Scout request",
        details: "Missing or invalid 'message' in request body",
      });
    }

    if (isLiveReadinessQuestion(normalizedMessage)) {
      const userId = (requestUser as any)?.id || (requestUser as any)?.claims?.sub;
      const directConnectItems = userId ? await loadLiveReadinessDirectConnectItems(userId) : [];
      const readiness = resolveLiveReadiness({
        user: requestUser as any,
        directConnectItems,
      });
      const response = buildScoutLiveReadinessResponse(readiness);

      await syncObjectiveBestEffort({ intent: "live_readiness_next_step" });
      scoutTurnTelemetry.provider = "governor";
      scoutTurnTelemetry.sourceUsed = "live_readiness_resolver";
      scoutTurnTelemetry.fallbackUsed = false;
      return res.json({
        ...response,
        knowledge: {
          layer: 0,
          sources: ["Live readiness resolver", "Direct Connect readiness projection"],
          confidence: "high",
        },
        llmProvider: "governor",
        promptVersion: loadSystemPrompt().version,
        timestamp: new Date().toISOString(),
      });
    }

    const profileUpdateDraft = inferScoutProfileUpdateDraft(normalizedMessage);
    if (profileUpdateDraft) {
      const userId = (requestUser as any)?.id || (requestUser as any)?.claims?.sub;
      if (!userId) {
        const gated = buildAuthRequiredScoutResponse({
          type: "blocked",
          reason: "auth_required",
          requiresAuth: true,
          metadata: { redirect: "/pre-scout-setup?mode=create" },
        }) as ScoutResponse;

        await syncObjectiveBestEffort({ intent: "auth_required" });
        scoutTurnTelemetry.provider = "governor";
        scoutTurnTelemetry.sourceUsed = "decision_pipeline_profile_update_auth";
        scoutTurnTelemetry.failureClass = "auth_required";
        return res.json({
          ...gated,
          knowledge: {
            layer: 0,
            sources: ["Decision pipeline profile update auth preflight"],
            confidence: "high",
          },
          llmProvider: "governor",
          promptVersion: loadSystemPrompt().version,
          timestamp: new Date().toISOString(),
        });
      }

      const response = buildScoutProfileUpdateResponse(profileUpdateDraft);
      await syncObjectiveBestEffort({ intent: "profile_update" });
      scoutTurnTelemetry.provider = "governor";
      scoutTurnTelemetry.sourceUsed = "decision_pipeline_profile_update";
      scoutTurnTelemetry.fallbackUsed = false;
      return res.json({
        ...response,
        knowledge: {
          layer: 0,
          sources: ["Decision pipeline profile update assistant"],
          confidence: response.metadata.confidenceBand || "medium",
        },
        llmProvider: "governor",
        promptVersion: loadSystemPrompt().version,
        timestamp: new Date().toISOString(),
      });
    }

    const {
      history = [],
      countyCode,
      stateCode,
      intent,
      roles = [],
      recentActivity = [],
      shownAdIds = [],
      onboarding,
      sessionId,
      onboardingAnswer,
      onboardingQuestionKey,
    } = rawBody as ScoutRequest;

    // Code-level default: canonical Scout pipeline. Enhanced v4 stays available by opt-in.
    // Opt in with SCOUT_DEFAULT_ENGINE=v4 or enhanced_v4, plus SCOUT_ENHANCED_ENABLED=true.
    const defaultEngine =
      typeof process.env.SCOUT_DEFAULT_ENGINE === "string" &&
      process.env.SCOUT_DEFAULT_ENGINE.trim().length > 0
        ? process.env.SCOUT_DEFAULT_ENGINE.trim().toLowerCase()
        : "classic";
    const isEnhancedEngine =
      defaultEngine === "v4" || defaultEngine === "enhanced_v4" || defaultEngine === "enhanced-v4";
    const enhancedFlagRaw =
      typeof process.env.SCOUT_ENHANCED_ENABLED === "string"
        ? process.env.SCOUT_ENHANCED_ENABLED.trim().toLowerCase()
        : "";
    const scoutEnhancedEnabled =
      process.env.SCOUT_ENHANCED_ENABLED === undefined
        ? false
        : enhancedFlagRaw === "true" || enhancedFlagRaw === "1" || enhancedFlagRaw === "yes";

    const wantsEnhancedV4 = scoutEnhancedEnabled && isEnhancedEngine;

    let sourceAudit: {
      sourceUsed: string;
      attemptedSource?: string;
      fallbackUsed: boolean;
      degradationReason?: ScoutDegradationReason;
      confidenceBand: SourceConfidenceBand;
    } = {
      sourceUsed: "classic_knowledge_pipeline",
      fallbackUsed: false,
      confidenceBand: "unknown",
    };

    if (wantsEnhancedV4) {
      const portRaw = Number(process.env.PORT || 10000);
      const port = Number.isFinite(portRaw) ? portRaw : 10000;
      const url = `http://127.0.0.1:${port}/api/scout-enhanced-v4/message-v4`;

      try {
        const forwardedHeaders: Record<string, string> = {
          "Content-Type": "application/json",
        };
        const cookie = typeof req.headers.cookie === "string" ? req.headers.cookie : "";
        if (cookie) forwardedHeaders.Cookie = cookie;

        const upstream = await fetch(url, {
          method: "POST",
          headers: forwardedHeaders,
          body: JSON.stringify({
            message,
            conversationHistory: Array.isArray(history) ? history : [],
          }),
        });

        const text = await upstream.text();
        let json: any = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }

        if (!upstream.ok) {
          console.warn("[Scout] Enhanced v4 proxy failed", {
            status: upstream.status,
            body: text?.slice?.(0, 500) ?? "",
          });
        } else {
          const enhancedDecision = assessEnhancedV4ProxyResponse(json);

          if (scoutInteractionLog) {
            scoutInteractionLog.scoutConfidence = confidenceToScore(enhancedDecision.rawConfidence);
          }

          if (!enhancedDecision.useEnhancedResponse) {
            sourceAudit = enhancedDecision.sourceAudit;
            console.warn("[Scout] Enhanced v4 confidence below gate, falling back to classic", {
              confidence: enhancedDecision.sourceAudit.confidenceBand,
            });
          } else {
            sourceAudit = enhancedDecision.sourceAudit;
            scoutTurnTelemetry.provider = "enhanced_v4";
            scoutTurnTelemetry.sourceUsed = "enhanced_v4";
            scoutTurnTelemetry.fallbackUsed = false;

            return res.json({
              message: enhancedDecision.message,
              actions: [],
              actionResults: [],
              metadata: {
                sourceUsed: "enhanced_v4",
                fallbackUsed: false,
                confidenceBand: enhancedDecision.sourceAudit.confidenceBand,
              },
              knowledge: {
                layer: 1,
                sources: ["Scout Enhanced v4 (Agent Council)"],
                confidence: "high",
              },
              llmProvider: "enhanced_v4",
              promptVersion: loadSystemPrompt().version,
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (error) {
        sourceAudit = {
          sourceUsed: "classic_knowledge_pipeline",
          attemptedSource: "enhanced_v4",
          fallbackUsed: true,
          degradationReason: "enhanced_proxy_error",
          confidenceBand: "unknown",
        };
        console.warn("[Scout] Enhanced v4 proxy error, falling back to classic:", error);
      }
    }

    // D2-1: Detect and initialize onboarding session (DB-backed)
    const clientSessionId = sessionId || `${userId || "guest"}_${Date.now()}`;
    let onboardingSession: OnboardingSession | undefined =
      await getOnboardingSession(clientSessionId);

    if (onboarding && !onboardingSession) {
      // D2-1: Initialize onboarding session on first request
      onboardingSession = await initializeOnboardingSession(clientSessionId, userId);
    }

    // D2-2: Process onboarding answer if provided
    if (onboardingSession && onboardingAnswer && onboardingQuestionKey) {
      if (onboardingAnswer === "skip") {
        recordSkip(onboardingSession, onboardingQuestionKey);
      } else {
        recordAnswer(onboardingSession, onboardingQuestionKey, onboardingAnswer);
      }
      // Persist the updated session immediately after recording the answer
      await saveOnboardingSession(clientSessionId, onboardingSession);
    }

    // D2-4: Check auto-expiration conditions
    if (onboardingSession && onboardingSession.isOnboarding) {
      const expirationReason = checkAutoExpiration(onboardingSession);
      if (expirationReason) {
        expireOnboarding(onboardingSession, expirationReason);
        await saveOnboardingSession(clientSessionId, onboardingSession);
      }
    }

    // SPECIAL HANDLING: Detect intro/overview questions and use comprehensive synthesis
    if (
      isIntroQuestion(message) &&
      !hasExplicitExternalScoutReference(message) &&
      !isClearProviderServiceIntent(message)
    ) {
      try {
        const synthesisResponse = await generateSmartSynthesis(message, geminiClient, llmProviders);
        await syncObjectiveBestEffort({ intent });
        scoutTurnTelemetry.provider = synthesisResponse.provider;
        scoutTurnTelemetry.sourceUsed = "intro_synthesis";
        scoutTurnTelemetry.fallbackUsed = synthesisResponse.provider === "fallback";
        if (synthesisResponse.provider === "fallback") {
          scoutTurnTelemetry.failureClass = "provider_fallback";
        }
        return res.json({
          message: synthesisResponse.message,
          actions: [],
          actionResults: [],
          metadata: {
            sourceUsed: "intro_synthesis",
            fallbackUsed: synthesisResponse.provider === "fallback",
            degradationReason: synthesisResponse.degradationReason,
          },
          knowledge: {
            layer: 1,
            sources: ["Comprehensive Knowledge Base (All Documents)"],
            confidence: "high",
          },
          llmProvider: synthesisResponse.provider,
          promptVersion: loadSystemPrompt().version,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[Scout] Intro synthesis failed:", error);
        // Fall through to normal processing if synthesis fails
      }
    }

    const llmAvailable = llmProviders.some((p) => p.isConfigured());

    // Extract user information from session/request
    const userCounty = (req as any).user?.county || countyCode;
    const userState = (req as any).user?.state || stateCode;

    // Build user object for action execution
    const user: User | undefined = userId
      ? {
          id: userId,
          role: userRole as User["role"],
          county: userCounty,
          state: userState,
        }
      : undefined;

    // Pull user's active profile to enable community-vault actions from chat.
    const userRecord = userId ? await storage.getUser(userId) : undefined;
    const activeProfileId = (userRecord as any)?.activeProfileId
      ? String((userRecord as any).activeProfileId)
      : undefined;

    const wantsWelcomeDraft = isWelcomeIntroRequest(message);
    const wantsExchangeListingDraft = isExchangeListingRequest(message);

    // Load system prompt (with version) once so promptVersion is available
    const { content: systemPrompt, version: promptVersion } = loadSystemPrompt();

    // Guest browsing must stay open for contractor discovery. Only gate at contact.
    if (!userId && isGuestDirectoryBrowsingIntent(message)) {
      const homeProjectRoute = maybeHandleHomeProjectRouting({
        message,
        countyCode,
        stateCode,
      });

      if (homeProjectRoute) {
        const aiResponse: ScoutResponse = {
          message: prependLocalIntro(homeProjectRoute.message, {
            countyCode,
            stateCode,
            historyLength: history.length,
            communityPostCount: 0,
            contractorCount: 0,
          }),
          suggestedActions: homeProjectRoute.suggestedActions,
          actions: shapeActionsByConfidence(homeProjectRoute.actions as any, {
            confidence: "high",
            hasLocality: Boolean(countyCode || stateCode),
            communityPrefill: buildCommunityPrefill(message, countyCode, stateCode),
          }),
          sponsored: null,
          metadata: {
            intent: homeProjectRoute.intent,
            sourceUsed: "guest_directory_preflight",
            scaffoldDecision: "deterministic_route",
            behaviorKey: "home_project_routing",
            fallbackUsed: false,
            decision: "Guest contractor browsing stays open; contact remains gated.",
          },
        };

        await syncObjectiveBestEffort({ intent: homeProjectRoute.intent });
        scoutTurnTelemetry.provider = "deterministic";
        scoutTurnTelemetry.sourceUsed = "guest_directory_preflight";
        scoutTurnTelemetry.intent = homeProjectRoute.intent;
        scoutTurnTelemetry.fallbackUsed = false;

        return res.json({
          ...aiResponse,
          knowledge: {
            layer: 0,
            sources: ["Guest directory preflight"],
            confidence: "high",
          },
          llmProvider: "deterministic",
          promptVersion,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // ==========================================================================
    // GOVERNOR MODE: Situation-driven intelligence
    // ==========================================================================
    // Scout assesses the situation and decides whether to comply, defer,
    // redirect, or block BEFORE generating a response.
    const governorDecision = await govern({
      message,
      user,
      history,
      recentActivity: recentActivity.map((a) => ({ type: a.type, timestamp: a.ts })),
      countyCode,
      stateCode,
    });

    if (scoutInteractionLog) {
      scoutInteractionLog.scoutConfidence = confidenceToScore(
        (governorDecision as any)?.confidence
      );
    }

    // Log governor decision for development
    if (process.env.NODE_ENV === "development") {
      console.log("[Scout Governor]", {
        action: governorDecision.intervention.action,
        role: governorDecision.intervention.role,
        reasoning: governorDecision.intervention.reasoning,
        requiresLLM: governorDecision.requiresLLM,
        risks: governorDecision.situation.risks.map((r) => ({
          type: r.type,
          severity: r.severity,
          description: r.description,
        })),
        unknowns: governorDecision.situation.unknowns,
      });
    }

    // If governor decided to DEFER, REDIRECT, or BLOCK, return immediately
    // with structured intervention (no LLM needed for these)
    if (["DEFER", "REDIRECT", "BLOCK"].includes(governorDecision.intervention.action)) {
      const intervention = governorDecision.intervention;
      if (scoutInteractionLog) {
        if (intervention.action === "BLOCK") {
          scoutInteractionLog.outcome = "blocked";
          scoutInteractionLog.failureReason = ensureFailureReason(
            scoutInteractionLog.failureReason || "permission"
          );
        } else if (intervention.action === "REDIRECT") {
          scoutInteractionLog.outcome = "handed_off";
          scoutInteractionLog.failureReason = null;
        } else {
          scoutInteractionLog.outcome = "blocked";
          const missingDataDetected =
            Boolean(intervention.reasoning?.toLowerCase().includes("missing")) ||
            (governorDecision.situation?.unknowns?.length ?? 0) > 0;
          scoutInteractionLog.failureReason = ensureFailureReason(
            scoutInteractionLog.failureReason ||
              (missingDataDetected ? "missing_data" : "unclear_copy")
          );
        }
      }
      let fullMessage = intervention.userMessage;

      // Add next steps if present
      if (intervention.nextSteps && intervention.nextSteps.length > 0) {
        fullMessage +=
          "\n\n" +
          intervention.nextSteps
            .filter((s) => s.userFacing)
            .map((s, i) => `${i + 1}. ${s.action}`)
            .join("\n");
      }

      // Build suggested actions from next steps
      const suggestedActions =
        intervention.nextSteps
          ?.filter((s) => s.userFacing)
          .map((s) => s.action)
          .slice(0, 3) || [];

      const aiResponse: ScoutResponse = {
        message: trimResponseToScreenFit(fullMessage),
        suggestedActions,
        actions: shapeActionsByConfidence([], {
          confidence: normalizeConfidenceLabel(governorDecision.confidence),
          hasLocality: Boolean(countyCode || stateCode),
          communityPrefill: buildCommunityPrefill(message, countyCode, stateCode),
        }),
        sponsored: null,
        overrideOption: intervention.overrideOption
          ? {
              ...intervention.overrideOption,
              contextType: "general",
              contextId: governorDecision.outcomeGraph?.situationId ?? null,
            }
          : undefined,
        metadata: {
          governorAction: intervention.action,
          governorRole: intervention.role,
          governorReasoning: intervention.reasoning,
          situation: {
            goal: governorDecision.situation.goal,
            risks: governorDecision.situation.risks,
            unknowns: governorDecision.situation.unknowns,
            confidence: governorDecision.situation.confidence,
          },
          outcomeGraph: governorDecision.outcomeGraph,
        },
      };

      await syncObjectiveBestEffort({ intent });
      scoutTurnTelemetry.provider = "governor";
      scoutTurnTelemetry.sourceUsed = "governor_intervention";
      scoutTurnTelemetry.failureClass =
        intervention.action === "BLOCK"
          ? "governor_blocked"
          : intervention.action === "REDIRECT"
            ? "governor_redirect"
            : scoutTurnTelemetry.failureClass;
      return res.json({
        ...aiResponse,
        knowledge: {
          layer: 0,
          sources: ["Governor Decision Engine"],
          confidence: governorDecision.confidence,
        },
        llmProvider: "governor",
        promptVersion,
        timestamp: new Date().toISOString(),
      });
    }

    // Decision pipeline-driven auth preflight for business actions.
    if (scaffoldDecision.type === "blocked" && scaffoldDecision.reason === "auth_required") {
      const gated = buildAuthRequiredScoutResponse(scaffoldDecision) as ScoutResponse;

      await syncObjectiveBestEffort({ intent: "auth_required" });
      scoutTurnTelemetry.provider = "governor";
      scoutTurnTelemetry.sourceUsed = "decision_pipeline_auth";
      scoutTurnTelemetry.failureClass = "auth_required";
      return res.json({
        ...gated,
        knowledge: {
          layer: 0,
          sources: ["Decision pipeline auth preflight"],
          confidence: "high",
        },
        llmProvider: "governor",
        promptVersion,
        timestamp: new Date().toISOString(),
      });
    }

    if (
      scaffoldDecision.type === "deterministic_route" &&
      scaffoldDecision.behaviorKey === "explicit_navigation"
    ) {
      const routePath =
        typeof scaffoldDecision.metadata?.route === "string"
          ? scaffoldDecision.metadata.route
          : "/direct-connect";
      const routeLabel =
        typeof scaffoldDecision.metadata?.label === "string"
          ? scaffoldDecision.metadata.label
          : "Open";

      const aiResponse: ScoutResponse = {
        message: trimResponseToScreenFit("Understood. I can take you there now."),
        suggestedActions: [routeLabel],
        actions: [
          {
            type: "NAVIGATE",
            label: routeLabel,
            to: routePath,
            path: routePath,
            primary: true as any,
          },
        ],
        sponsored: null,
        metadata: {
          scaffoldDecision: scaffoldDecision.type,
          behaviorKey: scaffoldDecision.behaviorKey,
          sourceUsed: "decision_pipeline_explicit_navigation",
        },
      };

      await syncObjectiveBestEffort({ intent });
      scoutTurnTelemetry.provider = "deterministic";
      scoutTurnTelemetry.sourceUsed = "decision_pipeline_explicit_navigation";
      scoutTurnTelemetry.fallbackUsed = false;
      return res.json({
        ...aiResponse,
        knowledge: {
          layer: 0,
          sources: ["Decision pipeline explicit navigation"],
          confidence: "high",
        },
        llmProvider: "deterministic",
        promptVersion,
        timestamp: new Date().toISOString(),
      });
    }

    if (
      scaffoldDecision.type === "deterministic_route" &&
      scaffoldDecision.behaviorKey === "home_project_routing"
    ) {
      const homeProjectRoute = maybeHandleHomeProjectRouting({
        message,
        countyCode,
        stateCode,
      });

      if (homeProjectRoute) {
        const aiResponse: ScoutResponse = {
          message: prependLocalIntro(homeProjectRoute.message, {
            countyCode,
            stateCode,
            historyLength: history.length,
            communityPostCount: 0,
            contractorCount: 0,
          }),
          suggestedActions: homeProjectRoute.suggestedActions,
          actions: shapeActionsByConfidence(homeProjectRoute.actions as any, {
            confidence: normalizeConfidenceLabel(governorDecision.confidence),
            hasLocality: Boolean(countyCode || stateCode),
            communityPrefill: buildCommunityPrefill(message, countyCode, stateCode),
          }),
          sponsored: null,
          metadata: {
            intent: homeProjectRoute.intent,
            sourceUsed: "decision_pipeline_home_project_router",
            scaffoldDecision: scaffoldDecision.type,
            behaviorKey: scaffoldDecision.behaviorKey,
            fallbackUsed: false,
            decision: homeProjectRoute.metadata.decision,
          },
        };

        await syncObjectiveBestEffort({ intent: homeProjectRoute.intent });
        scoutTurnTelemetry.provider = "deterministic";
        scoutTurnTelemetry.sourceUsed = "decision_pipeline_home_project_router";
        scoutTurnTelemetry.intent = homeProjectRoute.intent;
        scoutTurnTelemetry.fallbackUsed = false;
        return res.json({
          ...aiResponse,
          knowledge: {
            layer: 0,
            sources: ["Decision pipeline home project routing"],
            confidence: "high",
          },
          llmProvider: "deterministic",
          promptVersion,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (scaffoldDecision.type === "server_behavior_handler") {
      const handler = buildDecisionPipelineBehaviorResponse({
        behaviorKey: scaffoldDecision.behaviorKey || "",
        message,
        countyCode,
        stateCode,
      });
      if (handler) {
        const aiResponse: ScoutResponse = {
          message: trimResponseToScreenFit(handler.message),
          suggestedActions: handler.suggestedActions,
          actions: handler.actions as any,
          sponsored: null,
          metadata: {
            scaffoldDecision: scaffoldDecision.type,
            behaviorKey: scaffoldDecision.behaviorKey,
            ...(handler.metadata || {}),
          },
        };

        await syncObjectiveBestEffort({ intent });
        scoutTurnTelemetry.provider = "deterministic";
        scoutTurnTelemetry.sourceUsed = "decision_pipeline_behavior_handler";
        scoutTurnTelemetry.fallbackUsed = false;
        return res.json({
          ...aiResponse,
          knowledge: {
            layer: 0,
            sources: ["Decision pipeline behavior handler"],
            confidence: "high",
          },
          llmProvider: "deterministic",
          promptVersion,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // BUILD CAPABILITY SIGNALS: Multi-source inference from profile, behavior, context, and message
    // This enables Scout to personalize responses without explicit role-based gating
    const capabilitySignals = buildCapabilitySignals({
      user: {
        roles: (userRecord as any)?.roles || [],
        tradeTags: (userRecord as any)?.tradeTags || [],
      },
      message,
      currentPage: (req as any).route?.path,
      recentActions: recentActivity.map((a) => a.type).filter(Boolean),
    });
    const capabilities = createCapabilityChecker(capabilitySignals);

    // Log inferred capabilities for debugging (dev only)
    if (process.env.NODE_ENV === "development") {
      console.log("[Scout] Inferred capabilities:", {
        userId,
        userRole,
        profileRoles: (userRecord as any)?.roles || [],
        profileTags: (userRecord as any)?.tradeTags || [],
        messageKeywords: capabilitySignals.messageSignals,
        capabilities: capabilities.getAll(),
      });
    }

    // LAYER RESOLUTION: Use knowledge service 4-layer system
    const knowledgeRequest = {
      message,
      userId,
      countyCode,
      stateCode,
    };

    // Use Gemini as primary, fallback to others if needed for Layer 3 (internet search)
    const knowledge = await resolveKnowledge(knowledgeRequest, geminiClient);

    const communityPostCount = knowledge.meta?.communityPosts?.count ?? 0;
    const contractorCount = knowledge.meta?.contractors?.count ?? 0;
    const communityPostItems: any[] = Array.isArray((knowledge.meta as any)?.communityPosts?.items)
      ? ((knowledge.meta as any).communityPosts.items as any[])
      : [];

    // If no LLM providers configured, return a structured offline response so app can be tested
    if (!llmAvailable) {
      return res.json({
        message: "LLM disabled in this environment. Returning knowledge result only.",
        actions: [],
        actionResults: [],
        knowledge: {
          layer: knowledge.layer,
          sources: knowledge.sources,
          confidence: knowledge.confidence,
          data: knowledge.answer,
        },
        llmProvider: "disabled",
        promptVersion,
        timestamp: new Date().toISOString(),
      });
    }

    // Build bounded, role-validated working history. The current user message
    // is supplied separately and removed if the client duplicated it in history.
    const conversationHistory = boundedHistory.conversationHistory;

    // Get local guides if applicable
    let localGuideContext = "";
    if (countyCode && stateCode) {
      const countyOverride = getLocalGuide(countyCode, stateCode);
      if (countyOverride.source !== "none") {
        localGuideContext = `\n\nLOCAL COUNTY INFO (${countyCode}, ${stateCode}):\n${JSON.stringify(
          countyOverride.data,
          null,
          2
        )}`;
      }

      // Check for specific local guides (e.g., roofing_houston)
      const topics = ["roofing", "hvac", "plumbing", "electrical", "foundation"];
      for (const topic of topics) {
        if (message.toLowerCase().includes(topic)) {
          const guide = getLocalMarkdownGuide(topic, countyCode);
          if (guide) {
            localGuideContext += `\n\nLOCAL GUIDE (${topic.toUpperCase()}):\n${guide}`;
            break;
          }
        }
      }
    }

    // Infer current job/project id from recent activity or dashboard-style data
    const inferredJobIdFromActivity = inferJobIdFromActivity(recentActivity);
    const primaryProjectId = userId ? await getPrimaryProjectIdForUser(userId, userRole) : null;
    const currentJobId = inferredJobIdFromActivity || primaryProjectId || null;

    let resolvedContext: ResolvedContext | null = null;
    if (currentJobId) {
      try {
        const { rows } = await pool.query(
          "SELECT type, status FROM documents WHERE job_id = $1 ORDER BY created_at ASC, version ASC",
          [currentJobId]
        );
        resolvedContext = resolveDealRoomContextFromDocs(rows, userRole);
      } catch (err) {
        console.error("[Scout] Failed to resolve workflow context", err);
        resolvedContext = null;
      }
    }

    // SMART SYNTHESIS / DETERMINISTIC ROUTING
    // Instead of passing raw knowledge to the LLM, first synthesize it smartly
    // [USER-CONTEXT] Build and inject user context for personalized responses
    // Phase 3B: Accept optional countyHint from request for jurisdiction-aware bias
    const countyHint = rawBody.countyHint || countyCode; // countyHint from URL param (?county=FIPS)
    const userContext = await buildUserContext(userId, countyHint, { currentMessage: message });

    // Telemetry: Track county hint injection (Phase 2)
    if (countyHint && userId) {
      try {
        console.log("[Scout Telemetry] scout.county_bias_used", {
          surface: "scout",
          scope: "county",
          countyFips: countyHint,
          source: "county_page",
          sessionId: userId, // Use userId as session identifier for server-side
          asOf: new Date().toISOString(),
        });
      } catch {
        // fire-and-forget: ignore telemetry failures
      }
    }

    // Telemetry: Detect if user requests broader scope (state/national override) - Phase 2
    const overrideKeywords =
      /(statewide|anywhere|entire state|all of|nationally|across|everywhere)/i;
    if (countyHint && userId && overrideKeywords.test(message)) {
      try {
        console.log("[Scout Telemetry] scout.county_bias_overridden", {
          surface: "scout",
          scope: "state",
          countyFips: countyHint,
          source: "scout_action",
          sessionId: userId,
          asOf: new Date().toISOString(),
          overrideReason: "user_requested_broader_scope",
        });
      } catch {
        // fire-and-forget: ignore telemetry failures
      }
    }

    // Add inferred capabilities to user context for use in response synthesis
    if (userContext) {
      (userContext as any).inferredCapabilities = capabilities.getAll();
    }

    const recentActivityPrompt = formatRecentActivityForPrompt(recentActivity);

    // [STATE INJECTION] Build comprehensive state for execution contract
    const requestState = {
      auth: !!userId,
      role: userRole,
      route: (req as any).route?.path || "unknown",
      capabilities: roles.length > 0 ? roles : ["guest"],
      last_intent:
        boundedHistory.messages.length > 0 ? "continuation" : "new_conversation",
      locality: {
        county: countyCode,
        state: stateCode,
        region: stateCode ? getRegionFromState(stateCode) : undefined,
      },
      entry_intent: intent || undefined,
      launchContext,
    };

    // Deterministic early-exit: if user intent maps cleanly to an allowed
    // action for the current job, return a short, action-first response and
    // skip the LLM altogether.
    const deterministic = maybeHandleDeterministicIntent({
      message,
      resolvedContext: resolvedContext as DeterministicContext | null,
      currentJobId,
    });

    if (deterministic) {
      const aiResponse: ScoutResponse = {
        message: trimResponseToScreenFit(deterministic.message),
        suggestedActions: deterministic.suggestedActions,
        actions: shapeActionsByConfidence(deterministic.actions as any, {
          confidence: normalizeConfidenceLabel(governorDecision.confidence),
          hasLocality: Boolean(countyCode || stateCode),
          communityPrefill: buildCommunityPrefill(message, countyCode, stateCode),
        }),
        sponsored: null,
        metadata: getClientSafeScoutMetadata(deterministic.metadata as any),
      };

      await syncObjectiveBestEffort({ intent });
      scoutTurnTelemetry.provider = "deterministic";
      scoutTurnTelemetry.sourceUsed = "deterministic_router";
      scoutTurnTelemetry.fallbackUsed = false;
      return res.json({
        ...aiResponse,
        knowledge: {
          layer: knowledge.layer,
          sources: knowledge.sources,
          confidence: knowledge.confidence,
        },
        llmProvider: "deterministic",
        promptVersion,
        timestamp: new Date().toISOString(),
      });
    }

    const systemPromptWithLocalGuides = localGuideContext
      ? `${systemPrompt}${localGuideContext}`
      : systemPrompt;

    const isProviderHighConfidenceIntent =
      isClearProviderServiceIntent(message) &&
      (normalizeConfidenceLabel(governorDecision.confidence) === "high" ||
        inferSourceConfidenceBand(governorDecision.confidence) === "high");

    const synthesized = isProviderHighConfidenceIntent
      ? {
          message: "Start a request below.",
          suggestedActions: [] as string[],
          intent: "provider_request",
          provider: "deterministic",
        }
      : await synthesizeResponse(
          message,
          knowledge,
          geminiClient,
          llmProviders,
          systemPromptWithLocalGuides,
          conversationHistory,
          userContext,
          boundedHistory.messages,
          durableMemoryContext,
          recentActivityPrompt,
          requestState,
          resolvedContext
        );

    if (scoutInteractionLog) {
      scoutInteractionLog.intent = normalizeScoutIntent(
        synthesized.intent ?? intent,
        normalizedMessage
      );
    }

    // Brand identity firewall: if the synthesized answer clearly violates
    // TradeScout identity rules (e.g., mentions CME futures, "as an AI",
    // or open-web sourcing), override it with a safe, internal explanation
    // that reflects our own onboarding knowledge.
    const identityBoundary = enforceTradeScoutIdentityBoundary(message, synthesized.message);
    if (identityBoundary.overridden) {
      if (isOnboardingOrIdentityQuery(message)) {
        try {
          const synthesisResponse = await generateSmartSynthesis(
            message,
            geminiClient,
            llmProviders
          );
          synthesized.message = trimResponseToScreenFit(synthesisResponse.message);
          synthesized.provider = synthesisResponse.provider;
        } catch (error) {
          console.error("[Scout] Brand-guard override synthesis failed", error);
          synthesized.message = TRADE_SCOUT_IDENTITY_FALLBACK_MESSAGE;
        }
      } else {
        synthesized.message = TRADE_SCOUT_IDENTITY_FALLBACK_MESSAGE;
      }
    }

    // If the user is asking for a community welcome/intro post,
    // override the core message with a concrete draft they can post
    // and steer suggested actions toward refining or using that draft.
    if (wantsWelcomeDraft) {
      const drafts = buildWelcomeIntroVariants(message, userRecord, countyCode, stateCode);

      const header =
        "Here are stronger welcome-post options you can use right now. Pick one and I can tune the voice, length, or audience:";

      const options = [
        `Option A (Balanced)\n${drafts.primary}`,
        `Option B (Concise)\n${drafts.concise}`,
        `Option C (Professional)\n${drafts.professional}`,
      ].join("\n\n");

      synthesized.message = trimResponseToScreenFit(`${header}\n\n${options}`);

      synthesized.suggestedActions = [
        "Post Option A in my community feed now",
        "Make Option B more casual and neighborly",
        "Tailor Option C for my HOA or specific group",
      ];
    } else if (wantsExchangeListingDraft) {
      const listingDraft = buildExchangeListingDraft({
        originalMessage: message,
        userRecord,
        countyCode,
        stateCode,
        extractDollarAmount,
        formatUsd,
      });

      const lines: string[] = [];
      lines.push(
        "Here's a tight Exchange listing you can post. Edit details so it matches your exact item:"
      );
      lines.push("");
      lines.push(`Title: ${listingDraft.title}`);
      lines.push("");
      lines.push("Description:");
      lines.push(listingDraft.description);
      if (listingDraft.price && listingDraft.price > 0) {
        lines.push("");
        lines.push(`Price: ${formatUsd(listingDraft.price)} (you can adjust this).`);
      }
      if (listingDraft.locationLabel) {
        lines.push("");
        lines.push(`Location: ${listingDraft.locationLabel}`);
      }

      synthesized.message = trimResponseToScreenFit(lines.join("\n"));

      synthesized.suggestedActions = [
        "Make this listing shorter and punchier",
        "Help me improve this listing description to attract serious buyers",
        "Suggest a fair price range based on what I'm selling",
      ];
    }

    // The synthesized answer is our response with suggestedActions.
    // Keep publicEntities/ctaHints constrained to community-post summaries.
    const publicEntities: ScoutPublicEntity[] = communityPostItems.slice(0, 6).map((p) => ({
      type: "community_post",
      id: String(p.id),
      href: "/community?post=" + encodeURIComponent(String(p.id)),
      authorId: p.authorId ?? p.author_id ?? null,
      canDirectConnect: false,
      canMessage: !!(p.authorId || p.author_id),
    }));
    const ctaHints: ScoutCtaHintServer[] = communityPostItems.slice(0, 6).map((p) => ({
      type: "community_post",
      id: String(p.id),
      authorId: p.authorId ?? p.author_id ?? null,
      canDirectConnect: false,
      canMessage: !!(p.authorId || p.author_id),
    }));

    const aiResponse: ScoutResponse = {
      message: prependLocalIntro(synthesized.message, {
        countyCode,
        stateCode,
        historyLength: history.length,
        communityPostCount,
        contractorCount,
      }),
      suggestedActions: synthesized.suggestedActions,
      actions: [],
      sponsored: null,
      publicEntities,
      ctaHints,
      metadata: {
        intent: synthesized.intent,
        sourceUsed: sourceAudit.sourceUsed,
        scaffoldDecision: scaffoldDecision.type,
        attemptedSource: sourceAudit.attemptedSource,
        fallbackUsed: Boolean(sourceAudit.fallbackUsed) || synthesized.provider === "fallback",
        degradationReason: synthesized.degradationReason ?? sourceAudit.degradationReason,
        confidenceBand: sourceAudit.confidenceBand,
        currentJobId: currentJobId || undefined,
        resolvedContext,
      },
    };

    // Community Vault and navigation helpers (explicit chips; no auto-execution on client)
    const lowConfidenceForLocal = knowledge.layer >= 3 || knowledge.confidence === "low";

    try {
      const lower = message.toLowerCase();
      let actions: ScoutClientAction[] = Array.isArray(aiResponse.actions)
        ? aiResponse.actions.slice()
        : [];

      // -----------------------------------------------------------------
      // Routing explainer contract
      // -----------------------------------------------------------------
      // When the user asks why something isn't routed yet, ensure we provide a
      // concrete help deep-link so the UI can render an actionable cluster.
      const wantsRoutingExplainer =
        /not\s+routed\s+yet/i.test(lower) ||
        (lower.includes("why") && lower.includes("routed")) ||
        (lower.includes("routing") && lower.includes("why"));

      if (wantsRoutingExplainer) {
        const helpPath = "/help/how-tradescout-works#direct-connect-workflow";
        const alreadyHasHelp = actions.some(
          (a) => a.type === "NAVIGATE" && typeof a.to === "string" && a.to.includes(helpPath)
        );
        if (!alreadyHasHelp) {
          actions.unshift({
            type: "NAVIGATE",
            label: "See how Direct Connect works",
            to: helpPath,
            path: helpPath,
            subtitle: "Why messaging stays gated",
            why: "Explains how decision cards unlock contact safely.",
            primary: true as any,
          });
        }
      }

      // -----------------------------------------------------------------
      // TradeDeals / Daily Deals CTA hints
      // -----------------------------------------------------------------
      // When the user is clearly asking about deals/savings/materials,
      // surface a small, county-scoped set of active daily deals as
      // publicEntities + ctaHints so the client can attach CTAs.
      const dealIntent = isTradeDealIntent(message);
      const taskIntent = isTaskOrProblemIntent(message);
      const dealHelpfulForTask = taskIntent && isDealHelpfulForTask(message);

      const allowDealAssist =
        SCOUT_DEAL_ASSIST_ENABLED &&
        !!countyCode &&
        !lowConfidenceForLocal &&
        (dealIntent || dealHelpfulForTask);

      const shouldAttachDeals = allowDealAssist && !isDealSuppressedContext(message);

      const dealAssistLabel =
        !dealIntent && dealHelpfulForTask
          ? "Helpful local deals for materials mentioned"
          : undefined;

      if (shouldAttachDeals) {
        try {
          const deals = await storage.getDailyDeals({
            countyFips: countyCode,
            activeOnly: true,
            limit: 5,
          });
          const compliantDeals = shapeDealsForScout({
            deals,
            confidence: normalizeConfidenceLabel(governorDecision.confidence),
            localityPresent: Boolean(countyCode || stateCode),
            taskSummary: synthesized.intent ?? intent ?? undefined,
          });

          if (Array.isArray(compliantDeals) && compliantDeals.length > 0) {
            const dealEntities: ScoutPublicEntity[] = compliantDeals.map((d) => ({
              type: "trade_deal",
              id: String(d.id),
              href: typeof d.applyPath === "string" ? d.applyPath : "/trade-deals",
              ownerUserId: (d as any).providerId ?? null,
              canDirectConnect: true,
              canMessage: !!(d as any).providerId,
            }));

            const dealHints: ScoutCtaHintServer[] = compliantDeals.map((d) => ({
              type: "trade_deal",
              id: String(d.id),
              ownerUserId: (d as any).providerId ?? null,
              canDirectConnect: true,
              canMessage: !!(d as any).providerId,
            }));

            const dealActions: ScoutClientAction[] = compliantDeals.map((d) => ({
              type: "NAVIGATE",
              label: `Apply deal: ${d.title ?? "Local offer"}`,
              to: typeof d.applyPath === "string" ? d.applyPath : "/trade-deals",
              path: typeof d.applyPath === "string" ? d.applyPath : "/trade-deals",
              // Disclosure + relevance rationale baked into label/why to avoid separate UI changes
              subtitle: "Sponsored placement",
              why: d._scoutWhy || dealAssistLabel || "Relevant to your current request",
              payload: { dealId: d.id },
            }));

            aiResponse.publicEntities = [...(aiResponse.publicEntities || []), ...dealEntities];

            aiResponse.ctaHints = [
              ...(aiResponse.ctaHints || []),
              ...dealHints.map((hint) => ({
                ...hint,
                label: dealAssistLabel ?? "Sponsored placement",
              })),
            ];

            actions.push(...dealActions);
          }
        } catch (dealErr) {
          console.error("[Scout] Failed to attach trade_deal hints", dealErr);
        }
      }

      // Context-aware Direct Connect finances nudge: when a contractor has a
      // Direct Connect job in progress, gently surface a single suggestion to
      // create an invoice or record payment, deep-linking into Finances with
      // project/client prefill.
      const directConnectContext =
        userRole === "contractor"
          ? await getLatestInProgressDirectConnectForContractor(userId)
          : null;

      if (directConnectContext) {
        const dcPrompt =
          "This Direct Connect job is in progress — would you like to create an invoice or record payment?";

        const dcLabel = "Create invoice or record payment for this job";

        const existingInvoiceSuggestion = (aiResponse.suggestedActions || []).some(
          (label) => typeof label === "string" && label.toLowerCase().includes("invoice")
        );

        if (!existingInvoiceSuggestion) {
          const nextSuggestions = [dcLabel, ...(aiResponse.suggestedActions || [])];
          aiResponse.suggestedActions = nextSuggestions.slice(0, 3);
        }

        const params = new URLSearchParams();
        if (directConnectContext.title) params.set("project", directConnectContext.title);
        if (directConnectContext.clientName) params.set("client", directConnectContext.clientName);
        const dcFinancesPath =
          "/finances/invoices" + (params.toString() ? `?${params.toString()}` : "");

        const alreadyHasDcInvoiceNav = actions.some(
          (a) =>
            a.type === "NAVIGATE" &&
            typeof a.to === "string" &&
            a.to.startsWith("/finances/invoices") &&
            a.to.includes("project=") &&
            a.to.includes(encodeURIComponent(directConnectContext.title))
        );

        if (!alreadyHasDcInvoiceNav) {
          actions.push({
            type: "NAVIGATE",
            label: "Open Finances for this job",
            to: dcFinancesPath,
          });
        }

        aiResponse.message = trimResponseToScreenFit(`${aiResponse.message}\n\n${dcPrompt}`);
      }

      const forceProviderPath = isClearProviderServiceIntent(message);
      const routingConfidenceBand = forceProviderPath
        ? "high"
        : normalizeConfidenceLabel(governorDecision.confidence);
      const providerIntentCategory = forceProviderPath
        ? "provider_search"
        : (synthesized as any)?.intent?.category;

      // Delegate rich community question/welcome ownership to a dedicated owner module.
      const communityBehavior = applyCommunityBehaviorOwnership({
        userId,
        message,
        responseMessage: aiResponse.message,
        actions,
        canPostInCommunity: capabilities.canPostInCommunity(),
        communityPostCount,
        lowConfidenceForLocal,
        communityPrefill: buildCommunityPrefill(message, countyCode, stateCode),
        countyCode,
        confidenceBand: routingConfidenceBand,
        wantsWelcomeDraft,
        welcomeDraft:
          userId && wantsWelcomeDraft
            ? buildWelcomeIntroDraft(message, userRecord, countyCode, stateCode)
            : undefined,
      });
      aiResponse.message = trimResponseToScreenFit(communityBehavior.message);
      actions = communityBehavior.actions;

      actions = applyMarketplaceListingNavigationOwnership({
        userId,
        wantsExchangeListingDraft,
        canPostMarketplaceItem: capabilities.canPostMarketplaceItem(),
        confidenceBand: routingConfidenceBand,
        message,
        userRecord,
        countyCode,
        stateCode,
        actions,
        buildDraft: (draftMessage, draftUserRecord, draftCountyCode, draftStateCode) =>
          buildExchangeListingDraft({
            originalMessage: draftMessage,
            userRecord: draftUserRecord,
            countyCode: draftCountyCode,
            stateCode: draftStateCode,
            extractDollarAmount,
            formatUsd,
          }),
      });

      actions = applyProviderBehaviorOwnership({
        actions,
        intentCategory: providerIntentCategory,
        intentSlug: (synthesized as any)?.intent?.slug,
        message,
        countyCode,
        stateCode,
        confidenceBand: routingConfidenceBand,
      }) as ScoutClientAction[];

      // Confidence-shaped action guardrail + community bias
      actions = shapeActionsByConfidence(actions, {
        confidence: routingConfidenceBand,
        hasLocality: Boolean(countyCode || stateCode),
        communityPrefill: buildCommunityPrefill(message, countyCode, stateCode),
      });

      // Deal dead-end guardrail: suppress any deal actions lacking applyPath
      if (actions.some((a) => (a as any).subtitle === "Sponsored placement")) {
        actions = actions.filter(
          (a) => (a as any).subtitle !== "Sponsored placement" || (a as any).to
        );
      }

      // Ensure actions always exist; if trimming removed all, re-seed
      if (!actions || actions.length === 0) {
        actions = shapeActionsByConfidence([], {
          confidence: routingConfidenceBand,
          hasLocality: Boolean(countyCode || stateCode),
          communityPrefill: buildCommunityPrefill(message, countyCode, stateCode),
        });
      }

      aiResponse.actions = actions;

      actions = applySupportBehaviorOwnership({
        actions,
        lowerMessage: lower,
        userId,
        canCreateCommunityVault: capabilities.canCreateCommunityVault(),
        activeProfileId,
        extractProfileIdFromText,
        message,
        extractDollarAmount,
        formatUsd,
      }) as ScoutClientAction[];

      // Connections / friends navigation: surface the dedicated connections view
      if (userId) {
        const mentionsConnections =
          lower.includes("connection") ||
          lower.includes("connections") ||
          lower.includes("friend") ||
          lower.includes("friends") ||
          lower.includes("follow") ||
          lower.includes("followers") ||
          lower.includes("following");

        if (mentionsConnections) {
          const alreadyHasConnectionsNav = actions.some(
            (a) => a.type === "NAVIGATE" && a.to === "/connections"
          );

          if (!alreadyHasConnectionsNav) {
            actions.push({
              type: "NAVIGATE",
              label: "View my connections",
              to: "/connections",
            });
          }
        }
      }

      // Finances & accounting navigation: surface the dedicated Finances
      // workspaces so a contractor can quickly open AR, vendor spend,
      // or P&L/tax views directly from Scout.
      // Only show if user can actually send invoices (capability, not role)
      const canAccessFinances = capabilities.canSendInvoices() || capabilities.canAcceptPayments();

      const wantsFinancesOverview =
        lower.includes("finances") ||
        lower.includes("bookkeeping") ||
        lower.includes("cash flow") ||
        lower.includes("cashflow") ||
        lower.includes("accounting") ||
        lower.includes("financials");

      const wantsARView =
        /accounts?\s+receivable/.test(lower) ||
        lower.includes("who owes me") ||
        lower.includes("who still owes") ||
        lower.includes("unpaid invoice") ||
        lower.includes("unpaid invoices") ||
        lower.includes("overdue invoice") ||
        lower.includes("overdue invoices") ||
        lower.includes("open invoices");

      const wantsVendorsView =
        lower.includes("vendors") ||
        lower.includes("supplier") ||
        lower.includes("suppliers") ||
        lower.includes("subscriptions") ||
        /who am i paying/.test(lower);

      const wantsReportsView =
        lower.includes("profit and loss") ||
        lower.includes("p&l") ||
        lower.includes("pnl") ||
        lower.includes("financial reports") ||
        /how much.*set aside.*tax/.test(lower) ||
        lower.includes("tax set aside") ||
        lower.includes("tax set-aside") ||
        lower.includes("tax estimate");

      const alreadyHasFinancesNav = actions.some(
        (a) => a.type === "NAVIGATE" && typeof a.to === "string" && a.to.startsWith("/finances")
      );

      if (
        userId &&
        canAccessFinances &&
        (wantsFinancesOverview || wantsARView || wantsVendorsView || wantsReportsView)
      ) {
        let arSummaryLine: string | null = null;
        let vendorSummaryLine: string | null = null;
        let arWhyLine: string | null = null;
        let vendorWhyLine: string | null = null;
        let directionLine: string | null = null;

        try {
          const snapshot = await getStandaloneAccountingSnapshotForUser(String(userId));
          if (snapshot.totalInvoiced > 0) {
            const pieces: string[] = [];
            pieces.push(
              `Based on your TradeScout accounting data, you've invoiced ${formatUsd(snapshot.totalInvoiced)} lifetime and collected ${formatUsd(snapshot.totalPaid)}.`
            );

            if (snapshot.totalUnpaid > 0) {
              let tail = `You still have ${formatUsd(snapshot.totalUnpaid)} open`;
              if (snapshot.clientCount > 0) {
                tail += ` across ${snapshot.clientCount} client${snapshot.clientCount === 1 ? "" : "s"}`;
              }
              if (snapshot.largestOpenClient && snapshot.largestOpenClient.amount > 0) {
                tail += `; the largest balance is ${formatUsd(snapshot.largestOpenClient.amount)} with ${snapshot.largestOpenClient.name}.`;
              } else {
                tail += ".";
              }
              pieces.push(tail);
            }

            arSummaryLine = pieces.join(" ");

            // "Why this matters" interpretation line for AR
            if (
              snapshot.totalUnpaid > 0 &&
              snapshot.largestOpenClient &&
              snapshot.largestOpenClient.amount > 0
            ) {
              const share =
                snapshot.totalUnpaid > 0
                  ? snapshot.largestOpenClient.amount / snapshot.totalUnpaid
                  : 0;
              if (share >= 0.6) {
                arWhyLine = `Why this matters: most of your open AR is tied up with ${snapshot.largestOpenClient.name}, so nudging them will move cash the fastest.`;
              } else if (snapshot.clientCount > 1) {
                arWhyLine = `Why this matters: your open AR is spread across ${snapshot.clientCount} clients, so focusing on the largest balances will unlock cash quicker.`;
              }
            } else if (snapshot.totalUnpaid === 0 && snapshot.totalPaid > 0) {
              arWhyLine = `Why this matters: you have no open AR right now, so your next cash bump will come from new invoices or repeat work.`;
            }
          }
        } catch (finErr) {
          console.error("[Scout] Failed to compute standalone accounting snapshot", finErr);
        }

        if (wantsVendorsView || wantsFinancesOverview || wantsReportsView) {
          try {
            const vendorSnapshot = await getStandaloneVendorSnapshotForUser(String(userId));
            if (vendorSnapshot.totalExpenses > 0) {
              const parts: string[] = [];
              parts.push(
                `You've recorded ${formatUsd(vendorSnapshot.totalExpenses)} in standalone expenses.`
              );
              if (vendorSnapshot.vendorCount > 0) {
                parts[0] += ` across ${vendorSnapshot.vendorCount} vendor${vendorSnapshot.vendorCount === 1 ? "" : "s"}.`;
              }
              if (vendorSnapshot.topVendor && vendorSnapshot.topVendor.amount > 0) {
                parts.push(
                  `Your top vendor so far is ${vendorSnapshot.topVendor.name} at ${formatUsd(vendorSnapshot.topVendor.amount)}.`
                );
              }
              vendorSummaryLine = parts.join(" ");

              // "Why this matters" interpretation line for vendor spend
              const topShare =
                vendorSnapshot.totalExpenses > 0 && vendorSnapshot.topVendor
                  ? vendorSnapshot.topVendor.amount / vendorSnapshot.totalExpenses
                  : 0;
              if (vendorSnapshot.topVendor && topShare >= 0.6) {
                vendorWhyLine = `Why this matters: most of your spend is concentrated with ${vendorSnapshot.topVendor.name}, so any renegotiation or change there will have an outsized impact.`;
              } else if (vendorSnapshot.vendorCount > 1) {
                vendorWhyLine = `Why this matters: your expenses are spread across several vendors, so looking at the top few will show where money is really going.`;
              }
            }
          } catch (vendorErr) {
            console.error("[Scout] Failed to compute standalone vendor snapshot", vendorErr);
          }
        }
        if (!alreadyHasFinancesNav) {
          actions.push({
            type: "NAVIGATE",
            label: "Open finances",
            to: "/finances",
          });
        }

        if (wantsARView) {
          const hasClientsNav = actions.some(
            (a) => a.type === "NAVIGATE" && a.to === "/finances/clients"
          );
          if (!hasClientsNav) {
            actions.push({
              type: "NAVIGATE",
              label: "See who owes me (AR)",
              to: "/finances/clients",
            });
          }
        }

        if (wantsVendorsView) {
          const hasVendorsNav = actions.some(
            (a) => a.type === "NAVIGATE" && a.to === "/finances/vendors"
          );
          if (!hasVendorsNav) {
            actions.push({
              type: "NAVIGATE",
              label: "Review vendor spend",
              to: "/finances/vendors",
            });
          }
        }

        if (wantsReportsView || (!wantsARView && !wantsVendorsView && wantsFinancesOverview)) {
          const hasReportsNav = actions.some(
            (a) => a.type === "NAVIGATE" && a.to === "/finances/reports"
          );
          if (!hasReportsNav) {
            actions.push({
              type: "NAVIGATE",
              label: "View P&L and tax snapshot",
              to: "/finances/reports",
            });
          }
        }

        // Append concise guidance so the user understands what will open.
        const financeLines: string[] = [aiResponse.message];
        if (arSummaryLine) {
          financeLines.push(arSummaryLine);
          if (arWhyLine) {
            financeLines.push(arWhyLine);
          }
        }
        if (vendorSummaryLine && (wantsVendorsView || (!wantsARView && wantsFinancesOverview))) {
          financeLines.push(vendorSummaryLine);
          if (vendorWhyLine) {
            financeLines.push(vendorWhyLine);
          }
        }
        if (wantsARView) {
          directionLine =
            "I'll open your Finances  Clients view so you can see open balances and who still owes you.";
          financeLines.push(directionLine);
        } else if (wantsVendorsView) {
          directionLine =
            "I'll open your Finances  Vendors view so you can review where your money is going.";
          financeLines.push(directionLine);
        } else if (wantsReportsView) {
          directionLine =
            "I'll open your Finances  Reports view so you can see income, expenses, and a simple tax set-aside suggestion.";
          financeLines.push(directionLine);
        } else if (wantsFinancesOverview) {
          directionLine =
            "I'll open Finances so you can see invoices, expenses, and simple reports in one place.";
          financeLines.push(directionLine);
        }

        aiResponse.message = trimResponseToScreenFit(financeLines.join("\n\n"));
        const combinedFinanceMessage = trimResponseToScreenFit(financeLines.join("\n\n"));
        aiResponse.message = appendFinanceConfidenceLine(combinedFinanceMessage);

        const truthLines: string[] = [];
        if (arSummaryLine) truthLines.push(arSummaryLine);
        if (vendorSummaryLine) truthLines.push(vendorSummaryLine);

        if (truthLines.length > 0 || arWhyLine || vendorWhyLine || directionLine) {
          aiResponse.frame = {
            templateId: "finance:standalone",
            truthLines,
            meaningLine: arWhyLine || vendorWhyLine || undefined,
            directionLine: directionLine || undefined,
            actionChips: [
              {
                id: "open-finances",
                label: "Open Finances",
                kind: "NAVIGATE",
                target: "/finances",
                priority: "primary",
              },
            ],
            suggestedPrompts: aiResponse.suggestedActions,
            workingContextDelta: {
              topic: "finances",
            },
          };

          aiResponse.workingContext = {
            lastTopic: "finances",
            lastTemplateId: aiResponse.frame.templateId,
          };
        }
      }

      // Project tracker / workflow actions
      // If the user is authenticated and asking about projects/jobs/contracts/invoices,
      // expose an explicit navigation chip into the Project Tracker / Finances surface.
      if (userId) {
        const wantsProjects =
          lower.includes("project") ||
          lower.includes("projects") ||
          lower.includes("job") ||
          lower.includes("jobs") ||
          lower.includes("estimate") ||
          lower.includes("contract") ||
          lower.includes("invoice") ||
          lower.includes("receipt") ||
          lower.includes("jobs workspace") ||
          (typeof synthesized.intent === "string" && /project|job/i.test(synthesized.intent));

        const wantsJobFinances =
          (wantsProjects && /profit|margin|money|finances|p&l|pnl/.test(lower)) ||
          /job finances|project finances|how much have (we|i) (made|spent)/.test(lower);

        // Project tracker is for users who can track projects
        if (wantsProjects && capabilities.canTrackProjects()) {
          const alreadyHasTracker = actions.some(
            (a) =>
              a.type === "NAVIGATE" && (a.to === "/lead-management" || a.to === "/project-tracker")
          );

          if (!alreadyHasTracker) {
            const baseAction: ScoutClientAction = {
              type: "NAVIGATE",
              label: "Open Project Tracker",
              to: "/lead-management",
            };

            if (currentJobId) {
              baseAction.payload = { ...(baseAction.payload || {}), jobId: currentJobId };
            }

            actions.push(baseAction);
          }

          if (currentJobId) {
            try {
              // If the user is clearly asking about this job's money
              // or profitability, compute a concise per-job snapshot
              // using the same documents that power the workflow panel.
              if (wantsJobFinances) {
                try {
                  const jf = await getJobFinancesSnapshot(currentJobId);
                  if (jf.income > 0 || jf.expenses > 0) {
                    const lines: string[] = [];
                    lines.push(
                      `For this job's finances, you've invoiced ${formatUsd(jf.income)}, collected ${formatUsd(jf.collected)}, and still have ${formatUsd(jf.outstanding)} open.`
                    );
                    lines.push(
                      `You've recorded ${formatUsd(jf.expenses)} in expenses so far, for a simple net of ${formatUsd(jf.net)} before taxes and overhead.`
                    );

                    // "Why this matters" interpretation for per-job finances
                    let jobMeaningLine: string | null = null;
                    if (jf.net > 0) {
                      jobMeaningLine =
                        "Why this matters: this job is currently net positive, so protecting margin means watching for any last-minute expenses or discounts.";
                      lines.push(jobMeaningLine);
                    } else if (jf.net < 0) {
                      jobMeaningLine =
                        "Why this matters: this job is currently running negative, so the next decisions on change orders, scope, or expenses will determine whether it breaks even.";
                      lines.push(jobMeaningLine);
                    }

                    const combined = `${lines.join(" ")}\n\n${aiResponse.message}`;
                    const trimmed = trimResponseToScreenFit(combined);
                    aiResponse.message = appendFinanceConfidenceLine(trimmed);

                    const truthLines = lines.slice(0, 2);
                    aiResponse.frame = {
                      templateId: "finance:job-snapshot",
                      truthLines,
                      meaningLine: jobMeaningLine || undefined,
                      directionLine: undefined,
                      actionChips: [
                        {
                          id: "open-jobs-workspace",
                          label: "Open Jobs Workspace",
                          kind: "NAVIGATE",
                          target: "/finances/jobs",
                          args: { jobId: currentJobId },
                          priority: "primary",
                        },
                      ],
                      suggestedPrompts: aiResponse.suggestedActions,
                      workingContextDelta: {
                        topic: "projects",
                        jobId: currentJobId,
                      },
                    };

                    aiResponse.workingContext = {
                      lastTopic: "projects",
                      lastJobId: currentJobId,
                      lastTemplateId: aiResponse.frame.templateId,
                    };
                  }
                } catch (jobFinErr) {
                  console.error("[Scout] Failed to compute per-job finances snapshot", jobFinErr);
                }
              }

              const { rows } = await pool.query(
                "SELECT type, status FROM documents WHERE job_id = $1 ORDER BY created_at ASC, version ASC",
                [currentJobId]
              );

              const guidance = buildDealRoomGuidanceFromDocs(rows, userRole);
              if (guidance) {
                const guidancePrefix = `For this project's jobs workflow:\n${guidance}`;
                aiResponse.message = trimResponseToScreenFit(
                  `${guidancePrefix}\n\n${aiResponse.message}`
                );
              }
            } catch (guidanceError) {
              console.error("[Scout] Failed to compute workflow guidance", guidanceError);
            }
          }
        }
      }

      aiResponse.actions = actions;
    } catch (actionError) {
      console.error("[Scout] failed to build community vault actions", actionError);
    }

    // The synthesis result is our response; no further action extraction needed
    // This simplifies the response and focuses on Scout's intelligent synthesis

    // Apply fraud/scam safety filter
    if (aiResponse.message) {
      const safety = sanitizeSuspiciousContent(aiResponse.message);
      aiResponse.message = safety.message;
      if (safety.flagged) {
        // Drop actions if content looks unsafe
        aiResponse.actions = [];
        aiResponse.sponsored = null;
      }
    }

    // Monetization injection: at most 1 sponsored item per response, session-capped by client.
    try {
      const excludeIds = Array.isArray(shownAdIds) ? shownAdIds.filter(Boolean) : [];
      const allowSponsored = shouldInjectSponsored({
        userId,
        historyLength: Array.isArray(history) ? history.length : 0,
        rolesLength: Array.isArray(roles) ? roles.length : 0,
        countyCode,
        stateCode,
        shownAdIdsLength: excludeIds.length,
      });

      if (!aiResponse.sponsored && allowSponsored) {
        const lowerRoles = new Set(
          (Array.isArray(roles) ? roles : []).map((r) => String(r).toLowerCase())
        );

        const audience =
          lowerRoles.has("contractor") || lowerRoles.has("pro")
            ? "contractors"
            : lowerRoles.has("homeowner") || lowerRoles.has("resident")
              ? "homeowners"
              : userContext?.preferences?.isContractor
                ? "contractors"
                : userContext?.preferences?.isHomowner
                  ? "homeowners"
                  : "all";

        const preferAffiliate =
          /deal|discount|coupon|offer|promo|save\b/i.test(message) ||
          (Array.isArray(recentActivity)
            ? recentActivity.some(
                (e) =>
                  String((e as any)?.type || "") === "navigate" &&
                  String((e as any)?.to || "").includes("/marketplace")
              )
            : false);

        let countyFips: string | undefined;
        if (stateCode) {
          const counties = await storage.getCounties(stateCode);
          countyFips = resolveCountyFips({ countyCode, stateCode, counties });
        }

        let regionSlug: string | undefined;
        if (stateCode) {
          const regions = await storage.getRegions({ stateCode, isOfficial: true, limit: 50 });
          regionSlug = resolveRegionSlug({ stateCode, countyFips, regions });
        }

        const ad = await storage.getTargetedAd({
          audience,
          state: stateCode,
          county: countyFips,
          regionSlug,
          placement: "site_visit",
          excludeAdIds: excludeIds,
          preferAffiliate,
          // Higher bar for Scout-injected ads
          minCommunityScore: 60,
        });

        if (ad) {
          await storage.incrementAdImpressions(ad.id);

          const user = req.user as any;
          const userId = (user as any)?.claims?.sub || (user as any)?.id || null;
          await storage.trackAdEvent({
            adId: ad.id,
            eventType: "impression",
            source: "scout",
            userId,
          });

          const linkUrl = await storage.normalizeAdLinkForUser({
            linkUrl: (ad as any).linkUrl,
            isAffiliate: (ad as any).isAffiliate,
            userId,
          });
          aiResponse.sponsored = {
            id: ad.id,
            title: ad.title,
            content: ad.content,
            imageUrl: ad.imageUrl,
            linkUrl,
            isAffiliate: ad.isAffiliate,
            targetLocation: ad.targetLocation,
          };
        }
      }
    } catch (monetizationError) {
      console.error("[Scout] Monetization injection failed:", monetizationError);
      aiResponse.sponsored = null;
    }

    /**
     * CRITICAL: Sanitize Scout response before sending to frontend.
     *
     * Uses canonical extractor: enforces single choke point for normalizing
     * all model output into safe user-facing messages.
     *
     * Contract: No internal reasoning (intent, thought_flow, etc.) ever reaches UI.
     */
    const extracted = extractUserMessage(aiResponse as RawScoutOutput);

    if (!extracted.isClean && extracted.hadLeakage) {
      console.warn("[Scout] Response blocked reasoning leakage", {
        userId,
        leakageFields: extracted.leakageFields,
        originalMessage: aiResponse.message?.substring(0, 100),
      });
    }

    // Replace message with sanitized version
    aiResponse.message = extracted.message;

    // Extract metadata for backend-only use (not sent to frontend)
    const metadata = extractMetadata(aiResponse as RawScoutOutput);
    if (metadata.intent || metadata.confidence) {
      console.info("[Scout] Backend metadata (server-side only)", {
        intent: metadata.intent,
        confidence: metadata.confidence,
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // GUARD: Wrap actions with error handling
    // ─────────────────────────────────────────────────────────────────
    // Actions are pre-validated before sending to user. Any errors during
    // action construction are already trapped above (see actionError catch).
    // Here we add metadata to help Scout recover gracefully if user
    // attempts to execute an action that fails.
    const guardContext: ScoutActionContext = {
      userId,
      userProfile: {
        businessName: (userRecord as any)?.businessName,
        location: countyCode ? `${countyCode}, ${stateCode}` : undefined,
        roles: (userRecord as any)?.roles,
        county: countyCode,
        state: stateCode,
      },
      sessionId: (req as any).sessionId,
      requestId: (req as any).requestId,
    };

    const responseKnowledgeSources: KnowledgeSourceReference[] = Array.isArray(knowledge.sources)
      ? [...knowledge.sources]
      : [];

    // External data source (partner action bridge)
    // NOTE: This is strictly server-to-server and read-only; it is safe to ignore on failure.
    let externalAddon = "";
    try {
      const wantsFood = isExternalFoodIntent(message);
      const lat = coerceFiniteNumber((rawBody as any)?.locality?.lat);
      const lng = coerceFiniteNumber((rawBody as any)?.locality?.lng);

      if (wantsFood && lat !== null && lng !== null) {
        const truckResult = await callExternalActions({
          action: "GET_FOOD_TRUCKS",
          params: { latitude: lat, longitude: lng, radiusKm: 5 },
        });

        const trucks = truckResult.ok
          ? Array.isArray(truckResult.data?.results)
            ? truckResult.data.results
            : Array.isArray(truckResult.data?.data)
              ? (truckResult.data.data as any[])
              : []
          : [];

        if (trucks.length > 0) {
          const top = trucks.slice(0, 5);
          externalAddon +=
            "\n\nNearby food options (external feed):\n" +
            top
              .map((t: any) => {
                const name =
                  String(t?.name || t?.businessName || t?.title || "Food truck").trim() ||
                  "Food truck";
                const address = String(t?.address || t?.location || t?.city || "").trim() || "";
                return `- ${name}${address ? ` — ${address}` : ""}`;
              })
              .join("\n");
        }

        responseKnowledgeSources.push({
          title: "External actions feed (local discovery)",
          type: "external_actions",
        });
      }
    } catch {
      // fail-soft
    }

    // D2-2: Inject onboarding question contextually if active
    let finalMessage = `${aiResponse.message || ""}${externalAddon}`.trim();
    const onboardingMeta: Record<string, unknown> = {};

    if (onboardingSession && onboardingSession.isOnboarding) {
      // D2-5: Apply softer language when onboarding
      finalMessage = applySofterLanguage(finalMessage, onboardingSession);

      // D2-2: Determine next question to ask
      const nextQuestion = getNextQuestion(onboardingSession);
      if (nextQuestion) {
        const questionPrompt = getQuestionPrompt(nextQuestion, {
          scope: onboardingSession.snapshot.context?.scope,
          intent: onboardingSession.snapshot.intent,
        });

        if (questionPrompt) {
          // Inject question into metadata for client to display
          onboardingMeta.onboardingQuestion = {
            key: nextQuestion,
            question: questionPrompt.question,
            options: questionPrompt.options,
            skipLabel: questionPrompt.skipLabel,
            explanation: questionPrompt.explanation,
          };

          onboardingMeta.snapshot = {
            confidence: onboardingSession.snapshot.confidence,
            answeredQuestions: onboardingSession.answeredQuestions.length,
            totalQuestions: 4,
          };

          onboardingMeta.sessionId = clientSessionId;
        }
      }
    }

    const userFacingSanitized = sanitizeScoutUserFacingText(finalMessage || "", {
      fallback: buildContextualSynthesisFallbackMessage(knowledge.answer, {
        rateLimited: scoutTurnTelemetry.degradationReason === "synthesis_rate_limited",
      }),
      maxChars: 600,
    });
    finalMessage = userFacingSanitized.text;
    if (userFacingSanitized.flags.length > 0) {
      try {
        await storage.logEvent("scout_response_sanitized", {
          userId: userId || null,
          countyCode: countyCode || null,
          stateCode: stateCode || null,
          flags: userFacingSanitized.flags,
          removedLines: userFacingSanitized.removedLines,
          requestId: (req as any).requestId || null,
        });
      } catch (sanitizeLogErr) {
        console.error("[Scout] failed to log response sanitation", sanitizeLogErr);
      }
    }

    // Enforce governance policy: Scout may not recommend/endorse people.
    const policyMessage = sanitizeScoutMessageForPolicy(finalMessage || "");
    finalMessage = policyMessage.message;
    const policyActions = sanitizeScoutActionsForPolicy((aiResponse.actions || []) as any[]);
    const policySuggestions = sanitizeScoutSuggestionsForPolicy(aiResponse.suggestedActions || []);
    aiResponse.suggestedActions = policySuggestions.suggestions;

    const policyViolations = [
      ...policyMessage.violations,
      ...policyActions.violations,
      ...policySuggestions.violations,
    ];
    if (policyViolations.length > 0) {
      try {
        await storage.logEvent("scout_policy_violation_detected", {
          userId: userId || null,
          countyCode: countyCode || null,
          stateCode: stateCode || null,
          violations: policyViolations.slice(0, 10),
          violationCount: policyViolations.length,
          requestId: (req as any).requestId || null,
        });
      } catch (policyLogErr) {
        console.error("[Scout] failed to log policy violation telemetry", policyLogErr);
      }
    }

    // Tag actions with guard context so they can self-recover if needed
    const guardedActions =
      policyActions.actions.map((action: any) => ({
        ...action,
        _guardContext: guardContext, // Internal: used by client/server for recovery
      })) || [];

    const primaryGuardedAction = guardedActions.find((action: any) => Boolean(action?.primary));
    const hasPrimaryPrefillAction = primaryGuardedAction?.type === "PREFILL_INPUT";
    const hasPrimaryClarificationAction =
      primaryGuardedAction?.type === "ASK_SCOUT" &&
      primaryGuardedAction?.payload?.clarificationMode === true;

    try {
      const generatedEvents = guardedActions
        .filter((action: any) => Boolean(action?.primary))
        .map((action: any) => {
          const telemetry = resolveOutcomeActionTelemetry(action);
          if (!telemetry) return null;
          return storage.logEvent("scout_outcome_action_generated", {
            userId: userId || null,
            requestId: (req as any).requestId || null,
            ownerModule: telemetry.ownerModule,
            target: telemetry.target,
            confidenceBand: telemetry.confidenceBand,
            payloadCompleteness: telemetry.payloadCompleteness,
            actionType: String(action?.type || "unknown"),
          });
        })
        .filter(Boolean);

      if (generatedEvents.length > 0) {
        await Promise.all(generatedEvents as Array<Promise<unknown>>);
      }
    } catch (telemetryErr) {
      console.error("[Scout] failed to log outcome generation telemetry", telemetryErr);
    }

    const clientSafeMetadata = getClientSafeScoutMetadata(aiResponse.metadata);
    const safeMetadata = clientSafeMetadata
      ? {
          intent: clientSafeMetadata.intent,
          sourceUsed: clientSafeMetadata.sourceUsed,
          attemptedSource: clientSafeMetadata.attemptedSource,
          fallbackUsed: clientSafeMetadata.fallbackUsed,
          degradationReason: clientSafeMetadata.degradationReason,
          confidenceBand: clientSafeMetadata.confidenceBand,
          currentJobId: clientSafeMetadata.currentJobId,
          resolvedContext: clientSafeMetadata.resolvedContext ?? null,
        }
      : undefined;

    await syncObjectiveBestEffort({ intent: synthesized.intent });
    scoutTurnTelemetry.provider = synthesized.provider || "fallback";
    scoutTurnTelemetry.sourceUsed = sourceAudit.sourceUsed;
    scoutTurnTelemetry.fallbackUsed =
      Boolean(sourceAudit.fallbackUsed) || scoutTurnTelemetry.provider === "fallback";
    scoutTurnTelemetry.degradationReason =
      synthesized.degradationReason ?? sourceAudit.degradationReason;
    if (scoutTurnTelemetry.provider === "fallback" && scoutTurnTelemetry.failureClass === "none") {
      scoutTurnTelemetry.failureClass = "provider_fallback";
    }

    if (hasPrimaryPrefillAction || hasPrimaryClarificationAction) {
      const isProviderHighConfidenceReturn =
        isClearProviderServiceIntent(String(message || "")) &&
        (safeMetadata?.confidenceBand === "high" ||
          inferSourceConfidenceBand(governorDecision.confidence) === "high");

      const clarificationPrompt =
        hasPrimaryClarificationAction && typeof primaryGuardedAction?.prompt === "string"
          ? String(primaryGuardedAction.prompt).trim()
          : "";

      const lockedMessage = hasPrimaryClarificationAction
        ? clarificationPrompt || "Got it - let's narrow this down so I can guide you right."
        : isProviderHighConfidenceReturn
          ? "Start a request below."
          : String(aiResponse.message || finalMessage || "")
              .replace(/\s+/g, " ")
              .trim() || "I prepared your next step with the details ready to review.";

      console.log("FINAL RESPONSE", {
        hasAction: guardedActions.length > 0,
        primaryType: primaryGuardedAction?.type || null,
      });

      return res.json({
        message: lockedMessage,
        suggestedActions: aiResponse.suggestedActions ?? [],
        actions: guardedActions,
        actionResults: [],
        overrideOption: aiResponse.overrideOption,
        frame: aiResponse.frame,
        workingContext: aiResponse.workingContext,
        sponsored: aiResponse.sponsored ?? null,
        publicEntities: aiResponse.publicEntities ?? [],
        ctaHints: aiResponse.ctaHints ?? [],
        metadata: safeMetadata,
        guardContext: {
          canRetry: true,
          recoveryAvailable: true,
        },
        knowledge: {
          layer: knowledge.layer,
          sources: responseKnowledgeSources,
          confidence: knowledge.confidence,
        },
        llmProvider: synthesized.provider || "fallback",
        promptVersion,
        timestamp: new Date().toISOString(),
        onboarding: onboardingMeta.onboardingQuestion ? onboardingMeta : undefined,
      });
    }

    return res.json({
      message: finalMessage,
      suggestedActions: aiResponse.suggestedActions ?? [],
      actions: guardedActions,
      actionResults: [],
      overrideOption: aiResponse.overrideOption,
      frame: aiResponse.frame,
      workingContext: aiResponse.workingContext,
      sponsored: aiResponse.sponsored ?? null,
      publicEntities: aiResponse.publicEntities ?? [],
      ctaHints: aiResponse.ctaHints ?? [],
      metadata: safeMetadata,
      guardContext: {
        canRetry: true,
        recoveryAvailable: true,
      },
      knowledge: {
        layer: knowledge.layer,
        sources: responseKnowledgeSources,
        confidence: knowledge.confidence,
      },
      llmProvider: synthesized.provider || "fallback",
      promptVersion,
      timestamp: new Date().toISOString(),
      onboarding: onboardingMeta.onboardingQuestion ? onboardingMeta : undefined,
    });
  } catch (error) {
    if (!isTestRun && scoutInteractionLog) {
      scoutInteractionLog.outcome = "blocked";
      scoutInteractionLog.failureReason = ensureFailureReason(
        scoutInteractionLog.failureReason || "no_route"
      );
    }
    scoutTurnTelemetry.provider = "unavailable";
    scoutTurnTelemetry.sourceUsed = "exception_handler";
    scoutTurnTelemetry.failureClass = "system_error";
    scoutTurnTelemetry.fallbackUsed = false;
    console.error("Scout API error:", error);
    return res.status(503).json(
      buildScoutUnavailableResponse({
        promptVersion: loadSystemPrompt().version,
        requestId: ((req as any)?.requestId as string | undefined) || null,
      })
    );
  }
});

/**
 * Unified Scout routing endpoints
 * POST /api/scout/routing/*
 */
router.post("/routing/resolve-intent", async (req: Request, res: Response) => {
  try {
    const intent = typeof req.body?.intent === "string" ? req.body.intent : "";
    const trimmedIntent = intent.trim();
    if (!trimmedIntent) {
      return res.status(400).json({ error: "Intent is required" });
    }

    const userContext = buildUnifiedRouterContext(req, req.body?.userContext);
    const options = buildUnifiedRoutingOptions(req, req.body);
    const decision = UnifiedScoutRouter.resolveIntent(trimmedIntent, userContext, options);
    if (!decision) {
      return res.json({
        action: {
          type: "NAVIGATE",
          to: "/direct-connect",
          label: "Open Direct Connect",
        },
        confidence: 0.4,
        reasoning: "No deterministic match; using server fallback routing.",
        sourceLayer: "fallback",
      });
    }

    return res.json(decision);
  } catch (error) {
    console.error("[scout.routing.resolve-intent] error", error);
    return res.status(500).json({ error: "Failed to resolve intent" });
  }
});

router.post("/routing/validate-action", async (req: Request, res: Response) => {
  try {
    const action = req.body?.action;
    if (!action || typeof action.type !== "string") {
      return res.status(400).json({ error: "Action type is required" });
    }

    const userContext = buildUnifiedRouterContext(req, req.body?.userContext);
    const validation = UnifiedScoutRouter.validateAction(action, userContext);
    return res.json(validation);
  } catch (error) {
    console.error("[scout.routing.validate-action] error", error);
    return res.status(500).json({ error: "Failed to validate action" });
  }
});

router.post("/routing/discover-features", async (req: Request, res: Response) => {
  try {
    const query = typeof req.body?.query === "string" ? req.body.query : "";
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return res.status(400).json({ error: "Query is required" });
    }

    const userContext = buildUnifiedRouterContext(req, req.body?.userContext);
    const options = buildUnifiedRoutingOptions(req, req.body);
    const features = UnifiedScoutRouter.discoverFeatures(trimmedQuery, userContext, options);
    return res.json(features);
  } catch (error) {
    console.error("[scout.routing.discover-features] error", error);
    return res.status(500).json({ error: "Failed to discover features" });
  }
});

router.post("/routing/generate-fallback", async (req: Request, res: Response) => {
  try {
    const originalIntent =
      typeof req.body?.originalIntent === "string" ? req.body.originalIntent : "";
    const failureReason =
      typeof req.body?.failureReason === "string" ? req.body.failureReason : "route_unmatched";
    const userContext = buildUnifiedRouterContext(req, req.body?.userContext);

    const actions = UnifiedScoutRouter.generateFallbackActions(
      originalIntent,
      failureReason,
      userContext
    );
    return res.json(actions);
  } catch (error) {
    console.error("[scout.routing.generate-fallback] error", error);
    return res.status(500).json({ error: "Failed to generate fallback actions" });
  }
});

/**
 * Objective onboarding bundle endpoint
 * POST /api/scout/onboarding/objective-bundle
 */
router.post("/onboarding/objective-bundle", async (req: Request, res: Response) => {
  try {
    const authUser = (req as any)?.user;
    const userId =
      typeof authUser?.id === "string"
        ? authUser.id
        : typeof req.body?.userId === "string"
          ? req.body.userId
          : "guest";

    const role =
      typeof authUser?.role === "string"
        ? authUser.role
        : typeof req.body?.role === "string"
          ? req.body.role
          : undefined;

    const bundle = ScoutObjectiveOnboarding.buildBundle({
      userId,
      role,
      countyFips: typeof req.body?.countyFips === "string" ? req.body.countyFips : undefined,
      stateCode: typeof req.body?.stateCode === "string" ? req.body.stateCode : undefined,
      seasonHint:
        req.body?.seasonHint === "spring" ||
        req.body?.seasonHint === "summer" ||
        req.body?.seasonHint === "fall" ||
        req.body?.seasonHint === "winter"
          ? req.body.seasonHint
          : undefined,
      objectiveStates: Array.isArray(req.body?.objectiveStates) ? req.body.objectiveStates : [],
    });

    return res.json(bundle);
  } catch (error) {
    console.error("[scout.onboarding.objective-bundle] error", error);
    return res.status(500).json({ error: "Failed to build onboarding bundle" });
  }
});

/**
 * Proactive success watchdog endpoint
 * POST /api/scout/watchdog/evaluate
 */
router.post("/watchdog/evaluate", async (req: Request, res: Response) => {
  try {
    const authUser = (req as any)?.user;
    const userId =
      typeof authUser?.id === "string"
        ? authUser.id
        : typeof req.body?.snapshot?.userId === "string"
          ? req.body.snapshot.userId
          : "guest";

    const snapshotBody =
      req.body?.snapshot && typeof req.body.snapshot === "object"
        ? req.body.snapshot
        : ({} as Record<string, unknown>);

    const snapshot = {
      userId,
      role:
        typeof authUser?.role === "string"
          ? authUser.role
          : typeof snapshotBody.role === "string"
            ? snapshotBody.role
            : undefined,
      countyFips:
        typeof snapshotBody.countyFips === "string"
          ? (snapshotBody.countyFips as string)
          : undefined,
      lastActiveAt:
        typeof snapshotBody.lastActiveAt === "string"
          ? (snapshotBody.lastActiveAt as string)
          : undefined,
      objectives: Array.isArray(snapshotBody.objectives) ? (snapshotBody.objectives as any[]) : [],
      events: Array.isArray(snapshotBody.events) ? (snapshotBody.events as any[]) : [],
    };

    const now =
      typeof req.body?.now === "string" || req.body?.now instanceof Date
        ? new Date(String(req.body.now))
        : new Date();

    const result = ScoutProactiveWatchdog.evaluate(snapshot as any, now);
    return res.json(result);
  } catch (error) {
    console.error("[scout.watchdog.evaluate] error", error);
    return res.status(500).json({ error: "Failed to evaluate user success watchdog" });
  }
});

/**
 * Tone-aware response builder endpoint
 * POST /api/scout/tone/build
 */
router.post("/tone/build", async (req: Request, res: Response) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message : "";
    if (!message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    const result = ScoutToneAwareBuilder.build({
      scenario:
        req.body?.scenario === "default" ||
        req.body?.scenario === "technical_fallback" ||
        req.body?.scenario === "confidence_low" ||
        req.body?.scenario === "blocked_action" ||
        req.body?.scenario === "next_step_prompt"
          ? req.body.scenario
          : "default",
      message,
      countyLabel: typeof req.body?.countyLabel === "string" ? req.body.countyLabel : undefined,
      roleLabel: typeof req.body?.roleLabel === "string" ? req.body.roleLabel : undefined,
      confidenceBand:
        req.body?.confidenceBand === "low" ||
        req.body?.confidenceBand === "medium" ||
        req.body?.confidenceBand === "high"
          ? req.body.confidenceBand
          : undefined,
      includeNextStep:
        typeof req.body?.includeNextStep === "boolean" ? req.body.includeNextStep : undefined,
      nextStepLabel:
        typeof req.body?.nextStepLabel === "string" ? req.body.nextStepLabel : undefined,
      nextStepRoute:
        typeof req.body?.nextStepRoute === "string" ? req.body.nextStepRoute : undefined,
    });

    return res.json(result);
  } catch (error) {
    console.error("[scout.tone.build] error", error);
    return res.status(500).json({ error: "Failed to build tone-aware response" });
  }
});

/**
 * Trust metadata enrichment endpoint for decision cards
 * POST /api/scout/trust/enrich-routing
 */
router.post("/trust/enrich-routing", async (req: Request, res: Response) => {
  try {
    const decision = req.body?.decision;
    if (!decision || typeof decision !== "object" || typeof decision.action?.type !== "string") {
      return res.status(400).json({ error: "Routing decision with action is required" });
    }

    const trust = buildServerTrustContext(req);
    const enriched = ScoutTrustIntegration.attachTrustMetadata(decision, trust);
    return res.json(enriched);
  } catch (error) {
    console.error("[scout.trust.enrich-routing] error", error);
    return res.status(500).json({ error: "Failed to enrich routing with trust metadata" });
  }
});

/**
 * Execute guarded action endpoint
 * POST /api/scout/execute-action
 *
 * Allows frontend to execute Scout actions through the error guard.
 * Automatically recovers from common errors without exposing internals.
 */
router.post("/execute-action", async (req: Request, res: Response) => {
  try {
    const { action, guardContext: clientGuardContext } = req.body;
    const userId = (req as any).user?.id || (req as any).user?.claims?.sub;

    const actionTelemetry = resolveOutcomeActionTelemetry(action);

    if (!action || !action.type) {
      return res.status(400).json({
        success: false,
        message: "Action type required",
      });
    }

    const guestSafeActions = new Set([
      "NAVIGATE",
      "OPEN_APP_DRAWER",
      "OPEN_TOOLS_DRAWER",
      "PREFILL_INPUT",
      "ASK_SCOUT",
      "EXTERNAL_LINK",
      "CALL_TOOL",
      "NOOP",
    ]);
    if (!userId && !guestSafeActions.has(String(action.type))) {
      return res.status(401).json({
        success: false,
        message: "Sign in is required for this action",
      });
    }

    // Unified router pre-validation: deterministic guardrail before deeper execution.
    const routingContext = buildUnifiedRouterContext(req, req.body?.userContext);
    const routingValidation = UnifiedScoutRouter.validateAction(action, routingContext);
    if (!routingValidation.valid) {
      const statusCode = routingValidation.metadata?.requiresAuth ? 401 : 403;
      return res.status(statusCode).json({
        success: false,
        message: routingValidation.reason || "This action is blocked right now.",
        metadata: routingValidation.metadata,
      });
    }

    // Reconstruct guard context from request
    const guardContext: ScoutActionContext = {
      userId,
      userProfile: clientGuardContext?.userProfile,
      sessionId: (req as any).sessionId,
      requestId: (req as any).requestId,
    };

    if (actionTelemetry) {
      try {
        await storage.logEvent("scout_outcome_action_clicked", {
          userId: userId || null,
          requestId: (req as any).requestId || null,
          ownerModule: actionTelemetry.ownerModule,
          target: actionTelemetry.target,
          confidenceBand: actionTelemetry.confidenceBand,
          payloadCompleteness: actionTelemetry.payloadCompleteness,
          actionType: String(action?.type || "unknown"),
        });
      } catch (telemetryErr) {
        console.error("[Scout] failed to log outcome click telemetry", telemetryErr);
      }
    }

    if (action.type !== "SAVE_PROFILE") {
      return res.json({
        success: true,
        authorized: true,
        executed: false,
        message: "Action authorized for client execution",
      });
    }

    // Execute action through guard
    const result = await runScoutAction(action, guardContext, async (act) => {
      if (act.type !== "SAVE_PROFILE") {
        throw new Error("Unsupported server action");
      }
      if (!userId) {
        throw new Error("Authentication required to update profile");
      }

      const { profilePatch, preferencesPatch } = sanitizeScoutProfileUpdatePayload(act.payload);
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        throw new Error("User not found");
      }

      const hasProfilePatch = Object.keys(profilePatch).length > 0;
      const hasPreferencesPatch = Object.keys(preferencesPatch).length > 0;
      if (!hasProfilePatch && !hasPreferencesPatch) {
        throw new Error("No allowed profile fields provided");
      }

      const user = await storage.updateUser(userId, {
        ...profilePatch,
        ...(hasPreferencesPatch
          ? { preferences: { ...(currentUser.preferences || {}), ...preferencesPatch } }
          : {}),
        profileVersion: CURRENT_PROFILE_VERSION,
        updatedAt: new Date(),
      });

      return {
        executed: true,
        action: act.type,
        updatedFields: [
          ...Object.keys(profilePatch),
          ...Object.keys(preferencesPatch).map((key) => `preferences.${key}`),
        ],
        userId: user.id,
      };
    });

    if (result.ok) {
      if (actionTelemetry) {
        try {
          await storage.logEvent("scout_outcome_action_submitted", {
            userId: userId || null,
            requestId: (req as any).requestId || null,
            ownerModule: actionTelemetry.ownerModule,
            target: actionTelemetry.target,
            confidenceBand: actionTelemetry.confidenceBand,
            payloadCompleteness: actionTelemetry.payloadCompleteness,
            actionType: String(action?.type || "unknown"),
          });
        } catch (telemetryErr) {
          console.error("[Scout] failed to log outcome submission telemetry", telemetryErr);
        }
      }
      return res.json({
        success: true,
        authorized: true,
        executed: true,
        message: result.message || "Action completed",
        data: result.data,
        nextAction: (result as any).nextAction,
      });
    }

    // Action failed—return recovery guidance
    return res.status(400).json({
      success: false,
      message: result.error.userMessage,
      errorType: result.error.type,
      suggestedAction: result.error.suggestedAction,
      context: result.error.context,
    });
  } catch (err) {
    console.error("[Scout Action] Unhandled error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to execute action. Let's try a different approach.",
      requestId: (req as any).requestId || null,
    });
  }
});

registerScoutOpsRoutes(router, {
  getKnowledgeBaseStatus,
  loadSystemPrompt,
  generateAutoPrompt: () => generateAutoPrompt(geminiClient),
});

registerScoutAdminRoutes(router, {
  getGeminiFallbackRuntimeState,
  getLlmProviderFailoverRuntimeState,
  getAnalytics,
  getAuditLog,
});

export default router;
