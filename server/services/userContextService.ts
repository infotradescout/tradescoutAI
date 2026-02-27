/**
 * User Context Service - Enriches Scout responses with user-specific language
 * Builds personalized context from user type, location, and interaction history
 */

import { db } from "../db";
import { users, messages, conversations } from "@shared/schema";
import type { User } from "@shared/schema";
import { getUserTypeMetadata } from "@shared/userTypes";
import { eq, desc } from "drizzle-orm";

export interface UserProfile {
  id?: string;
  firstName?: string;
  lastName?: string;
  role?: string | null;
  types?: string[];
  city?: string | null;
  state?: string | null;
  county?: string | null;
  zipCode?: string | null;
  address?: string | null;
}

export interface UserContext {
  userId?: string;
  profile: UserProfile;
  userTypes: string[]; // Parsed from role field
  location: LocationContext;
  recentInteractions: RecentInteraction[];
  preferences: UserPreferences;
  languageProfile: LanguageProfile;
}

interface LocationContext {
  level: "city" | "county" | "state" | "unknown";
  city?: string;
  county?: string;
  state?: string;
  zipcode?: string;
  countyHint?: string; // Phase 3B: County FIPS code for jurisdiction-aware bias
}

interface RecentInteraction {
  type: "search" | "listing" | "contractor" | "community" | "builder" | "marketplace";
  topic: string;
  timestamp: Date;
  confidence: number;
}

interface UserPreferences {
  isBusiness: boolean;
  isContractor: boolean;
  isHomowner: boolean;
  isCommunityBuilder: boolean;
  isAffiliate: boolean;
}

interface LanguageProfile {
  formalityLevel: "casual" | "professional" | "formal";
  focusAreas: string[]; // What Scout should emphasize
  localTerms: string[]; // Local/regional terminology
  contextualHints: string[]; // Contextual language hints
}

type ConversationPerspective = "hire" | "work" | "unknown";

function inferConversationPerspective(message?: string | null): ConversationPerspective {
  const lower = String(message || "").toLowerCase();
  if (!lower.trim()) return "unknown";

  // Looking for work / leads
  const workSignals = [
    "leads",
    "clients",
    "customer acquisition",
    "get more jobs",
    "find jobs",
    "looking for work",
    "bid",
    "subcontract",
    "my business",
    "marketing",
  ];

  // Hiring / getting work done
  const hireSignals = [
    "hire",
    "quote",
    "estimate",
    "find a",
    "need a",
    "i need",
    "i want",
    "my house",
    "my home",
    "repair",
    "fix",
    "replace",
    "install",
    "build",
    "remodel",
  ];

  const hasWork = workSignals.some((s) => lower.includes(s));
  const hasHire = hireSignals.some((s) => lower.includes(s));

  if (hasWork && !hasHire) return "work";
  if (hasHire && !hasWork) return "hire";
  return "unknown";
}

/**
 * Normalize roles for any user:
 * - Uses multi-role array (user.roles) as the source of truth
 * - Falls back to legacy user.role
 * - Augments each role with metadata-driven tags so new roles "just work"
 */
function getNormalizedUserTypesFromUser(user: User): string[] {
  // Raw role ids from DB
  const arrayRoles = Array.isArray((user as any).roles) ? ((user as any).roles as string[]) : [];

  const legacyRole = user.role ? [user.role] : [];

  // Unique role IDs
  const roleIds = Array.from(new Set([...arrayRoles, ...legacyRole].filter(Boolean)));

  const tags = new Set<string>();

  for (const roleId of roleIds) {
    // Always include the raw id (e.g. "contractor", "realtor", "car_dealer")
    tags.add(roleId);

    const meta = getUserTypeMetadata(roleId);
    if (!meta) {
      // Unknown / future role without metadata yet: at least keep its id
      continue;
    }

    // Category tag (property, business, service, realestate, automotive, platform)
    tags.add(meta.category);

    // Default view ("homeowner" | "contractor" | "business" | "professional" | "admin")
    tags.add(meta.defaultView);

    // Feature flags become tags too (e.g. "find_contractors", "list_inventory")
    for (const feature of meta.features) {
      tags.add(feature);
    }
  }

  return Array.from(tags);
}

