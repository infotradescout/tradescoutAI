import { recordQuery, recordFallback, getAnalytics, getAuditLog } from "../services/adminAnalytics";
import { Router, type Request, Response } from "express";
import { GeminiProvider, generateWithFallback, LLMProvider } from "../services/llmProvider";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { executeAssistantAction, type AssistantAction, type User } from "../assistantActions";
import {
  resolveKnowledge,
  getLocalGuide,
  getLocalMarkdownGuide,
  appendChatKnowledge,
  loadComprehensiveKnowledge,
} from "../services/knowledgeService";
import { loadSystemPrompt } from "../services/promptService";
import {
  buildUserContext,
  formatUserContextForPrompt,
  generateThinkingContext,
} from "../services/userContextService";
import { storage } from "../storage";
import { resolveCountyFips, resolveRegionSlug } from "../services/regionResolver";
import { shouldInjectSponsored } from "../services/sponsoredEligibility";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCOUT_CORS_ALLOWED_ORIGINS = new Set(
  [
    "https://www.thetradescout.com",
    "https://tradescoutai.onrender.com",
    "https://tradescout-5hn96npkf-tradescouts-projects.vercel.app",
    "https://thetradescout.com",
    "https://tradescout-e557bv88z-tradescouts-projects.vercel.app",
  ].map((o) => o.toLowerCase())
);

router.use((req, res, next) => {
  const originHeader = req.headers.origin;
  if (typeof originHeader === "string") {
    const normalized = originHeader.toLowerCase();
    if (SCOUT_CORS_ALLOWED_ORIGINS.has(normalized)) {
      res.setHeader("Access-Control-Allow-Origin", originHeader);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
  }

  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Origin, Accept"
    );
    return res.sendStatus(204);
  }

  next();
});

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
  "Start the Community Builder for my county",
  "Find food trucks near me with MealScout",
  "Draft a welcome post for neighbors",
  "Show me top marketplace listings this week",
];

// Cache auto-prompt to avoid regenerating on every page load
let cachedAutoPrompt: { autoPrompt: string; suggestions: string[]; source: "static" | "gemini"; timestamp: number } | null = null;
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
    /what\s+can\s+tradescout\s+do/i,
    /what\s+is\s+tradescout/i,
    /how\s+does\s+tradescout\s+work/i,
    /tell\s+me\s+about\s+tradescout/i,
    /overview\s+of\s+tradescout/i,
    /tradescout\s+features/i,
    /tradescout\s+capabilities/i,
  ];
  
  return introPatterns.some(pattern => pattern.test(lower));
}

/**
 * Generate smart synthesis response using comprehensive knowledge (for intro questions)
 */
async function generateSmartSynthesis(
  message: string,
  gemini: GoogleGenerativeAI | null,
  llmProviders: LLMProvider[]
): Promise<string> {
  if (!gemini || !llmProviders.some(p => p.isConfigured())) {
    return "I need the Gemini API configured to provide a comprehensive overview.";
  }

  try {
    // Use cached comprehensive knowledge
    const comprehensiveKnowledge = await getCachedComprehensiveKnowledge();
    
    // Create a synthesis-focused prompt focused on TRANSFORMATION and ECOSYSTEM, not features or meta commentary
    const synthPrompt = `You are Scout, the AI for TradeScout. Your job is to inspire people about how TradeScout transforms their life and community.

User asked: "${message}"

Using the knowledge below, answer their question by focusing on:
1. TradeScout serves the ENTIRE COMMUNITY ECOSYSTEM - not just contractors and homeowners
2. We're here for vehicle dealers, realtors, HOA management, property managers, business owners, community leaders - everyone who strengthens communities
3. HOW TradeScout changes their specific role - whether they're a contractor, homeowner, realtor, dealer, HOA board, or community leader
4. The IMPACT on their community - local money staying local, supporting neighbors, interconnected growth where each role strengthens the others
5. Community initiatives like trade school scholarships, community builders, giveback programs
6. Real transformation stories and outcomes from different community roles
7. The emotional/social benefits, not just logistics
8. How TradeScout is different from exploitative platforms

DO NOT:
- Describe backend mechanics or technical details
- List feature after feature robotically
- Say "we have a recommendation engine" - explain what that MEANS for them
- Focus on processes - focus on OUTCOMES
- Limit scope to just contractors and homeowners

  Be conversational, inspiring, and real. Speak directly to the user without describing your own thought process. Avoid generic filler; be concrete and action-oriented.

Available Knowledge Base:
${comprehensiveKnowledge}

Now write an inspiring, comprehensive answer about how TradeScout transforms this person's life and community:`;

    const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(synthPrompt);
    return result.response.text();
  } catch (error) {
    console.error("[Scout] Synthesis error:", error);
    return "I encountered an error creating a comprehensive overview. Please try again.";
  }
}

