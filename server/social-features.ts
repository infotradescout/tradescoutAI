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
import { eq, desc, and, or, like, ilike, sql, inArray, notInArray } from "drizzle-orm";
import { db } from "../src/db/drizzle-mock";
import { 
  users,
  userFollows,
  conversations,
  messages,
  marketplaceConversations,
  marketplaceMessages,
} from "@shared/schema";
import { storage } from "./storage";
import { isAuthenticated, requireOnboardingComplete } from "./auth";

export function registerSocialFeatures(app: Express) {

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
  app.get("/api/social/search", isAuthenticated, requireOnboardingComplete, async (req: any, res: any) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      const { 
        q = '',
        scope = 'county',
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
      const searchConditions = [
        eq(users.isActive, true),
        eq(users.addressVerified, true), // Only show verified users
      ];

      // Exclude self
      searchConditions.push(notInArray(users.id, [userId]));

      // Search by name (first name, last name, or email)
      if (q) {
        const searchTerm = `%${q}%`;
        searchConditions.push(
          or(
            ilike(users.firstName, searchTerm),
            ilike(users.lastName, searchTerm),
            ilike(users.email, searchTerm),
          )
        );
      }

      // Scope by location
      if (scope === 'county' && (currentUser as any).countyFips) {
        searchConditions.push(eq(users.countyFips, (currentUser as any).countyFips));
      } else if (scope === 'state' && currentUser.state) {
        searchConditions.push(eq(users.state, currentUser.state));
      }

      // Filter by role if specified
      if (role && ['homeowner', 'contractor', 'business'].includes(role as string)) {
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
          desc(users.createdAt),
        )
        .limit(limitNum)
        .offset(offsetNum);

      const formattedResults = results.map((user) => ({
        id: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
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
  });

  /**
   * DEPRECATED: Social graph discovery is no longer supported
   * @deprecated Use Decision Cards or Scout Recommendations to connect
   * GET /api/social/friends?filter=all|friends|suggestions
   */
  app.get("/api/social/friends", isAuthenticated, requireOnboardingComplete, async (req: any, res: any) => {
    console.warn('[DEPRECATED] GET /api/social/friends called - endpoint is deprecated');
    return res.status(410).json({ 
      message: "Social graph actions are deprecated. Use Scout or Decision Cards to connect.",
      reasonCode: 'ENDPOINT_DEPRECATED'
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
  });

  /**
   * DEPRECATED: Direct friend/follow actions no longer supported
   * @deprecated Use Decision Cards or Scout Recommendations to connect
   * POST /api/social/friends/:userId/add
   */
  app.post("/api/social/friends/:userId/add", isAuthenticated, requireOnboardingComplete, async (req: any, res: any) => {
    console.warn('[DEPRECATED] POST /api/social/friends/:userId/add called - endpoint is deprecated');
    return res.status(410).json({ 
      message: "Social graph actions are deprecated. Contact requires explicit intent via Scout or Decision Card.",
      reasonCode: 'ENDPOINT_DEPRECATED'
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
  });

  /**
   * DEPRECATED: Unfriend/unfollow actions no longer supported
   * @deprecated Conversations persist for audit trail; blocking is handled separately
   * POST /api/social/friends/:userId/remove
   */
  app.post("/api/social/friends/:userId/remove", isAuthenticated, requireOnboardingComplete, async (req: any, res: any) => {
    console.warn('[DEPRECATED] POST /api/social/friends/:userId/remove called - endpoint is deprecated');
    return res.status(410).json({ 
      message: "Social graph actions are deprecated. Use blocking/reporting if needed.",
      reasonCode: 'ENDPOINT_DEPRECATED'
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
  });
  });

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
  app.post("/api/social/conversations/start", isAuthenticated, requireOnboardingComplete, async (req: any, res: any) => {
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

      if (!intent || !['hire', 'advise', 'collaborate', 'reconnect'].includes(intent)) {
        return res.status(400).json({ 
          message: "Intent required: 'hire', 'advise', 'collaborate', or 'reconnect'"
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

      // Only verified users can initiate contact
      if (!(initiator as any).addressVerified) {
        return res.status(403).json({ 
          message: "You must complete address verification before contacting others" 
        });
      }

      // Only verified users can be contacted
      if (!(recipient as any).addressVerified) {
        return res.status(403).json({ 
          message: "This user is not verified for messaging" 
        });
      }

      // ========================================
      // VALIDATION CHECKPOINT 3: Intent validation
      // ========================================
      // If intent is 'reconnect', they should have prior conversation
      if (intent === 'reconnect') {
        const [prior] = await db
          .select()
          .from(marketplaceConversations)
          .where(
            or(
              and(
                eq(marketplaceConversations.buyerId, userId),
                eq(marketplaceConversations.sellerId, targetUserId),
              ),
              and(
                eq(marketplaceConversations.buyerId, targetUserId),
                eq(marketplaceConversations.sellerId, userId),
              ),
            )
          )
          .limit(1);

        if (!prior) {
          return res.status(400).json({ 
            message: "No prior conversation found for reconnect intent" 
          });
        }
      }

      // ========================================
      // VALIDATION CHECKPOINT 4: Authority gate validation
      // ========================================
      const { 
        authorityGate, 
        sourceDecisionCardId,
        confidenceScore,
        decisionScope 
      } = req.body;

      // Validate authority gate (LOCKED: only decision_card and scout_recommendation)
      if (!authorityGate || !['decision_card', 'scout_recommendation'].includes(authorityGate)) {
        return res.status(400).json({ 
          reasonCode: 'MISSING_AUTHORITY_GATE',
          message: "Authority gate required: 'decision_card' or 'scout_recommendation'. Direct search-to-message is not supported." 
        });
      }

      // D1: If from decision_card, require sourceDecisionCardId
      if (authorityGate === 'decision_card') {
        if (!sourceDecisionCardId) {
          return res.status(400).json({ 
            reasonCode: 'MISSING_DECISION_CARD_ID',
            message: "Decision Card ID required when authorityGate is 'decision_card'" 
          });
        }
        // Future: Validate decision card exists and is active
        // const decision = await db.select().from(decisionCards).where(eq(decisionCards.id, sourceDecisionCardId)).limit(1);
        // if (!decision || decision.status === 'expired') { return 400 }
      }

      // D2: If from scout_recommendation, require sourceScoutRecommendationId (future phase)
      if (authorityGate === 'scout_recommendation' && !initiatedFromScoutRecommendationId) {
        return res.status(400).json({ 
          reasonCode: 'MISSING_SCOUT_RECOMMENDATION_ID',
          message: "Scout Recommendation ID required when authorityGate is 'scout_recommendation'" 
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
              eq(marketplaceConversations.sellerId, targetUserId),
            ),
            and(
              eq(marketplaceConversations.buyerId, targetUserId),
              eq(marketplaceConversations.sellerId, userId),
            ),
          )
        )
        .limit(1);

      if (existing) {
        // Conversation already exists - return it without re-creating
        // Metadata (intent, authority, etc.) is preserved from original creation
        return res.json({ 
          threadId: existing.id, 
          created: false,
          intent: existing.intent,
          authorityGate: existing.authorityGate,
          message: "Existing conversation retrieved" 
        });
      }

      // ========================================
      // CREATE: Conversation with immutable metadata
      // ========================================
      const [newConv] = await db
        .insert(marketplaceConversations)
        .values({
          listingId: `messaging:${intent}`, // Tag with intent for filtering
          buyerId: userId,
          sellerId: targetUserId,
          status: "active" as any,
          lastMessageAt: new Date(),
          // D1: Immutable metadata fields
          intent,
          authorityGate,
          sourceDecisionCardId: authorityGate === 'decision_card' ? sourceDecisionCardId : null,
          sourceScoutRecommendationId: authorityGate === 'scout_recommendation' ? initiatedFromScoutRecommendationId : null,
          confidenceScore: confidenceScore ? confidenceScore.toString() : null,
          decisionScope: decisionScope || null,
        })
        .returning();

      console.log(`[MESSAGING D1] Conversation created: intent=${intent}, gate=${authorityGate}, initiator=${userId}, recipient=${targetUserId}`);

      res.status(201).json({ 
        threadId: newConv.id, 
        created: true,
        intent,
        authorityGate,
        message: "Connection initiated. Scout has assessed this contact."
      });
    } catch (error: any) {
      console.error("Start conversation error:", error);
      res.status(500).json({ message: "Failed to start conversation" });
    }
  });

  /**
   * SEARCH MESSAGES: Search within conversations
   * GET /api/social/messages/search?q=text&threadId=optional
   */
  app.get("/api/social/messages/search", isAuthenticated, requireOnboardingComplete, async (req: any, res: any) => {
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
                eq(marketplaceConversations.sellerId, userId),
              ),
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
              eq(marketplaceConversations.sellerId, userId),
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
  });

  /**
   * SEARCH FRIENDS: Filter/search friends list
   * GET /api/social/friends/search?q=name
   */
  app.get("/api/social/friends/search", isAuthenticated, requireOnboardingComplete, async (req: any, res: any) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      const { q = '', limit = 50 } = req.query;

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
              ilike(users.email, searchTerm),
            ),
          )
        )
        .orderBy(desc(users.firstName))
        .limit(limitNum);

      const formatted = results
        .filter((r) => r.id)
        .map((r) => ({
          id: r.id,
          name: `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'User',
          avatar: r.avatar,
          role: r.role,
          verified: r.verified,
        }));

      res.json({ results: formatted });
    } catch (error: any) {
      console.error("Friends search error:", error);
      res.status(500).json({ message: "Search failed" });
    }
  });

}