/**
 * Build comprehensive user context from user ID and recent interactions
 * Used to personalize LLM prompts with user-specific language
 * @param userId - User ID to fetch context for
 * @param countyHint - Optional county FIPS code for jurisdiction-aware bias (Phase 3B)
 */
export async function buildUserContext(
  userOrId?: string | User,
  countyHint?: string,
  opts?: { currentMessage?: string }
): Promise<UserContext> {
  const defaultContext: UserContext = {
    profile: {},
    userTypes: [],
    location: { level: "unknown" },
    recentInteractions: [],
    preferences: {
      isBusiness: false,
      isContractor: false,
      isHomowner: false,
      isCommunityBuilder: false,
      isAffiliate: false,
    },
    languageProfile: {
      formalityLevel: "casual",
      focusAreas: [],
      localTerms: [],
      contextualHints: [],
    },
  };

  const resolvedUserId =
    typeof userOrId === "string"
      ? userOrId
      : userOrId && typeof (userOrId as any).id === "string"
        ? String((userOrId as any).id)
        : undefined;

  if (!resolvedUserId) {
    return defaultContext;
  }

  try {
    // Fetch user profile
    const userRecords = await db.select().from(users).where(eq(users.id, resolvedUserId)).limit(1);

    if (!userRecords || userRecords.length === 0) {
      return defaultContext;
    }

    const user = userRecords[0];

    // 🔁 NEW: derive types from multi-role array + metadata
    const userTypes = getNormalizedUserTypesFromUser(user as User);

    // Preferences based on normalized types (handles future roles automatically)
    const preferences = buildUserPreferences(userTypes);

    // Build location context (with optional countyHint for jurisdiction-aware bias)
    const location = buildLocationContext(user, countyHint);

    // Fetch recent interactions (last 30 days)
    const recentInteractions = await fetchRecentInteractions(resolvedUserId);

    // Optional: use userTypes + location + interactions to drive tone.
    // CURRENT MESSAGE matters: don't assume a contractor's question is about lead-gen.
    const languageProfile = buildLanguageProfile(
      userTypes,
      location,
      recentInteractions,
      opts?.currentMessage
    );

    return {
      userId: resolvedUserId,
      profile: {
        id: user.id,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        role: user.role ?? undefined,
        types: userTypes,
        city: user.city ?? undefined,
        state: user.state ?? undefined,
        county: user.county ?? undefined,
        zipCode: (user as any).zipCode ?? undefined,
        address: user.address ?? undefined,
      },
      userTypes,
      location,
      recentInteractions,
      preferences,
      languageProfile,
    };
  } catch (error) {
    console.error("[UserContextService] Error building user context:", error);
    return defaultContext;
  }
}

/**
 * Parse user roles into specific types
 */
function parseUserRoles(roleString: string | null): string[] {
  if (!roleString) return [];

  const typeMap: Record<string, string[]> = {
    // Property owners
    homeowner: ["property_owner", "residential"],
    renter: ["residential"],
    landlord: ["property_owner", "commercial"],
    property_manager: ["property_manager", "commercial"],
    hoa_member: ["community", "residential"],

    // Contractors & service providers
    contractor: ["contractor", "service_provider"],
    handyman: ["contractor", "service_provider"],
    service_provider: ["service_provider"],
    specialty_tradesperson: ["contractor", "specialist"],
    designer: ["contractor", "specialist"],
    inspector: ["contractor", "specialist"],

    // Business
    business_owner: ["business", "commercial"],
    commercial_property: ["business", "commercial"],
    franchise_owner: ["business", "commercial"],
    startup_founder: ["business", "entrepreneur"],

    // Real estate & finance
    realtor: ["real_estate", "business"],
    mortgage_broker: ["finance", "business"],
    insurance_agent: ["finance", "business"],
    title_company: ["real_estate", "business"],

    // Automotive
    car_dealer: ["automotive", "business"],
    auto_service: ["service_provider", "automotive"],

    // Community
    community_builder: ["community", "builder"],
    nonprofit_org: ["community", "nonprofit"],

    // Platform roles
    affiliate: ["affiliate", "business"],
    content_creator: ["content", "business"],
    admin: ["admin"],
  };

  return typeMap[roleString] || [roleString];
}

