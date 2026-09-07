/**
 * MESSAGING AUTHORITY SYSTEM
 *
 * Core Rule:
 * "Messaging is a consequence of decisions, never a discovery action."
 * "All conversations require explicit authority, intent, and scope."
 *
 * Authority Gates (Decision → Contact):
 * - decision_card: Contact from Decision Card outcome
 * - scout_recommendation: Contact from Scout recommendation
 *
 * Deprecated (no longer supported):
 * - Social graph endpoints (friends, suggestions)
 * - Direct search-to-message flows
 * - user_search authority gate
 *
 * See: MESSAGING_AUTHORITY_CONTRACT.md
 */

import type { Express } from "express";
import { eq, desc, and, or, like, ilike, sql, inArray, notInArray, type SQL } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { pool } from "./db";
import { createPostgresRateLimitStore } from "./utils/postgresRateLimitStore";
import { db } from "./db";
import {
  decisionCards,
  users,
  userFollows,
  profiles,
  contactPermissions,
  conversations,
  messages,
  marketplaceConversations,
  marketplaceMessages,
  notifications,
  postComments,
} from "@shared/schema";
import { storage } from "./storage";
import { isAuthenticated, requireOnboardingComplete } from "./auth";
import {
  ensureContactRequest,
  getContactPermission,
  updateContactPermissionStatus,
} from "./utils/contactRequests";
import { hasPrivilegedVerificationBypass } from "./utils/privilegedVerification";

export type ConversationContactGate = "accepted" | "pending" | "denied" | "request_required";

export function resolveConversationContactGate(status: unknown): ConversationContactGate {
  if (status === "accepted") return "accepted";
  if (status === "pending") return "pending";
  if (status === "declined" || status === "blocked") return "denied";
  return "request_required";
}