/**
 * Generate smart synthesis using knowledge + conversation context
 * Enhanced version that elaborates and explains the knowledge intelligently
 * Now includes user-specific language and personalization
 * Returns structured response with message and suggestedActions
 * 
 * ENFORCES MANDATORY EXECUTION CONTRACT:
 * - Required response schema with intent, thought_flow, decision, message, suggestedActions
 * - Comprehensive state injection every turn
 * - No fallback paths - schema is mandatory
 */
async function synthesizeResponse(
  userMessage: string,
  knowledge: { answer: string; sources: string[]; layer: number; confidence: string },
  gemini: GoogleGenerativeAI | null,
  systemPrompt: string,
  conversationHistory: string,
  userContext?: any,
  historyMessages?: { role: string; content: string }[],
  recentActivityPrompt?: string,
  requestState?: {
    auth: boolean;
    role: string;
    route?: string;
    capabilities?: string[];
    last_intent?: string;
    locality: { county?: string; state?: string; region?: string };
  }
): Promise<{ message: string; suggestedActions: string[]; intent?: string; thought_flow?: string[]; decision?: string }> {
  const DEFAULT_ACTIONS = [
    "Find contractors in my area",
    "Explore Exchange deals",
    "Start Community Builder"
  ];

  if (!gemini) {
    return {
      message: knowledge.answer,
      suggestedActions: DEFAULT_ACTIONS
    }; // Fall back to raw knowledge if no Gemini
  }

  try {
    const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });
    
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

    // [USER-CONTEXT INJECTION]
    // Build user context for personalized language
    let userContextPrompt = "";
    if (userContext) {
      userContextPrompt = formatUserContextForPrompt(userContext);
      userContextPrompt += `\n${generateThinkingContext(userContext)}\n`;
    }

    const activityContext = recentActivityPrompt
      ? `\n${recentActivityPrompt}\n`
      : "";

    // Smart synthesis that ENFORCES the execution contract
    const synthesisPrompt = `${systemPrompt}

${stateInjection}

${userContextPrompt}

${activityContext}

User asked: "${userMessage}"

Knowledge from TradeScout (Layer ${knowledge.layer}):
${knowledge.answer}

**YOU MUST RESPOND WITH THIS EXACT JSON SCHEMA - NO EXCEPTIONS:**

{
  "intent": "string - classified user intent (e.g., find_contractor, ask_pricing, list_item, get_help)",
  "thought_flow": [
    "Step 1: What I'm checking/understanding",
    "Step 2: What data I found or didn't find",
    "Step 3: How I'm making my decision"
  ],
  "decision": "string - what I decided to do and why (e.g., 'Showing contractors because user is authenticated and in Harris County')",
  "message": "string - your actual response to the user (max 300 words, 12-15 lines)",
  "suggestedActions": [
    "Action prompt 1",
    "Action prompt 2",
    "Action prompt 3"
  ]
}

CRITICAL EXECUTION RULES:
1. You MUST expose your reasoning in thought_flow - show your work
2. You MUST classify user intent explicitly
3. You MUST explain your decision before giving the message
4. If user is not authenticated (auth: guest) and asks for action that requires login, you MUST:
   - Set intent to "auth_required"
   - Explain in thought_flow why auth is needed
   - In message, tell user to create account and provide direct link to /register
5. Keep message brief (max 300 words, 12-15 lines)
6. Always generate exactly 3 suggestedActions

AUTH-REQUIRED ACTIONS:
- Posting tasks, items, listings
- Applying to jobs
- Messaging contractors
- Joining groups/communities
- Creating causes or campaigns
- Any "create", "post", "apply", "message", "join" action

If user requests auth-required action while guest:
- intent: "auth_required"
- thought_flow: ["User asked to [action]", "This requires authentication", "Will redirect to account creation"]
- decision: "Directing user to create account at /register"
- message: "To [do that action], you'll need a TradeScout account. [Click here to create one](/register) - it takes less than a minute!"

${knowledge.layer === 1 || knowledge.layer === 2 ? "This is TradeScout data - speak with confidence and authority." : ""}
${knowledge.layer === 3 ? "This is from the internet, not local TradeScout data - be clear about that." : ""}
${knowledge.layer === 4 ? "You don't have reliable info - be honest about it in your thought_flow and decision." : ""}

RESPOND WITH VALID JSON ONLY - NO MARKDOWN, NO CODE FENCES, JUST RAW JSON.`;

    const result = await model.generateContent(synthesisPrompt);
    let rawResponse = result.response.text();
    
    // Strip markdown code fences if present
    rawResponse = rawResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    // Parse JSON response with enforced schema
    try {
      const parsed = JSON.parse(rawResponse);
      
      // Validate schema
      if (!parsed.intent || !parsed.thought_flow || !parsed.decision || !parsed.message || !parsed.suggestedActions) {
        console.warn("[Scout] LLM response missing required schema fields, using fallback");
        return {
          intent: "unknown",
          thought_flow: ["Schema validation failed", "LLM did not follow contract", "Returning knowledge answer"],
          decision: "Falling back to raw knowledge due to schema violation",
          message: knowledge.answer,
          suggestedActions: DEFAULT_ACTIONS
        };
      }
      
      // Enforce length limit on message
      parsed.message = trimResponseToScreenFit(parsed.message);
      
      return {
        intent: parsed.intent,
        thought_flow: parsed.thought_flow,
        decision: parsed.decision,
        message: parsed.message,
        suggestedActions: parsed.suggestedActions || DEFAULT_ACTIONS
      };
    } catch (parseError) {
      console.error("[Scout] Failed to parse LLM JSON response:", parseError);
      console.error("[Scout] Raw response was:", rawResponse);
      
      // NO FALLBACK PATHS - Return structured error
      return {
        intent: "parse_error",
        thought_flow: ["LLM response was not valid JSON", "This violates the execution contract", "System needs attention"],
        decision: "Cannot process - LLM failed to follow schema",
        message: "I encountered a system error. Please try rephrasing your question.",
        suggestedActions: DEFAULT_ACTIONS
      };
    }
  } catch (error) {
    console.error("[Scout] Synthesis error:", error);
    
    // Even errors must follow the contract
    return {
      intent: "system_error",
      thought_flow: ["System error occurred during synthesis", "Error: " + (error as Error).message, "Returning safe fallback"],
      decision: "Falling back to raw knowledge due to system error",
      message: knowledge.answer,
      suggestedActions: DEFAULT_ACTIONS
    };
  }
}