/**
 * Build user preference flags from types
 * userTypes now contains:
 * - raw role ids ("contractor")
 * - categories ("business", "service", "realestate", etc.)
 * - default views ("homeowner", "contractor", "business", "professional", "admin")
 * - feature flags ("find_contractors", "manage_inventory", etc.)
 */
function buildUserPreferences(userTypes: string[]): UserPreferences {
  const hasTag = (...tags: string[]) => userTypes.some((t) => tags.includes(t));

  return {
    isBusiness: hasTag(
      "business",
      "commercial_property",
      "business_owner",
      "startup_founder",
      "franchise_owner"
    ),
    isContractor: hasTag("contractor", "service_provider", "specialty_tradesperson", "handyman"),
    isHomowner: hasTag("homeowner", "renter", "landlord", "property_manager"),
    isCommunityBuilder: hasTag("community_builder", "nonprofit_org", "hoa_member", "hoa_board"),
    isAffiliate: hasTag(
      "affiliate",
      "content_creator",
      "marketing_specialist",
      "analytics_specialist"
    ),
  };
}

/**
 * Build location context from user profile
 */
function buildLocationContext(user: any, countyHint?: string): LocationContext {
  // Phase 3B: If countyHint provided (FIPS code), prefer it for county-aware responses
  const effectiveCounty = countyHint || user.county;
  const effectiveCountyName = countyHint ? `County ${countyHint}` : user.county;

  if (user.city && user.state) {
    return {
      level: "city",
      city: user.city,
      state: user.state,
      county: effectiveCountyName,
      zipcode: user.zipcode,
      countyHint: countyHint, // Include hint for language/bias injection
    };
  }

  if (effectiveCounty && user.state) {
    return {
      level: "county",
      county: effectiveCountyName,
      state: user.state,
      zipcode: user.zipcode,
      countyHint: countyHint, // Include hint for language/bias injection
    };
  }

  if (user.state) {
    return {
      level: "state",
      state: user.state,
      zipcode: user.zipcode,
    };
  }

  return { level: "unknown" };
}

/**
 * Fetch recent user interactions from message history and conversations
 */
async function fetchRecentInteractions(userId: string): Promise<RecentInteraction[]> {
  try {
    const recentMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.senderId, userId))
      .orderBy(desc(messages.createdAt))
      .limit(20);

    const interactions: RecentInteraction[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Analyze message content for interaction patterns
    recentMessages.forEach((msg) => {
      const msgDate =
        msg.createdAt instanceof Date
          ? msg.createdAt
          : msg.createdAt
            ? new Date(msg.createdAt)
            : null;

      // Skip if message is too old or has no date
      if (!msgDate || msgDate < thirtyDaysAgo) {
        return;
      }

      const content = msg.content?.toLowerCase() || "";

      // Detect interaction types from content keywords
      if (
        content.includes("contractor") ||
        content.includes("roofer") ||
        content.includes("electrician") ||
        content.includes("plumber")
      ) {
        interactions.push({
          type: "contractor",
          topic: "Contractor search/inquiry",
          timestamp: msgDate as Date,
          confidence: 0.8,
        });
      } else if (
        content.includes("list") ||
        content.includes("sell") ||
        content.includes("marketplace") ||
        content.includes("for sale")
      ) {
        interactions.push({
          type: "marketplace",
          topic: "Marketplace listing",
          timestamp: msgDate as Date,
          confidence: 0.7,
        });
      } else if (
        content.includes("community") ||
        content.includes("neighbor") ||
        content.includes("local") ||
        content.includes("county")
      ) {
        interactions.push({
          type: "community",
          topic: "Community engagement",
          timestamp: msgDate as Date,
          confidence: 0.6,
        });
      } else if (
        content.includes("builder") ||
        content.includes("fundraise") ||
        content.includes("outreach")
      ) {
        interactions.push({
          type: "builder",
          topic: "Community Builder activity",
          timestamp: msgDate as Date,
          confidence: 0.8,
        });
      }
    });

    // Deduplicate and return top interactions
    const uniqueTypes = new Set<string>();
    return interactions.filter((i) => {
      if (uniqueTypes.has(i.type)) return false;
      uniqueTypes.add(i.type);
      return true;
    });
  } catch (error) {
    console.error("[UserContextService] Error fetching recent interactions:", error);
    return [];
  }
}