export function registerSocialFeatures(app: Express) {
  const isProductionEnv = process.env.NODE_ENV === "production";
  const noopRateLimiter: any = (_req: any, _res: any, next: any) => next();

  const isSuperAdminLike = (req: any): boolean => {
    const roleFromClaimsRaw = (req?.user as any)?.claims?.role;
    const roleFromClaims =
      typeof roleFromClaimsRaw === "string"
        ? (() => {
            const token = roleFromClaimsRaw.trim().toLowerCase();
            return token === "owner" || token === "head_admin" ? "super_admin" : token;
          })()
        : roleFromClaimsRaw;
    const rawRoles = Array.isArray((req?.user as any)?.roles) ? (req.user as any).roles : [];
    const roles: string[] = [roleFromClaims, ...(rawRoles || [])].filter(
      (r): r is string => typeof r === "string"
    );
    return roles.some((r) => {
      const token = String(r).toLowerCase();
      return token === "super_admin" || token === "head_admin" || token === "owner";
    });
  };

  const limiterStore = (prefix: string) =>
    createPostgresRateLimitStore({
      pool,
      prefix: `rl:${prefix}`,
      cleanupIntervalMs: Number(process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || 10 * 60 * 1000),
    });

  const rateLimitKey = (req: any) => {
    const userId = req?.user?.claims?.sub || req?.user?.id;
    if (userId) return `u:${userId}`;
    return req.ip;
  };

  const decisionCardCreateLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 30,
        message: "Too many decision cards created, please slow down",
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: rateLimitKey,
        store: limiterStore("decision_cards_create"),
      })
    : noopRateLimiter;

  const socialSearchLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 30,
        message: "Too many searches, please slow down",
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: rateLimitKey,
        store: limiterStore("social_search"),
      })
    : noopRateLimiter;

  const conversationStartLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 30,
        message: "Too many conversation attempts, please slow down",
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: rateLimitKey,
        store: limiterStore("conversation_start"),
      })
    : noopRateLimiter;

  /**
   * DECISION CARDS: Minimal creator endpoint
   *
   * Purpose: provide a durable authority object for intent-gated contact.
   * Contact is still enforced via POST /api/social/conversations/start which validates:
   * - authorityGate === 'decision_card'
   * - sourceDecisionCardId belongs to requester and is active
   *
   * POST /api/decision-cards
   * Body: { intent, decisionScope?, title?, description? }
   */
  app.post(
    "/api/decision-cards",
    isAuthenticated,
    requireOnboardingComplete,
    decisionCardCreateLimiter,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const { intent, decisionScope, title, description } = req.body ?? {};

        if (!intent || !["hire", "advise", "collaborate", "reconnect"].includes(intent)) {
          return res.status(400).json({
            message: "Intent required: 'hire', 'advise', 'collaborate', or 'reconnect'",
          });
        }

        const [row] = await db
          .insert(decisionCards)
          .values({
            userId,
            intent,
            decisionScope: typeof decisionScope === "string" ? decisionScope : null,
            title: typeof title === "string" ? title : null,
            description: typeof description === "string" ? description : null,
            status: "active",
            updatedAt: new Date(),
          } as any)
          .returning({ id: decisionCards.id });

        res.json({ id: row?.id });
      } catch (error: any) {
        console.error("Error creating decision card:", error);
        res.status(500).json({ message: "Failed to create decision card" });
      }
    }
  );

  /**
   * SEARCH: Find people in the community
   * GET /api/social/search?q=name&scope=county&limit=20
   *
   * Allows users to search:
   * - By name
   * - By location (county, state)
   * - By role (homeowner, contractor)
   * - Filter out people already connected to
   */
  app.get(
    "/api/social/search",
    isAuthenticated,
    requireOnboardingComplete,
    socialSearchLimiter,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const {
          q = "",
          scope = "county",
          role = undefined,
          limit = 20,
          offset = 0,
          excludeFollowing = true,
        } = req.query;

        const limitNum = Math.min(parseInt(limit as string) || 20, 100);
        const offsetNum = parseInt(offset as string) || 0;

        // Get current user's location for scoped search
        const currentUser = await storage.getUser(userId);
        if (!currentUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Build search conditions
        const searchConditions: SQL[] = [];

        // Exclude self
        searchConditions.push(notInArray(users.id, [userId]));

        // Search by name (first name, last name, or email)
        if (q) {
          const searchTerm = `%${q}%`;
          const nameCondition = or(
            ilike(users.firstName, searchTerm),
            ilike(users.lastName, searchTerm),
            ilike(users.email, searchTerm)
          );
          if (nameCondition) {
            searchConditions.push(nameCondition);
          }
        }

        // Scope by location
        if (scope === "county" && (currentUser as any).countyFips) {
          searchConditions.push(eq(users.countyFips, (currentUser as any).countyFips));
        } else if (scope === "state" && currentUser.state) {
          searchConditions.push(eq(users.state, currentUser.state));
        }

        // Filter by role if specified
        if (role && ["homeowner", "contractor", "business"].includes(role as string)) {
          searchConditions.push(eq(users.role, role as any));
        }

        // Exclude users already following if requested
        let excludedUserIds: string[] = [];
        if (excludeFollowing) {
          const following = await db
            .select({ followingId: userFollows.followingId })
            .from(userFollows)
            .where(eq(userFollows.followerId, userId));

          excludedUserIds = following
            .map((f) => f.followingId)
            .filter((id): id is string => Boolean(id));

          if (excludedUserIds.length > 0) {
            searchConditions.push(notInArray(users.id, excludedUserIds));
          }
        }

        // Execute search
        const results = await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            profileImageUrl: users.profileImageUrl,
            role: users.role,
            state: users.state,
            countyFips: users.countyFips,
            verified: users.addressVerified,
            badges: sql`COALESCE(${users.role}, 'user')::text[]`,
          })
          .from(users)
          .where(and(...searchConditions))
          .orderBy(
            // Prioritize exact name matches, then verified users, then recent
            desc(sql`CASE WHEN LOWER(${users.firstName}) = LOWER(${q}) THEN 1 ELSE 0 END`),
            desc(users.addressVerified),
            desc(users.createdAt)
          )
          .limit(limitNum)
          .offset(offsetNum);

        const formattedResults = results.map((user) => ({
          id: user.id,
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User",
          avatar: user.profileImageUrl,
          role: user.role,
          location: user.countyFips ? `${user.countyFips}, ${user.state}` : user.state,
          verified: user.verified,
        }));

        res.json({ results: formattedResults, total: formattedResults.length });
      } catch (error: any) {
        console.error("Search error:", error);
        res.status(500).json({ message: "Search failed" });
      }
    }
  );

  /**
   * DEPRECATED: Social graph discovery is no longer supported
   * @deprecated Use Decision Cards or Scout Recommendations to connect
   * GET /api/social/friends?filter=all|friends|suggestions
   */
  app.get(
    "/api/social/friends",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      console.warn("[DEPRECATED] GET /api/social/friends called - endpoint is deprecated");
      return res.status(410).json({
        message: "Social graph actions are deprecated. Use Scout or Decision Cards to connect.",
        reasonCode: "ENDPOINT_DEPRECATED",
      });

      /* ORIGINAL IMPLEMENTATION ARCHIVED
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      const { filter = 'friends', limit = 50, offset = 0 } = req.query;

      if (filter === 'friends') {
        // Get people user is following
        const following = await db
          .select({
            userId: userFollows.followingId,
            firstName: users.firstName,
            lastName: users.lastName,
            avatar: users.profileImageUrl,
            role: users.role,
            verified: users.addressVerified,
          })
          .from(userFollows)
          .leftJoin(users, eq(userFollows.followingId, users.id))
          .where(eq(userFollows.followerId, userId))
          .limit(parseInt(limit as string) || 50)
          .offset(parseInt(offset as string) || 0);

        const formatted = following
          .filter((f) => f.userId)
          .map((f) => ({
            id: f.userId,
            name: `${f.firstName || ''} ${f.lastName || ''}`.trim() || 'User',
            avatar: f.avatar,
            role: f.role,
            verified: f.verified,
          }));

        return res.json({ friends: formatted, type: 'following' });
      } else if (filter === 'suggestions') {
        // Get friend suggestions: people in same location not yet following
        const currentUser = await storage.getUser(userId);
        if (!currentUser) return res.status(404).json({ message: "User not found" });

        const currentFollowing = await db
          .select({ followingId: userFollows.followingId })
          .from(userFollows)
          .where(eq(userFollows.followerId, userId));

        const followingIds = currentFollowing
          .map((f) => f.followingId)
          .filter((id): id is string => Boolean(id));

        const suggestions = await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            avatar: users.profileImageUrl,
            role: users.role,
            verified: users.addressVerified,
          })
          .from(users)
          .where(
            and(
              eq(users.isActive, true),
              eq(users.addressVerified, true),
              notInArray(users.id, [userId, ...followingIds]),
              (currentUser as any).countyFips 
                ? eq(users.countyFips, (currentUser as any).countyFips)
                : eq(users.state, currentUser.state),
            )
          )
          .orderBy(desc(users.addressVerified), desc(users.createdAt))
          .limit(20);

        const formatted = suggestions.map((s) => ({
          id: s.id,
          name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'User',
          avatar: s.avatar,
          role: s.role,
          verified: s.verified,
          reason: 'In your area',
        }));

        return res.json({ suggestions: formatted });
      }

      res.json({ friends: [] });
    } catch (error: any) {
      console.error("Friends error:", error);
      res.status(500).json({ message: "Failed to fetch friends" });
    }
    */
    }
  );

  /**
   * DEPRECATED: Direct friend/follow actions no longer supported
   * @deprecated Use Decision Cards or Scout Recommendations to connect
   * POST /api/social/friends/:userId/add
   */
  app.post(
    "/api/social/friends/:userId/add",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      console.warn(
        "[DEPRECATED] POST /api/social/friends/:userId/add called - endpoint is deprecated"
      );
      return res.status(410).json({
        message:
          "Social graph actions are deprecated. Contact requires explicit intent via Scout or Decision Card.",
        reasonCode: "ENDPOINT_DEPRECATED",
      });

      /* ORIGINAL IMPLEMENTATION ARCHIVED
    try {
      const followerId = req.user?.id || req.user?.claims?.sub;
      const { userId: followingId } = req.params;

      if (!followerId || !followingId) {
        return res.status(400).json({ message: "User ID required" });
      }

      if (followerId === followingId) {
        return res.status(400).json({ message: "Cannot follow yourself" });
      }

      // Check if already following
      const [existing] = await db
        .select()
        .from(userFollows)
        .where(
          and(
            eq(userFollows.followerId, followerId),
            eq(userFollows.followingId, followingId),
          )
        );

      if (existing) {
        return res.status(409).json({ message: "Already following this user" });
      }

      // Add follow relationship
      await db.insert(userFollows).values({
        followerId,
        followingId,
      });

      res.json({ message: "Friend added", followed: true });
    } catch (error: any) {
      console.error("Add friend error:", error);
      res.status(500).json({ message: "Failed to add friend" });
    }
    */
    }
  );

  /**
   * DEPRECATED: Unfriend/unfollow actions no longer supported
   * @deprecated Conversations persist for audit trail; blocking is handled separately
   * POST /api/social/friends/:userId/remove
   */
  app.post(
    "/api/social/friends/:userId/remove",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      console.warn(
        "[DEPRECATED] POST /api/social/friends/:userId/remove called - endpoint is deprecated"
      );
      return res.status(410).json({
        message: "Social graph actions are deprecated. Use blocking/reporting if needed.",
        reasonCode: "ENDPOINT_DEPRECATED",
      });

      /* ORIGINAL IMPLEMENTATION ARCHIVED
    try {
      const followerId = req.user?.id || req.user?.claims?.sub;
      const { userId: followingId } = req.params;

      if (!followerId || !followingId) {
        return res.status(400).json({ message: "User ID required" });
      }

      await db
        .delete(userFollows)
        .where(
          and(
            eq(userFollows.followerId, followerId),
            eq(userFollows.followingId, followingId),
          )
        );

      res.json({ message: "Friend removed", followed: false });
    } catch (error: any) {
      console.error("Remove friend error:", error);
      res.status(500).json({ message: "Failed to remove friend" });
    }
    */
    }
  );

  /**
   * START CONVERSATION: Create decision-scoped conversation with intent metadata
   *
   * ✅ MESSAGING AUTHORITY CONTRACT ENFORCER
   * - Requires explicit intent (hire, advise, collaborate, reconnect)
   * - Captures decision context and Scout assessment
   * - Validates user is verified
   * - Stores metadata for lifecycle tracking
   *
   * POST /api/social/conversations/start
   * Body: {
   *   targetUserId: string,
   *   intent: 'hire' | 'advise' | 'collaborate' | 'reconnect',
   *   initiatedFromDecisionId?: string,
   *   initiatedFromScoutRecommendationId?: string,
   * }
   */
  app.post(
    "/api/social/conversations/start",
    isAuthenticated,
    requireOnboardingComplete,
    conversationStartLimiter,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        const {
          targetUserId,
          intent,
          initiatedFromDecisionId,
          initiatedFromScoutRecommendationId,
        } = req.body;

        // ========================================
        // VALIDATION CHECKPOINT 1: Required fields
        // ========================================
        if (!userId || !targetUserId) {
          return res.status(400).json({ message: "User ID required" });
        }

        if (!intent || !["hire", "advise", "collaborate", "reconnect"].includes(intent)) {
          return res.status(400).json({
            message: "Intent required: 'hire', 'advise', 'collaborate', or 'reconnect'",
          });
        }

        if (userId === targetUserId) {
          return res.status(400).json({ message: "Cannot message yourself" });
        }

        // ========================================
        // VALIDATION CHECKPOINT 2: User verification
        // ========================================
        const initiator = await storage.getUser(userId);
        const recipient = await storage.getUser(targetUserId);

        if (!initiator || !recipient) {
          return res.status(404).json({ message: "User not found" });
        }

        // ========================================
        // VERIFICATION GATE (C2-3): Action-triggered, not upfront
        // ========================================
        // C2 Pattern: Check verification requirements when action is executed
        // NOT when user navigates to messaging UI

        // Asymmetric verification (C2-4):
        // - Sender (initiator) must verify address to send
        // - Recipient is checked but not blocking (may not be verified yet)

        const missingInitiatorVerification =
          !hasPrivilegedVerificationBypass(initiator) && !(initiator as any).addressVerified;
        const recipientUnverified = !(recipient as any).addressVerified;

        // If initiator (sender) is not verified, offer verification with alternate path
        if (missingInitiatorVerification) {
          // Import the C2-2 helper
          const { buildVerificationGateResponse } =
            await import("./utils/explainAndOfferVerification");

          const gateResponse = buildVerificationGateResponse({
            action: "MESSAGE_USER",
            missingRequirements: ["address"],
            userRole: (initiator as any).role,
            targetUserId: targetUserId,
            targetRole: (recipient as any).role,
            context: { intent },
          });

          // Return Scout-style response with verification option + alternate path
          // User can either verify OR use Scout-mediated contact
          return res.status(200).json({
            ...gateResponse,
            // Include context so client can retry after verification
            verificationRequired: {
              action: "MESSAGE_USER",
              retryPath: `/api/user/${targetUserId}/conversations`,
              context: { targetUserId, intent },
            },
          });
        }

        // If recipient (target) is not verified, WARN but don't block
        // (They may have been recently created; messaging can still happen)
        if (recipientUnverified) {
          console.warn(
            `[Messaging] Recipient ${targetUserId} is not verified. Conversation may have limited success.`
          );
          // Continue; don't block. Scout can explain risk in UI if needed.
        }

        // ========================================
        // VALIDATION CHECKPOINT 3: Intent validation
        // ========================================
        // If intent is 'reconnect', they should have prior conversation
        if (intent === "reconnect") {
          const [prior] = await db
            .select()
            .from(marketplaceConversations)
            .where(
              or(
                and(
                  eq(marketplaceConversations.buyerId, userId),
                  eq(marketplaceConversations.sellerId, targetUserId)
                ),
                and(
                  eq(marketplaceConversations.buyerId, targetUserId),
                  eq(marketplaceConversations.sellerId, userId)
                )
              )
            )
            .limit(1);

          if (!prior) {
            return res.status(400).json({
              message: "No prior conversation found for reconnect intent",
            });
          }
        }

        // ========================================
        // VALIDATION CHECKPOINT 4: Authority gate validation
        // ========================================
        const { authorityGate, sourceDecisionCardId, confidenceScore, decisionScope } = req.body;
        const normalizedScoutRecommendationId =
          typeof initiatedFromScoutRecommendationId === "string" &&
          initiatedFromScoutRecommendationId.trim().length > 0
            ? initiatedFromScoutRecommendationId.trim()
            : null;

        // Validate authority gate (LOCKED: only decision_card and scout_recommendation)
        if (!authorityGate || !["decision_card", "scout_recommendation"].includes(authorityGate)) {
          return res.status(400).json({
            reasonCode: "MISSING_AUTHORITY_GATE",
            message:
              "Authority gate required: 'decision_card' or 'scout_recommendation'. Direct search-to-message is not supported.",
          });
        }

        // D1: If from decision_card, require sourceDecisionCardId
        if (authorityGate === "decision_card") {
          if (!sourceDecisionCardId) {
            return res.status(400).json({
              reasonCode: "MISSING_DECISION_CARD_ID",
              message: "Decision Card ID required when authorityGate is 'decision_card'",
            });
          }
          const [decision] = await db
            .select()
            .from(decisionCards)
            .where(
              and(eq(decisionCards.id, sourceDecisionCardId), eq(decisionCards.userId, userId))
            )
            .limit(1);
          if (!decision || decision.status === "archived") {
            return res.status(400).json({
              reasonCode: "INVALID_DECISION_CARD",
              message: "Decision Card not found or inactive.",
            });
          }
          if (decision.intent && decision.intent !== intent) {
            return res.status(400).json({
              reasonCode: "DECISION_INTENT_MISMATCH",
              message: "Decision Card intent does not match request intent.",
            });
          }
          if (decision.decisionScope && decisionScope && decision.decisionScope !== decisionScope) {
            return res.status(400).json({
              reasonCode: "DECISION_SCOPE_MISMATCH",
              message: "Decision Card scope does not match request scope.",
            });
          }
        }

        // D3: scout recommendation authority must include a source id.
        if (authorityGate === "scout_recommendation" && !normalizedScoutRecommendationId) {
          return res.status(400).json({
            reasonCode: "MISSING_SCOUT_RECOMMENDATION_ID",
            message:
              "Scout recommendation ID required when authorityGate is 'scout_recommendation'",
          });
        }

        // Durable contact state takes precedence over thread existence. An old
        // thread never resurrects a pending, declined, or blocked relationship.
        const permission = await getContactPermission(userId, targetUserId);
        const permissionGate = resolveConversationContactGate(permission?.status);
        if (permissionGate === "pending") {
          return res.status(202).json({
            created: false,
            pending: true,
            requestId: permission?.lastRequestNotificationId || null,
            message: "Contact request already pending recipient approval.",
          });
        }
        if (permissionGate === "denied") {
          return res.status(403).json({
            created: false,
            message: "Recipient has declined first contact.",
            reasonCode: "CONTACT_DECLINED",
          });
        }

        // ========================================
        // CHECK: Conversation already exists?
        // ========================================
        const [existing] = await db
          .select()
          .from(marketplaceConversations)
          .where(
            or(
              and(
                eq(marketplaceConversations.buyerId, userId),
                eq(marketplaceConversations.sellerId, targetUserId)
              ),
              and(
                eq(marketplaceConversations.buyerId, targetUserId),
                eq(marketplaceConversations.sellerId, userId)
              )
            )
          )
          .limit(1);

        if (existing && permissionGate === "accepted") {
          // Conversation already exists - return it without re-creating
          // Metadata (intent, authority, etc.) is preserved from original creation
          return res.json({
            threadId: existing.id,
            created: false,
            intent: existing.intent,
            authorityGate: existing.authorityGate,
            message: "Existing conversation retrieved",
          });
        }

        if (permissionGate !== "accepted") {
          const requestPreviewRaw =
            typeof req.body?.contactPreview === "string" ? req.body.contactPreview.trim() : "";
          const ensure = await ensureContactRequest({
            requesterId: userId,
            targetUserId,
            preview: requestPreviewRaw,
            metadata: {
              contactType: "message",
              intent,
              authorityGate,
              sourceDecisionCardId: authorityGate === "decision_card" ? sourceDecisionCardId : null,
              sourceScoutRecommendationId:
                authorityGate === "scout_recommendation" ? normalizedScoutRecommendationId : null,
              decisionScope: decisionScope || null,
              confidenceScore: confidenceScore != null ? Number(confidenceScore) : null,
              riskFlags: Array.isArray(req.body?.riskFlags)
                ? req.body.riskFlags.map((flag: any) => String(flag))
                : null,
              countyFips: (initiator as any)?.countyFips || null,
            },
          });

          if (ensure.status === "pending") {
            return res.status(202).json({
              created: false,
              pending: true,
              requestId: ensure.requestId || null,
              message: "Contact request sent. Recipient must accept before chat opens.",
            });
          }
          if (ensure.status !== "accepted") {
            return res.status(403).json({
              created: false,
              message: "Recipient has not authorized contact.",
              reasonCode: "CONTACT_NOT_AUTHORIZED",
            });
          }
        }

        if (existing) {
          return res.json({
            threadId: existing.id,
            created: false,
            intent: existing.intent,
            authorityGate: existing.authorityGate,
            message: "Existing conversation retrieved",
          });
        }

        const [createdConversation] = await db
          .insert(marketplaceConversations)
          .values({
            listingId: `messaging:${intent}`,
            buyerId: userId,
            sellerId: targetUserId,
            status: "active" as any,
            lastMessageAt: new Date(),
            intent,
            authorityGate,
            sourceDecisionCardId: authorityGate === "decision_card" ? sourceDecisionCardId : null,
            sourceScoutRecommendationId:
              authorityGate === "scout_recommendation" ? normalizedScoutRecommendationId : null,
            confidenceScore: confidenceScore != null ? String(confidenceScore) : null,
            decisionScope: decisionScope || "Direct contact approved",
          })
          .returning();

        res.status(200).json({
          threadId: createdConversation.id,
          created: true,
          intent,
          authorityGate,
        });
      } catch (error: any) {
        console.error("Start conversation error:", error);
        res.status(500).json({ message: "Failed to start conversation" });
      }
    }
  );

  // Incoming first-contact requests for the current user.
  app.get(
    "/api/social/conversations/requests/incoming",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const rows = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, userId),
              eq(notifications.type, "new_message"),
              eq(notifications.isArchived, false)
            )
          )
          .orderBy(desc(notifications.createdAt))
          .limit(100);

        const requests = rows
          .map((row: any) => {
            const md = (row.metadata || {}) as Record<string, any>;
            if (!["first_contact_request", "contact_request"].includes(md.kind)) return null;
            if (md.status !== "pending") return null;
            return {
              id: row.id,
              createdAt: row.createdAt,
              fromUserId: md.requesterId || null,
              fromName: md.requesterName || "TradeScout member",
              fromRole: md.requesterRole || null,
              fromVerified: Boolean(md.requesterVerified),
              preview: md.preview || "",
              intent: md.intent || "collaborate",
              contactType: md.contactType || "message",
              postId: md.postId || null,
            };
          })
          .filter(Boolean);

        res.json({ requests });
      } catch (error: any) {
        console.error("Error fetching incoming conversation requests:", error);
        res.status(500).json({ message: "Failed to load incoming requests" });
      }
    }
  );

  // Accept or decline first-contact request.
  app.post(
    "/api/social/conversations/requests/:requestId/respond",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        const { requestId } = req.params;
        const action = String(req.body?.action || "").toLowerCase();

        if (!userId) return res.status(401).json({ message: "Authentication required" });
        if (!["accept", "decline"].includes(action)) {
          return res.status(400).json({ message: "Action must be 'accept' or 'decline'" });
        }

        const [requestNotification] = await db
          .select()
          .from(notifications)
          .where(and(eq(notifications.id, requestId), eq(notifications.userId, userId)))
          .limit(1);

        if (!requestNotification) {
          return res.status(404).json({ message: "Request not found" });
        }

        const metadata = ((requestNotification as any).metadata || {}) as Record<string, any>;
        if (metadata.kind !== "first_contact_request" || metadata.status !== "pending") {
          if (metadata.kind !== "contact_request" || metadata.status !== "pending") {
            return res.status(400).json({ message: "Request is no longer pending" });
          }
        }

        const requesterId = String(metadata.requesterId || "");
        if (!requesterId) {
          return res.status(400).json({ message: "Invalid request payload" });
        }
        const contactType = (metadata.contactType || "message") as string;

        await db
          .update(notifications)
          .set({
            isRead: true,
            readAt: new Date(),
            metadata: {
              ...metadata,
              status: action === "accept" ? "accepted" : "declined",
              respondedAt: new Date().toISOString(),
              responderId: userId,
            },
            updatedAt: new Date(),
          } as any)
          .where(eq(notifications.id, requestId));

        if (action === "decline") {
          await updateContactPermissionStatus({
            requesterId,
            targetUserId: userId,
            status: "declined",
            respondedBy: userId,
            responseReason: "recipient_declined",
          });

          await db.insert(notifications).values({
            userId: requesterId,
            type: "new_message",
            priority: "normal",
            title: "Message request declined",
            message: `${metadata.targetName || "Recipient"} declined your first-contact request.`,
            actionUrl: "/messages",
            actionText: "View messages",
            iconName: "message-square",
            iconColor: "gray",
            deliveryMethods: ["in_app"],
            metadata: {
              kind: "first_contact_response",
              requestId,
              status: "declined",
            },
          } as any);

          return res.json({ success: true, accepted: false });
        }

        await updateContactPermissionStatus({
          requesterId,
          targetUserId: userId,
          status: "accepted",
          respondedBy: userId,
          responseReason: "recipient_accepted",
        });

        if (contactType === "comment") {
          const postId = metadata.postId ? String(metadata.postId) : "";
          const commentContent = typeof metadata.content === "string" ? metadata.content : "";
          if (!postId || !commentContent.trim()) {
            return res.status(400).json({ message: "Invalid comment request payload" });
          }

          const source = metadata.source === "community" ? "community" : "social";
          if (source === "community") {
            await storage.createPostComment({
              postId,
              authorId: requesterId,
              content: commentContent.trim(),
            });
          } else {
            const [createdComment] = await db
              .insert(postComments)
              .values({
                postId,
                authorId: requesterId,
                content: commentContent.trim(),
                parentCommentId: metadata.parentCommentId || null,
              })
              .returning();
            if (createdComment?.id) {
              try {
                await storage.logEvent("comment.created", {
                  userId: requesterId,
                  commentId: createdComment.id,
                  postId,
                });
              } catch (e) {
                console.error("Failed to log comment.created for request accept", e);
              }
            }
          }

          await db.insert(notifications).values({
            userId: requesterId,
            type: "comment_received",
            priority: "normal",
            title: "Comment request accepted",
            message: `${metadata.targetName || "Recipient"} accepted your comment.`,
            actionUrl: "/messages",
            actionText: "View requests",
            iconName: "message-square",
            iconColor: "blue",
            deliveryMethods: ["in_app"],
            metadata: {
              kind: "contact_request_response",
              requestId,
              status: "accepted",
              contactType: "comment",
              postId,
            },
          } as any);

          return res.json({ success: true, accepted: true, contactType: "comment" });
        }

        const [existingConversation] = await db
          .select()
          .from(marketplaceConversations)
          .where(
            or(
              and(
                eq(marketplaceConversations.buyerId, requesterId),
                eq(marketplaceConversations.sellerId, userId)
              ),
              and(
                eq(marketplaceConversations.buyerId, userId),
                eq(marketplaceConversations.sellerId, requesterId)
              )
            )
          )
          .limit(1);

        let threadId = existingConversation?.id;
        if (!threadId) {
          const [createdConversation] = await db
            .insert(marketplaceConversations)
            .values({
              listingId: `messaging:${metadata.intent || "collaborate"}`,
              buyerId: requesterId,
              sellerId: userId,
              status: "active" as any,
              lastMessageAt: new Date(),
              intent: metadata.intent || "collaborate",
              authorityGate: metadata.authorityGate || "scout_recommendation",
              sourceDecisionCardId: metadata.sourceDecisionCardId || null,
              sourceScoutRecommendationId:
                metadata.sourceScoutRecommendationId || "first-contact-accepted",
              confidenceScore:
                metadata.confidenceScore != null ? String(metadata.confidenceScore) : null,
              decisionScope: metadata.decisionScope || "Community first-contact approval",
            })
            .returning();
          threadId = createdConversation.id;
        }

        await db.insert(notifications).values({
          userId: requesterId,
          type: "new_message",
          priority: "normal",
          title: "Message request accepted",
          message: `${metadata.targetName || "Recipient"} accepted your request. You can now chat.`,
          actionUrl: `/messages?thread=${encodeURIComponent(String(threadId))}`,
          actionText: "Open conversation",
          iconName: "message-square",
          iconColor: "blue",
          deliveryMethods: ["in_app"],
          metadata: {
            kind: "first_contact_response",
            requestId,
            status: "accepted",
            threadId,
          },
        } as any);

        res.json({ success: true, accepted: true, threadId });
      } catch (error: any) {
        console.error("Error responding to first-contact request:", error);
        res.status(500).json({ message: "Failed to respond to request" });
      }
    }
  );

  /**
   * CONTACT CONNECTIONS: Accepted first-contact permissions involving the current user.
   * A "connection" is established the moment contact is approved/accepted.
   *
   * GET /api/social/contact-connections
   */
  app.get(
    "/api/social/contact-connections",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const permissionRows = await db
          .select({
            requesterId: contactPermissions.requesterId,
            targetUserId: contactPermissions.targetUserId,
            respondedAt: contactPermissions.respondedAt,
            updatedAt: contactPermissions.updatedAt,
            intent: contactPermissions.intent,
            authorityGate: contactPermissions.authorityGate,
            decisionScope: contactPermissions.decisionScope,
            countyFips: contactPermissions.countyFips,
          })
          .from(contactPermissions)
          .where(
            and(
              eq(contactPermissions.status, "accepted"),
              or(
                eq(contactPermissions.requesterId, userId),
                eq(contactPermissions.targetUserId, userId)
              )
            )
          );

        const bestByPartnerId = new Map<string, (typeof permissionRows)[number]>();
        for (const row of permissionRows) {
          const partnerId = row.requesterId === userId ? row.targetUserId : row.requesterId;
          if (!partnerId || partnerId === userId) continue;

          const existing = bestByPartnerId.get(partnerId);
          if (!existing) {
            bestByPartnerId.set(partnerId, row);
            continue;
          }

          const existingAt = (existing.respondedAt ?? existing.updatedAt)?.getTime() ?? 0;
          const rowAt = (row.respondedAt ?? row.updatedAt)?.getTime() ?? 0;
          if (rowAt > existingAt) {
            bestByPartnerId.set(partnerId, row);
          }
        }

        const partnerIds = Array.from(bestByPartnerId.keys());
        if (partnerIds.length === 0) return res.json([]);

        const userRows = await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            city: users.city,
            state: users.state,
            roles: users.roles,
            role: users.role,
          })
          .from(users)
          .where(inArray(users.id, partnerIds));

        const usersById = new Map<string, any>(userRows.map((row: any) => [String(row.id), row]));

        const profileRows = partnerIds.length
          ? await db
              .select({ ownerUserId: profiles.ownerUserId, slug: profiles.slug })
              .from(profiles)
              .where(
                and(inArray(profiles.ownerUserId, partnerIds), eq(profiles.status, "published"))
              )
          : [];

        const canonicalProfileUrlByUserId = new Map<string, string>();
        for (const row of profileRows) {
          if (!canonicalProfileUrlByUserId.has(row.ownerUserId)) {
            canonicalProfileUrlByUserId.set(row.ownerUserId, `/u/${row.slug}`);
          }
        }

        const convRows = await db
          .select({
            id: marketplaceConversations.id,
            buyerId: marketplaceConversations.buyerId,
            sellerId: marketplaceConversations.sellerId,
          })
          .from(marketplaceConversations)
          .where(
            or(
              and(
                eq(marketplaceConversations.buyerId, userId),
                inArray(marketplaceConversations.sellerId, partnerIds)
              ),
              and(
                eq(marketplaceConversations.sellerId, userId),
                inArray(marketplaceConversations.buyerId, partnerIds)
              )
            )
          );

        const threadIdByPartnerId = new Map<string, string>();
        for (const row of convRows) {
          const partnerId = row.buyerId === userId ? row.sellerId : row.buyerId;
          if (!partnerId) continue;
          threadIdByPartnerId.set(partnerId, row.id);
        }

        const connections = partnerIds
          .map((partnerId) => {
            const partner = usersById.get(partnerId);
            const permission = bestByPartnerId.get(partnerId);
            if (!partner || !permission) return null;

            const connectedAt = permission.respondedAt ?? permission.updatedAt ?? null;
            return {
              id: partner.id,
              firstName: partner.firstName ?? null,
              lastName: partner.lastName ?? null,
              profileImageUrl: partner.profileImageUrl ?? null,
              city: partner.city ?? null,
              state: partner.state ?? null,
              roles: partner.roles ?? null,
              role: partner.role ?? null,
              canonicalProfileUrl: canonicalProfileUrlByUserId.get(partner.id) ?? null,
              connectedAt: connectedAt ? connectedAt.toISOString() : null,
              intent: permission.intent ?? null,
              authorityGate: permission.authorityGate ?? null,
              decisionScope: permission.decisionScope ?? null,
              countyFips: permission.countyFips ?? null,
              threadId: threadIdByPartnerId.get(partnerId) ?? null,
            };
          })
          .filter((row): row is NonNullable<typeof row> => Boolean(row));

        connections.sort((a, b) => {
          const aAt = a.connectedAt ? new Date(a.connectedAt).getTime() : 0;
          const bAt = b.connectedAt ? new Date(b.connectedAt).getTime() : 0;
          return bAt - aAt;
        });

        res.json(connections);
      } catch (error: any) {
        console.error("Error fetching contact connections:", error);
        res.status(500).json({ message: "Failed to load connections" });
      }
    }
  );

  /**
   * CONTACT CONNECTIONS ACTIVITY
   *
   * Used by the community header to show:
   * - connections active today
   * - connections active now (recent events in the last N minutes)
   *
   * A connection is still defined by accepted first-contact permission.
   * Super Admin is treated as connected to everyone (site-wide support role).
   *
   * GET /api/social/contact-connections/activity?limit=12&windowMinutes=5
   */
  app.get(
    "/api/social/contact-connections/activity",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "Authentication required" });

        const limit = Math.max(1, Math.min(Number(req.query?.limit || 12), 48));
        const windowMinutes = Math.max(1, Math.min(Number(req.query?.windowMinutes || 5), 60));

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const now = new Date();
        const activeNowSince = new Date(now.getTime() - windowMinutes * 60 * 1000);

        const isSuper = isSuperAdminLike(req);

        if (isSuper) {
          const totalMembersResult = (await db.execute(
            sql`select count(*)::int as count from users`
          )) as any;
          const totalConnections = Math.max(
            0,
            Number(totalMembersResult?.rows?.[0]?.count ?? 0) - 1
          );

          const activeTodayCountResult = (await db.execute(sql`
              select count(distinct e.user_id)::int as count
              from events e
              where e.user_id is not null
                and e.user_id <> ${userId}
                and e.created_at >= ${today}
            `)) as any;
          const activeTodayCount = Number(activeTodayCountResult?.rows?.[0]?.count ?? 0);

          const activeNowCountResult = (await db.execute(sql`
              select count(distinct e.user_id)::int as count
              from events e
              where e.user_id is not null
                and e.user_id <> ${userId}
                and e.created_at >= ${activeNowSince}
            `)) as any;
          const activeNowCount = Number(activeNowCountResult?.rows?.[0]?.count ?? 0);

          const activeRows = (await db.execute(sql`
              select
                u.id,
                u.first_name,
                u.last_name,
                u.profile_image_url,
                max(e.created_at) as last_seen_at
              from events e
              inner join users u on u.id = e.user_id
              where e.user_id is not null
                and e.user_id <> ${userId}
                and e.created_at >= ${today}
              group by u.id, u.first_name, u.last_name, u.profile_image_url
              order by last_seen_at desc
              limit ${limit}
            `)) as any;

          const activeToday = (activeRows?.rows ?? []).map((row: any) => {
            const lastSeenAt = row.last_seen_at ? new Date(row.last_seen_at) : null;
            return {
              id: String(row.id),
              firstName: row.first_name ? String(row.first_name) : null,
              lastName: row.last_name ? String(row.last_name) : null,
              profileImageUrl: row.profile_image_url ? String(row.profile_image_url) : null,
              lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
              isActiveNow: Boolean(lastSeenAt && lastSeenAt >= activeNowSince),
            };
          });

          return res.json({
            totalConnections,
            activeTodayCount,
            activeNowCount,
            windowMinutes,
            activeToday,
          });
        }

        const permissionRows = await db
          .select({
            requesterId: contactPermissions.requesterId,
            targetUserId: contactPermissions.targetUserId,
          })
          .from(contactPermissions)
          .where(
            and(
              eq(contactPermissions.status, "accepted"),
              or(
                eq(contactPermissions.requesterId, userId),
                eq(contactPermissions.targetUserId, userId)
              )
            )
          );

        const partnerIds = Array.from(
          new Set(
            permissionRows
              .map((row) => (row.requesterId === userId ? row.targetUserId : row.requesterId))
              .filter((id): id is string => Boolean(id) && id !== userId)
          )
        );

        const totalConnections = partnerIds.length;
        if (!partnerIds.length) {
          return res.json({
            totalConnections: 0,
            activeTodayCount: 0,
            activeNowCount: 0,
            windowMinutes,
            activeToday: [],
          });
        }

        const partnerIdList = sql.join(
          partnerIds.map((partnerId) => sql`${partnerId}`),
          sql`, `
        );

        const activeTodayCountResult = (await db.execute(sql`
            select count(distinct e.user_id)::int as count
            from events e
            where e.user_id in (${partnerIdList})
              and e.created_at >= ${today}
          `)) as any;
        const activeTodayCount = Number(activeTodayCountResult?.rows?.[0]?.count ?? 0);

        const activeNowCountResult = (await db.execute(sql`
            select count(distinct e.user_id)::int as count
            from events e
            where e.user_id in (${partnerIdList})
              and e.created_at >= ${activeNowSince}
          `)) as any;
        const activeNowCount = Number(activeNowCountResult?.rows?.[0]?.count ?? 0);

        const activeRows = (await db.execute(sql`
            select
              u.id,
              u.first_name,
              u.last_name,
              u.profile_image_url,
              max(e.created_at) as last_seen_at
            from events e
            inner join users u on u.id = e.user_id
            where e.user_id in (${partnerIdList})
              and e.created_at >= ${today}
            group by u.id, u.first_name, u.last_name, u.profile_image_url
            order by last_seen_at desc
            limit ${limit}
          `)) as any;

        const activeToday = (activeRows?.rows ?? []).map((row: any) => {
          const lastSeenAt = row.last_seen_at ? new Date(row.last_seen_at) : null;
          return {
            id: String(row.id),
            firstName: row.first_name ? String(row.first_name) : null,
            lastName: row.last_name ? String(row.last_name) : null,
            profileImageUrl: row.profile_image_url ? String(row.profile_image_url) : null,
            lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
            isActiveNow: Boolean(lastSeenAt && lastSeenAt >= activeNowSince),
          };
        });

        res.json({
          totalConnections,
          activeTodayCount,
          activeNowCount,
          windowMinutes,
          activeToday,
        });
      } catch (error: any) {
        console.error("Error fetching contact connections activity:", error);
        res.status(500).json({ message: "Failed to load connection activity" });
      }
    }
  );

  /**
   * SEARCH MESSAGES: Search within conversations
   * GET /api/social/messages/search?q=text&threadId=optional
   */
  app.get(
    "/api/social/messages/search",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        const { q, threadId, limit = 50 } = req.query;

        if (!q) {
          return res.status(400).json({ message: "Search query required" });
        }

        const searchTerm = `%${q}%`;
        const limitNum = Math.min(parseInt(limit as string) || 50, 100);

        // Build conditions - must be participant in thread
        const conditions: any[] = [];

        if (threadId) {
          // Search in specific conversation (verify access)
          const [conv] = await db
            .select()
            .from(marketplaceConversations)
            .where(
              and(
                eq(marketplaceConversations.id, threadId),
                or(
                  eq(marketplaceConversations.buyerId, userId),
                  eq(marketplaceConversations.sellerId, userId)
                )
              )
            );

          if (!conv) {
            return res.status(403).json({ message: "Access denied" });
          }

          conditions.push(eq(marketplaceMessages.conversationId, threadId));
        } else {
          // Search across all conversations user is in
          const convs = await db
            .select({ id: marketplaceConversations.id })
            .from(marketplaceConversations)
            .where(
              or(
                eq(marketplaceConversations.buyerId, userId),
                eq(marketplaceConversations.sellerId, userId)
              )
            );

          const convIds = convs.map((c) => c.id);
          if (convIds.length === 0) {
            return res.json({ results: [] });
          }

          conditions.push(inArray(marketplaceMessages.conversationId, convIds));
        }

        // Search message content
        conditions.push(ilike(marketplaceMessages.content, searchTerm));

        const results = await db
          .select({
            id: marketplaceMessages.id,
            conversationId: marketplaceMessages.conversationId,
            content: marketplaceMessages.content,
            senderId: marketplaceMessages.senderId,
            sentAt: marketplaceMessages.createdAt,
          })
          .from(marketplaceMessages)
          .where(and(...conditions))
          .orderBy(desc(marketplaceMessages.createdAt))
          .limit(limitNum);

        res.json({ results });
      } catch (error: any) {
        console.error("Message search error:", error);
        res.status(500).json({ message: "Search failed" });
      }
    }
  );

  /**
   * SEARCH FRIENDS: Filter/search friends list
   * GET /api/social/friends/search?q=name
   */
  app.get(
    "/api/social/friends/search",
    isAuthenticated,
    requireOnboardingComplete,
    async (req: any, res: any) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        const { q = "", limit = 50 } = req.query;

        const searchTerm = `%${q}%`;
        const limitNum = Math.min(parseInt(limit as string) || 50, 100);

        const results = await db
          .select({
            id: userFollows.followingId,
            firstName: users.firstName,
            lastName: users.lastName,
            avatar: users.profileImageUrl,
            role: users.role,
            verified: users.addressVerified,
          })
          .from(userFollows)
          .leftJoin(users, eq(userFollows.followingId, users.id))
          .where(
            and(
              eq(userFollows.followerId, userId),
              or(
                ilike(users.firstName, searchTerm),
                ilike(users.lastName, searchTerm),
                ilike(users.email, searchTerm)
              )
            )
          )
          .orderBy(desc(users.firstName))
          .limit(limitNum);

        const formatted = results
          .filter((r) => r.id)
          .map((r) => ({
            id: r.id,
            name: `${r.firstName || ""} ${r.lastName || ""}`.trim() || "User",
            avatar: r.avatar,
            role: r.role,
            verified: r.verified,
          }));

        res.json({ results: formatted });
      } catch (error: any) {
        console.error("Friends search error:", error);
        res.status(500).json({ message: "Search failed" });
      }
    }
  );
}