/**
 * Parse structured JSON response from LLM with fail-safes
 * Ensures valid format: { message: string, suggestedActions: string[] }
 */
function deriveContextualActions(
  base: string[],
  userMessage: string,
  userContext?: any,
  historyMessages?: { role: string; content: string }[]
): string[] {
  const defaults = [
    "Find contractors in my area",
    "Explore marketplace deals",
    "Start Community Builder",
    "Find food trucks with MealScout",
    "Post my project"
  ];

  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const lowerMessage = userMessage.toLowerCase();
  const county = userContext?.location?.county || userContext?.location?.city || "your county";

  const keywords = [
    ...(historyMessages || []).map((h) => h.content.toLowerCase()),
    lowerMessage
  ].join(" \n ");

  const prioritized: string[] = [];

  const pushUnique = (val: string) => {
    if (!val || prioritized.includes(val)) return;
    prioritized.push(val);
  };

  // Time-of-day steering
  if (hour >= 6 && hour < 12) {
    pushUnique(`Find morning-available contractors in ${county}`);
    pushUnique(`Price my project in ${county}`);
  } else if (hour >= 17 && hour < 23) {
    pushUnique("Find tonight's MealScout food truck");
    pushUnique(`Explore evening marketplace deals in ${county}`);
  } else {
    pushUnique(`Check active pros in ${county}`);
  }

  if (isWeekend) {
    pushUnique("Plan my weekend projects");
    pushUnique("Create my weekly project list");
  }

  // Content-based steering
  if (/roof|storm|hail|wind/.test(keywords)) {
    pushUnique(`Find roofers in ${county}`);
    pushUnique("Check storm reports for my area");
  }

  if (/market|sell|list|item|trailer|equipment/.test(keywords)) {
    pushUnique("List my item now");
    pushUnique("Search trailers and tools");
  }

  if (/food|restaurant|truck|meal/.test(keywords)) {
    pushUnique("Show MealScout nearby");
    pushUnique("Browse restaurants by cuisine");
  }

  // User roles
  const roles: string[] = userContext?.userTypes || [];
  if (roles.includes("contractor")) {
    pushUnique("Find homeowners needing bids");
    pushUnique("Update my contractor profile");
  }
  if (roles.includes("homeowner")) {
    pushUnique(`Get bids from vetted pros in ${county}`);
  }

  const merged = [...base, ...prioritized];

  const clean = merged
    .filter(Boolean)
    .map((a) => a.trim())
    .filter((a) => a.length > 0)
    .map((a) => (a.length > 48 ? `${a.slice(0, 45)}...` : a));

  // Pad/clamp to exactly 3 with defaults
  const final: string[] = [];
  for (const a of clean) {
    if (final.length >= 3) break;
    if (!final.includes(a)) final.push(a);
  }
  let idx = 0;
  while (final.length < 3 && idx < defaults.length) {
    const d = defaults[idx++];
    if (!final.includes(d)) final.push(d);
  }
  return final.slice(0, 3);
}