/**
 * Build language profile for personalized Scout responses
 */
function buildLanguageProfile(
  userTypes: string[],
  location: LocationContext,
  recentInteractions: RecentInteraction[],
  currentMessage?: string
): LanguageProfile {
  const focusAreas: string[] = [];
  const localTerms: string[] = [];
  const contextualHints: string[] = [];
  const perspective = inferConversationPerspective(currentMessage);

  // Formality level based on user type
  let formalityLevel: "casual" | "professional" | "formal" = "casual";
  if (userTypes.includes("contractor") || userTypes.includes("business")) {
    formalityLevel = "professional";
  }
  if (userTypes.includes("specialist") || userTypes.includes("finance")) {
    formalityLevel = "formal";
  }

  // Multi-hat guardrail: account tags are not the same as current intent.
  contextualHints.push(
    "Do not assume the user's perspective based on account tags alone (many users are both homeowners and contractors).",
    "Treat the CURRENT message as primary. If it's ambiguous, ask one clarifying question before giving a long answer."
  );

  // Focus areas based on current perspective first.
  if (perspective === "work") {
    focusAreas.push("service coverage", "quoting and scope clarity", "scheduling");
    contextualHints.push(
      "If the user is asking as a service provider, focus on process and trust signals (not marketing hype)."
    );
  } else if (perspective === "hire") {
    focusAreas.push("scope and requirements", "local matching", "pricing expectations");
    contextualHints.push(
      "If the user is trying to get work done, focus on scoping the job and routing into the correct next step (Direct Connect, Project Tracker, or community)."
    );
  } else if (userTypes.includes("contractor")) {
    focusAreas.push("next steps", "local context", "clear options");
    contextualHints.push(
      "If you can't tell whether the user is hiring or seeking work, ask: 'Are you trying to hire someone, or get leads for your business?'"
    );
  }

  if (userTypes.includes("property_owner")) {
    focusAreas.push("contractor network", "pricing context", "service quality");
    contextualHints.push(
      "Emphasize local expertise and hyperlocal pricing.",
      "Scout knows your county's service ecosystem."
    );
  }

  if (userTypes.includes("business")) {
    focusAreas.push("growth opportunities", "customer acquisition", "local market insights");
    contextualHints.push(
      "Highlight competitive advantages and market positioning.",
      "Scout understands your market niche."
    );
  }

  if (userTypes.includes("community")) {
    focusAreas.push("neighborhood engagement", "local resources", "community building");
    contextualHints.push(
      "Scout helps connect neighbors and build communities.",
      "Emphasize hyperlocal trust and relationships."
    );
  }

  // Location-specific terms
  if (location.state) {
    localTerms.push(location.state);
  }
  if (location.county) {
    localTerms.push(`${location.county} County`);
  }
  if (location.city) {
    localTerms.push(location.city);
  }

  // Add contextual hints based on recent interactions
  const interactionTypes = recentInteractions.map((i) => i.type);
  if (interactionTypes.includes("contractor")) {
    contextualHints.push(
      "User recently searched for contractors - emphasize contractor network features."
    );
  }
  if (interactionTypes.includes("marketplace")) {
    contextualHints.push(
      "User recently used marketplace - highlight listing and discovery features."
    );
  }
  if (interactionTypes.includes("builder")) {
    contextualHints.push(
      "User is active in Community Builder - emphasize community reach and fundraising."
    );
  }

  return {
    formalityLevel,
    focusAreas,
    localTerms,
    contextualHints,
  };
}