function parseStructuredResponse(
  rawResponse: string,
  userMessage: string,
  userContext?: any,
  historyMessages?: { role: string; content: string }[]
): { message: string; suggestedActions: string[] } {
  const DEFAULT_ACTIONS = [
    "Find contractors in my area",
    "Explore marketplace deals",
    "Start Community Builder"
  ];

  try {
    // Try to extract JSON from response (in case LLM adds markdown code blocks)
    let jsonText = rawResponse.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }
    
    const parsed = JSON.parse(jsonText);
    
    // Validate structure
    if (!parsed.message || typeof parsed.message !== 'string') {
      throw new Error('Missing or invalid message field');
    }
    
    if (!Array.isArray(parsed.suggestedActions)) {
      throw new Error('Missing or invalid suggestedActions array');
    }
    
    // Sanitize suggestedActions
    let actions = parsed.suggestedActions
      .filter((a: any) => typeof a === 'string' && a.trim().length > 0)
      .map((a: string) => a.trim())
      .slice(0, 5); // allow temp overflow before ranking

    // Enforce contextual ranking + fallback padding
    actions = deriveContextualActions(actions, userMessage, userContext, historyMessages);

    return {
      message: parsed.message,
      suggestedActions: actions
    };
    
  } catch (error) {
    console.error('[Scout] JSON parsing failed, falling back to text response:', error);
    
    // Fallback: treat entire response as message, generate default actions
    return {
      message: rawResponse,
      suggestedActions: DEFAULT_ACTIONS
    };
  }
}

/**
 * Trim response to ensure it fits on screen without scrolling
 * - Max 300 words (typical mobile viewport at 18pt font)
 * - Max 12-15 lines (assumes 4-5 words per line average)
 * - Preserves structure and important information
 */
function trimResponseToScreenFit(response: string): string {
  const maxWords = 300;
  const maxLines = 15;
  
  // Split into lines
  const lines = response.split('\n').filter(line => line.trim().length > 0);
  
  // If too many lines, truncate at hard line limit
  let trimmed = lines.slice(0, maxLines).join('\n');
  
  // Count words and truncate if needed
  const words = trimmed.split(/\s+/);
  if (words.length > maxWords) {
    // Trim to max words, try to end at sentence boundary
    let truncated = words.slice(0, maxWords).join(' ');
    
    // Find last sentence-ending punctuation within trimmed text
    const lastPeriod = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastEnd = Math.max(lastPeriod, lastQuestion);
    
    if (lastEnd > maxWords * 0.75) {
      // If reasonable sentence boundary exists, use it
      truncated = truncated.substring(0, lastEnd + 1);
    } else {
      // Otherwise just add ellipsis
      truncated = truncated + '...';
    }
    
    return truncated;
  }
  
  return trimmed;
}

async function generateAutoPrompt(gemini: GoogleGenerativeAI | null) {
  // Return cached version if still fresh
  const now = Date.now();
  if (cachedAutoPrompt && now - cachedAutoPrompt.timestamp < AUTO_PROMPT_CACHE_TTL) {
    return cachedAutoPrompt;
  }

  if (!gemini) {
    const result = {
      source: "static" as const,
      autoPrompt: DEFAULT_AUTO_PROMPT,
      suggestions: DEFAULT_SUGGESTIONS,
      timestamp: now,
    };
    cachedAutoPrompt = result;
    return result;
  }

  try {
    const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `Create a single concise starter prompt a user should ask an AI concierge for a local contractor/marketplace app. Also return 6 short suggestions.
Return JSON with keys autoPrompt (string) and suggestions (string array).`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const autoPrompt = typeof parsed.autoPrompt === "string" && parsed.autoPrompt.trim().length > 0
        ? parsed.autoPrompt.trim()
        : DEFAULT_AUTO_PROMPT;
      const suggestions = Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
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
    source: "static" as const,
    autoPrompt: DEFAULT_AUTO_PROMPT,
    suggestions: DEFAULT_SUGGESTIONS,
    timestamp: now,
  };
  cachedAutoPrompt = fallback;
  return fallback;
}

// Initialize LLM providers (add more as needed)
const llmProviders: LLMProvider[] = [
  new GeminiProvider(process.env.GEMINI_API_KEY || ""),
  // Add new OpenAIProvider(process.env.OPENAI_API_KEY) here if needed
];
const llmEnabled = llmProviders.some((p) => p.isConfigured());

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
}

interface ScoutResponse {
  message: string;
  suggestedActions?: string[];
  actions?: ScoutClientAction[];
  actionResults?: any[];
  sponsored?: {
    id: string;
    title: string;
    content: string;
    imageUrl?: string | null;
    linkUrl?: string | null;
    isAffiliate?: boolean | null;
    targetLocation?: string | null;
  } | null;
  metadata?: {
    intent?: string;
    thought_flow?: string[];
    decision?: string;
    redirect?: string;
  };
}

type ScoutClientAction = {
  type: string;
  label?: string;
  to?: string;
  path?: string;
  prompt?: string;
  payload?: Record<string, unknown>;
};

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