/**
 * Format user context into a rich system prompt injection
 * This gets mixed with the main system prompt for each LLM request
 */
export function formatUserContextForPrompt(context: UserContext): string {
  if (!context.userId) {
    // Guest user context
    return `
## User Context: Guest User
You're assisting a guest user exploring TradeScout. Be welcoming and educational.
Emphasize the platform's value proposition and encourage exploration.
`;
  }

  const locationStr = formatLocation(context.location);
  const profileViews = ["homeowner", "contractor", "business", "professional", "admin"].filter(
    (v) => context.userTypes.includes(v)
  );
  const identityLabel = profileViews.length > 0 ? profileViews.join(" + ") : "community member";
  const hasMultipleViews = profileViews.length > 1;

  let contextPrompt = `
## User Context: Personalized Guidance
**Profile Views:** ${identityLabel}${hasMultipleViews ? " (multi-hat user)" : ""}
**Location:** ${locationStr}
**Formality:** ${context.languageProfile.formalityLevel}

### How to Respond:
${context.languageProfile.contextualHints.map((h) => `- ${h}`).join("\n")}

### Focus Areas:
${context.languageProfile.focusAreas.map((f) => `- ${f}`).join("\n")}`;

  // Add recent interaction context
  if (context.recentInteractions.length > 0) {
    contextPrompt += `\n### Recent Activity:\n`;
    context.recentInteractions.slice(0, 3).forEach((i) => {
      contextPrompt += `- ${i.type}: ${i.topic} (${formatTimeAgo(i.timestamp)})\n`;
    });
  }

  // Add location-specific context
  if (context.languageProfile.localTerms.length > 0) {
    contextPrompt += `\n### Local Context:\n`;
    contextPrompt += `This user is in: ${context.languageProfile.localTerms.join(", ")}\n`;
    contextPrompt += `Reference local insights, county-specific data, and community ecosystem when relevant.\n`;
  }

  return contextPrompt;
}

/**
 * Format location context into readable string
 */
function formatLocation(location: LocationContext): string {
  if (location.level === "city") {
    return `${location.city}, ${location.state}`;
  }
  if (location.level === "county") {
    return `${location.county} County, ${location.state}`;
  }
  if (location.level === "state") {
    return location.state || "Unknown";
  }
  return "Unknown location";
}

/**
 * Format timestamp as "time ago"
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Generate thinking-process-friendly context summary
 * For LLM's internal reasoning before generating response
 */
export function generateThinkingContext(context: UserContext, currentMessage?: string): string {
  if (!context.userId) {
    return `[REASONING] Guest user - keep response accessible and value-focused`;
  }

  const profileViews = ["homeowner", "contractor", "business", "professional", "admin"].filter(
    (v) => context.userTypes.includes(v)
  );
  const typeContext =
    profileViews.length > 0 ? `${profileViews.join("/")} user` : "community member";

  let thinkingContext = `[REASONING] ${typeContext}`;

  if (context.location.level !== "unknown") {
    thinkingContext += ` in ${formatLocation(context.location)}`;
  }

  const perspective = inferConversationPerspective(currentMessage);
  if (perspective === "work") {
    thinkingContext += ` - provider perspective (help them win work through trust + process)`;
  } else if (perspective === "hire") {
    thinkingContext += ` - hiring perspective (scope, route to Direct Connect / Project Tracker)`;
  } else if (context.preferences.isCommunityBuilder) {
    thinkingContext += ` - emphasize community reach and builder features`;
  } else if (context.preferences.isBusiness) {
    thinkingContext += ` - emphasize practical business outcomes (no hype)`;
  } else {
    thinkingContext += ` - keep options clear; ask one clarifier if needed`;
  }

  if (context.recentInteractions.length > 0) {
    const topActivity = context.recentInteractions[0];
    thinkingContext += `. Recent focus: ${topActivity.topic}`;
  }

  return thinkingContext;
}