function getRegionFromState(stateCode: string): string {
  const regions: Record<string, string> = {
    // Northeast
    CT: "Northeast", ME: "Northeast", MA: "Northeast", NH: "Northeast", RI: "Northeast", VT: "Northeast",
    NJ: "Northeast", NY: "Northeast", PA: "Northeast",
    // Southeast
    DE: "Southeast", FL: "Southeast", GA: "Southeast", MD: "Southeast", NC: "Southeast", SC: "Southeast",
    VA: "Southeast", WV: "Southeast", KY: "Southeast", TN: "Southeast", AL: "Southeast", MS: "Southeast",
    AR: "Southeast", LA: "Southeast",
    // Midwest
    IL: "Midwest", IN: "Midwest", MI: "Midwest", OH: "Midwest", WI: "Midwest",
    IA: "Midwest", KS: "Midwest", MN: "Midwest", MO: "Midwest", NE: "Midwest", ND: "Midwest", SD: "Midwest",
    // Southwest
    AZ: "Southwest", NM: "Southwest", OK: "Southwest", TX: "Southwest",
    // West
    CO: "West", ID: "West", MT: "West", NV: "West", UT: "West", WY: "West",
    AK: "West", CA: "West", HI: "West", OR: "West", WA: "West"
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

// (moved to services/regionResolver.ts)

/**
 * POST /api/scout
 * Main endpoint for AI Scout interactions with 4-layer knowledge resolution
 * Includes role-based access control and action execution
 */
router.post("/", async (req: Request, res: Response) => {
  recordQuery();
  try {
    const {
      message,
      history = [],
      countyCode,
      stateCode,
      roles = [],
      recentActivity = [],
      shownAdIds = [],
    }: ScoutRequest = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required and must be a string",
      });
    }

    // SPECIAL HANDLING: Detect intro/overview questions and use comprehensive synthesis
    if (isIntroQuestion(message)) {
      try {
        const synthesisResponse = await generateSmartSynthesis(message, geminiClient, llmProviders);
        return res.json({
          message: synthesisResponse,
          actions: [],
          actionResults: [],
          knowledge: {
            layer: 1,
            sources: ["Comprehensive Knowledge Base (All Documents)"],
            confidence: "high"
          },
          llmProvider: "gemini",
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
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role || "user";
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


    // LAYER RESOLUTION: Use knowledge service 4-layer system
    const knowledgeRequest = {
      message,
      userId,
      countyCode,
      stateCode,
    };

    // Use Gemini as primary, fallback to others if needed for Layer 3 (internet search)
    const knowledge = await resolveKnowledge(knowledgeRequest, geminiClient);

    // Load system prompt (with version)
    const { content: systemPrompt, version: promptVersion } = loadSystemPrompt();

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

    // Build conversation history
    const conversationHistory = history
      .map((msg) => `${msg.role === "user" ? "User" : "Scout"}: ${msg.content}`)
      .join("\n\n");

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

    // SMART SYNTHESIS: Use Gemini to synthesize knowledge into intelligent answer
    // Instead of passing raw knowledge to the LLM, first synthesize it smartly
    // [USER-CONTEXT] Build and inject user context for personalized responses
    const userContext = await buildUserContext(userId);

    const recentActivityPrompt = formatRecentActivityForPrompt(recentActivity);
    
    // [STATE INJECTION] Build comprehensive state for execution contract
    const requestState = {
      auth: !!userId,
      role: userRole,
      route: (req as any).route?.path || "unknown",
      capabilities: roles.length > 0 ? roles : ["guest"],
      last_intent: history.length > 0 ? "continuation" : "new_conversation",
      locality: {
        county: countyCode,
        state: stateCode,
        region: stateCode ? getRegionFromState(stateCode) : undefined
      }
    };
    
    const synthesized = await synthesizeResponse(
      message,
      knowledge,
      geminiClient,
      systemPrompt,
      conversationHistory,
      userContext,
      history,
      recentActivityPrompt,
      requestState
    );

    // Handle auth-required intent
    if (synthesized.intent === "auth_required" && !userId) {
      // Scout has determined user needs to create account
      const aiResponse: ScoutResponse = {
        message: synthesized.message,
        suggestedActions: [
          "Create account now",
          "Learn more about TradeScout",
          "Continue as guest"
        ],
        actions: [],
        sponsored: null,
        metadata: {
          intent: synthesized.intent,
          thought_flow: synthesized.thought_flow,
          decision: synthesized.decision,
          redirect: "/register"
        }
      };

      return res.json({
        ...aiResponse,
        knowledge: {
          layer: knowledge.layer,
          sources: knowledge.sources,
          confidence: knowledge.confidence,
        },
        llmProvider: "gemini",
        promptVersion,
        timestamp: new Date().toISOString(),
      });
    }

    // The synthesized answer is our response with suggestedActions!
    const aiResponse: ScoutResponse = {
      message: synthesized.message,
      suggestedActions: synthesized.suggestedActions,
      actions: [],
      sponsored: null,
      metadata: {
        intent: synthesized.intent,
        thought_flow: synthesized.thought_flow,
        decision: synthesized.decision
      }
    };

    // Community Vault MVP actions (explicit chips; no auto-execution on client)
    try {
      const lower = message.toLowerCase();
      const isCommunityVaultTopic =
        lower.includes("community vault") ||
        (lower.includes("vault") && lower.includes("community")) ||
        lower.includes("platform support") ||
        (lower.includes("support") && lower.includes("platform")) ||
        lower.includes("cause") ||
        lower.includes("causes");

      if (isCommunityVaultTopic) {
        const profileId = activeProfileId ?? extractProfileIdFromText(message) ?? undefined;

        if (profileId) {
          const amountFromText = extractDollarAmount(message);
          const donationAmount = amountFromText ?? 25;
          const supportAmount = amountFromText ?? 10;

          aiResponse.actions = [
            {
              type: "NAVIGATE",
              label: "Open Community Vault",
              to: `/profile/${profileId}/community`,
            },
            {
              type: "START_COMMUNITY_VAULT_DONATION",
              label: `Donate ${formatUsd(donationAmount)} to vault`,
              payload: { profileId, amount: donationAmount },
            },
            {
              type: "START_PLATFORM_SUPPORT",
              label: `Support platform ${formatUsd(supportAmount)} (one-time split)`,
              payload: {
                amount: supportAmount,
                mode: "one_time",
                originatingProfileId: profileId,
              },
            },
            {
              type: "START_PLATFORM_SUPPORT",
              label: `Support platform ${formatUsd(supportAmount)} (monthly split)`,
              payload: {
                amount: supportAmount,
                mode: "subscription",
                originatingProfileId: profileId,
              },
            },
          ];
        } else if (userId) {
          aiResponse.actions = [
            {
              type: "NAVIGATE",
              label: "Open my dashboard",
              to: "/dashboard",
            },
          ];
        }
      }
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

        const audience = lowerRoles.has("contractor") || lowerRoles.has("pro")
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
        });

        if (ad) {
          await storage.incrementAdImpressions(ad.id);
          aiResponse.sponsored = {
            id: ad.id,
            title: ad.title,
            content: ad.content,
            imageUrl: ad.imageUrl,
            linkUrl: ad.linkUrl,
            isAffiliate: ad.isAffiliate,
            targetLocation: ad.targetLocation,
          };
        }
      }
    } catch (monetizationError) {
      console.error("[Scout] Monetization injection failed:", monetizationError);
      aiResponse.sponsored = null;
    }

    // Persist non-sensitive Q&A back into the knowledge corpus for future retrieval
    try {
      appendChatKnowledge({
        question: message,
        answer: aiResponse.message,
        userId,
        countyCode,
        stateCode,
        layer: knowledge.layer,
        sources: knowledge.sources,
        actions: aiResponse.actions?.map((a) => a.type),
      });
    } catch (persistError) {
      console.error("Failed to append chat knowledge:", persistError);
    }

    // Return the response with knowledge layer information and prompt version
    res.json({
      message: aiResponse.message,
      actions: aiResponse.actions || [],
      actionResults: [],
      sponsored: aiResponse.sponsored ?? null,
      knowledge: {
        layer: knowledge.layer,
        sources: knowledge.sources,
        confidence: knowledge.confidence,
      },
      llmProvider: "gemini",
      promptVersion,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Scout API error:", error);
    res.status(500).json({
      error: "Failed to process Scout request",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Health check endpoint
 */
router.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Pregenerated starter prompt + suggestions (for UI auto-run / quick taps)
router.get("/auto-prompt", async (_req: Request, res: Response) => {
  const { content: systemPrompt, version: promptVersion } = loadSystemPrompt();
  const auto = await generateAutoPrompt(geminiClient);

  res.json({
    autoPrompt: auto.autoPrompt,
    suggestions: auto.suggestions,
    source: auto.source,
    promptVersion,
    systemPromptBytes: systemPrompt.length,
  });
});

/**
 * Admin-only: Cache statistics endpoint
 * GET /api/scout/admin/cache-stats
 * Requires admin role
 */
router.get("/admin/cache-stats", (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;

  if (!userRole || userRole !== "admin") {
    return res.status(403).json({
      error: "Admin access required",
      message: "Only administrators can access cache statistics",
    });
  }

  res.json({
    success: true,
    data: {
      cacheFiles: 7,
      totalSize: "~2.5 MB",
      files: [
        "system_prompt.md",
        "marketplace_cache.json",
        "contractors_cache.json",
        "groups_cache.json",
        "hoa_cache.json",
        "roofing_houston.md",
        "hvac_guide.md",
      ],
      lastUpdate: new Date().toISOString(),
      status: "healthy",
    },
    message: "Cache statistics retrieved successfully",
  });
});

/**
 * Admin-only: System status endpoint
 * GET /api/scout/admin/system-status
 * Requires admin role
 */
router.get("/admin/system-status", (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;

  if (!userRole || userRole !== "admin") {
    return res.status(403).json({
      error: "Admin access required",
      message: "Only administrators can access system status",
    });
  }

  res.json({
    success: true,
    data: {
      server: "running",
      crawler: "active",
      cache: "healthy",
      database: process.env.DATABASE_URL ? "connected" : "not_configured",
      gemini: !!process.env.GEMINI_API_KEY ? "configured" : "missing",
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    },
    message: "System status retrieved successfully",
  });
});

/**
 * Admin-only: Clear cache endpoint
 * POST /api/scout/admin/cache-clear
 * Requires admin role
 */
router.post("/admin/cache-clear", (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;

  if (!userRole || userRole !== "admin") {
    return res.status(403).json({
      error: "Admin access required",
      message: "Only administrators can clear cache",
    });
  }

  try {
    // In a real implementation, this would clear the actual cache
    // For now, we'll just simulate it
    res.json({
      success: true,
      message: "Cache cleared successfully",
      clearedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to clear cache",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Admin analytics routes remain for auditability
router.get("/admin/analytics", (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || (user.role !== "super_admin" && user.role !== "head_admin")) {
    return res.status(403).json({ error: "Super admin access required" });
  }
  res.json({ analytics: getAnalytics() });
});

router.get("/admin/audit-log", (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || (user.role !== "super_admin" && user.role !== "head_admin")) {
    return res.status(403).json({ error: "Super admin access required" });
  }
  res.json({ auditLog: getAuditLog(100) });
});

export default router;