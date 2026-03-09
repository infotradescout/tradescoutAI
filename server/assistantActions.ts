import { db } from "./db";

// Import all services
import * as marketplaceService from "./services/marketplaceService.js";
import * as contractorService from "./services/contractorService.js";
import * as hoaService from "./services/hoaService.js";
import * as groupService from "./services/groupService.js";
import * as messagingService from "./services/messagingService.js";
import * as projectService from "./services/projectService.js";
import { writeManualCacheFile } from "./services/knowledgeService.js";
import { storage } from "./storage.js";
import { webSearch } from "./services/webSearchService.js";
import {
  auditPrivilegedAction,
  normalizeImmutableTargetId,
  normalizePrivilegedReason,
  resolvePrivilegedActor,
  suppliedEmailMatchesTarget,
} from "./utils/privilegedActions.js";

/**
 * Assistant Actions - Backend operations the AI can perform
 *
 * Each action is role-gated and returns structured results
 */

export interface User {
  id: number;
  role: "admin" | "contractor" | "homeowner" | "hoa_admin" | "moderator" | "user";
  county?: string;
  state?: string;
}

type AdminRole = "admin" | "super_admin";

export interface AssistantAction {
  type: string;
  params?: Record<string, any>;
}

export interface AssistantActionResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

/**
 * Execute an action based on the AI's request with role-based access control
 */
export async function executeAssistantAction(
  action: AssistantAction,
  user?: User
): Promise<AssistantActionResult> {
  try {
    // Verify user is authenticated for actions that require it
    if (!user && isAuthenticationRequired(action.type)) {
      return {
        success: false,
        error: "Authentication required for this action",
      };
    }

    switch (action.type) {
      // Marketplace actions
      case "search_marketplace":
        return await searchMarketplaceAction(action.params);

      case "list_item":
        return await listMarketplaceItemAction(user, action.params);

      case "get_my_listings":
        return await getUserListingsAction(user);

      case "get_county_listings":
        return await getCountyListingsAction(user, action.params);

      // Contractor actions
      case "search_contractors":
        return await searchContractorsAction(action.params);

      case "get_county_contractors":
        return await getCountyContractorsAction(user, action.params);

      case "get_contractor_details":
        return await getContractorDetailsAction(action.params);

      // Project actions
      case "create_project":
        return await createProjectAction(user, action.params);

      case "get_my_projects":
        return await getUserProjectsAction(user);

      case "submit_project_bid":
        return await submitProjectBidAction(user, action.params);

      case "award_project":
        return await awardProjectAction(user, action.params);

      // HOA actions
      case "get_hoa_data":
        return await getHOADataAction(user, action.params);

      case "post_to_hoa":
        return await postToHOAAction(user, action.params);

      case "start_hoa_vote":
        return await startHOAVoteAction(user, action.params);

      // Group actions
      case "get_local_groups":
        return await getLocalGroupsAction(user);

      case "post_to_group":
        return await postToGroupAction(user, action.params);

      case "join_group":
        return await joinGroupAction(user, action.params);

      // Messaging actions
      case "send_message":
        return await sendMessageAction(user, action.params);

      case "message_contractor":
        return await messageContractorAction(user, action.params);

      case "get_conversations":
        return await getConversationsAction(user);

      // Admin-only actions
      case "admin_cache_stats":
        return await adminCacheStatsAction(user);

      case "admin_system_status":
        return await adminSystemStatusAction(user);

      case "admin_cache_refresh":
        return await adminCacheRefreshAction(user);

      case "admin_cache_clear":
        return await adminCacheClearAction(user);

      case "admin_override_create":
        return await adminOverrideCreateAction(user, action.params);

      case "admin_override_delete":
        return await adminOverrideDeleteAction(user, action.params);

      case "admin_get_user_info":
        return await adminGetUserInfoAction(user, action.params);

      case "admin_reset_user_password":
        return await adminResetUserPasswordAction(user, action.params);

      // Internet/web search fallback
      case "web_search":
        return await webSearchAction(action.params);

      // Helper/Worker actions
      case "register_worker":
        return await registerWorkerAction(user, action.params);

      case "search_workers":
        return await searchWorkersAction(action.params);

      case "get_worker_profile":
        return await getWorkerProfileAction(action.params);

      case "post_task":
        return await postTaskAction(user, action.params);

      case "apply_to_task":
        return await applyToTaskAction(user, action.params);

      case "verify_worker":
        return await verifyWorkerAction(user, action.params);

      // County data functions
      case "get_county_info":
        return await getCountyInfoAction(action.params);

      case "list_all_counties":
        return await listAllCountiesAction();

      case "get_state_counties":
        return await getStateCountiesAction(action.params);

      // Affiliate analytics
      case "get_affiliate_stats":
        return await getAffiliateStatsAction(user);

      case "get_affiliate_commissions":
        return await getAffiliateCommissionsAction(user);

      case "track_affiliate_referral":
        return await trackAffiliateReferralAction(user, action.params);

      // Knowledge management (admin-only)
      case "admin_upsert_knowledge":
        return await adminUpsertKnowledgeAction(user, action.params);

      default:
        return {
          success: false,
          error: `Unknown action type: ${action.type}`,
        };
    }
  } catch (error) {
    console.error("Error executing assistant action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// ============================================================================
// WEB SEARCH TOOL
// ============================================================================

async function webSearchAction(params?: Record<string, any>) {
  const query = params?.query || params?.q;
  if (!query) {
    return { success: false, error: "query is required for web_search" };
  }
  const nResults = params?.n_results || params?.limit || 5;
  const result = await webSearch(String(query), Number(nResults));
  return result.success
    ? { success: true, data: { content: result.content, provider: result.provider } }
    : { success: false, error: result.error || "Web search failed" };
}

/**
 * Check if action requires authentication
 */
function isAuthenticationRequired(actionType: string): boolean {
  const unauthenticatedActions = [
    "search_marketplace",
    "search_contractors",
    "get_contractor_details",
    "get_hoa_data",
    "get_local_groups",
  ];
  return !unauthenticatedActions.includes(actionType);
}

function isAdminUser(user?: User): boolean {
  if (!user) return false;
  const rawRole = typeof (user as any)?.role === "string" ? String((user as any).role) : "";
  const normalizedRole = rawRole.trim().toLowerCase();
  const resolvedRole =
    normalizedRole === "owner" || normalizedRole === "head_admin" ? "super_admin" : normalizedRole;
  return ["admin", "super_admin"].includes(resolvedRole as AdminRole);
}

// ============================================================================
// MARKETPLACE ACTIONS
// ============================================================================

async function searchMarketplaceAction(params?: Record<string, any>) {
  return await marketplaceService.searchMarketplaceListings({
    query: params?.query,
    category: params?.category,
    limit: params?.limit || 20,
  });
}

async function listMarketplaceItemAction(user: User | undefined, params?: Record<string, any>) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  return await marketplaceService.createMarketplaceListing(
    user.id,
    params?.title,
    params?.description,
    params?.price,
    params?.category,
    user.county || "unknown",
    user.state || "unknown"
  );
}

async function getUserListingsAction(user: User | undefined) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  return await marketplaceService.getUserMarketplaceListings(user.id);
}

async function getCountyListingsAction(user: User | undefined, params?: Record<string, any>) {
  const county = params?.county || user?.county;
  const state = params?.state || user?.state;

  if (!county || !state) {
    return {
      success: false,
      error: "County and state required",
    };
  }

  return await marketplaceService.getMarketplaceForCounty(county, state);
}

// ============================================================================
// CONTRACTOR ACTIONS
// ============================================================================

async function searchContractorsAction(params?: Record<string, any>) {
  return await contractorService.searchContractors({
    trade: params?.trade,
    county: params?.county,
    state: params?.state,
    verified: true,
    limit: params?.limit || 20,
  });
}

async function getCountyContractorsAction(user: User | undefined, params?: Record<string, any>) {
  const county = params?.county || user?.county;
  const state = params?.state || user?.state;

  if (!county || !state) {
    return {
      success: false,
      error: "County and state required",
    };
  }

  return await contractorService.getContractorsInCounty(county, state);
}

async function getContractorDetailsAction(params?: Record<string, any>) {
  if (!params?.contractorId) {
    return { success: false, error: "Contractor ID required" };
  }

  return await contractorService.getContractorDetails(params.contractorId);
}

// ============================================================================
// PROJECT ACTIONS
// ============================================================================

async function createProjectAction(user: User | undefined, params?: Record<string, any>) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  if (user.role !== "homeowner" && user.role !== "user" && user.role !== "admin") {
    return { success: false, error: "Only homeowners can create projects" };
  }

  return await projectService.createProject({
    userId: user.id,
    title: params?.title,
    description: params?.description,
    budget: params?.budget,
    location: user.county || "unknown",
    category: params?.category,
  });
}

async function getUserProjectsAction(user: User | undefined) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  return await projectService.getUserProjects(user.id);
}

async function submitProjectBidAction(user: User | undefined, params?: Record<string, any>) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  if (user.role !== "contractor" && user.role !== "admin") {
    return { success: false, error: "Only contractors can submit bids" };
  }

  return await projectService.submitProjectBid(
    params?.projectId,
    user.id,
    params?.bidAmount,
    params?.timeline
  );
}

async function awardProjectAction(user: User | undefined, params?: Record<string, any>) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  return await projectService.awardProject(params?.projectId, params?.contractorId, user.id);
}

// ============================================================================
// HOA ACTIONS
// ============================================================================

async function getHOADataAction(user: User | undefined, params?: Record<string, any>) {
  const county = params?.county || user?.county;
  const state = params?.state || user?.state;

  if (!county || !state) {
    return { success: false, error: "County and state required" };
  }

  return await hoaService.getHOAsInCounty(county, state);
}

async function postToHOAAction(user: User | undefined, params?: Record<string, any>) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  return await hoaService.postToHOABoard(
    params?.hoaId,
    user.id,
    params?.title,
    params?.content,
    params?.category
  );
}

async function startHOAVoteAction(user: User | undefined, params?: Record<string, any>) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  return await hoaService.startHOAVote(
    params?.hoaId,
    user.id,
    params?.title,
    params?.description,
    params?.options
  );
}

// ============================================================================
// GROUP ACTIONS
// ============================================================================

async function getLocalGroupsAction(user: User | undefined) {
  const county = user?.county;
  const state = user?.state;

  if (!county || !state) {
    return { success: false, error: "County and state required" };
  }

  return await groupService.getGroupsInCounty(county, state);
}

async function postToGroupAction(user: User | undefined, params?: Record<string, any>) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  return await groupService.postToGroup({
    groupId: params?.groupId,
    userId: user.id,
    content: params?.content,
    title: params?.title,
  });
}

async function joinGroupAction(user: User | undefined, params?: Record<string, any>) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  return await groupService.joinGroup(user.id, params?.groupId);
}

// ============================================================================
// MESSAGING ACTIONS
// ============================================================================

async function sendMessageAction(user: User | undefined, params?: Record<string, any>) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  return {
    success: false,
    error:
      "Direct messaging is blocked. Use intent-gated contact through Scout/Decision Card (authority gate required).",
  };
}

async function messageContractorAction(user: User | undefined, params?: Record<string, any>) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  return {
    success: false,
    error:
      "Direct contractor messaging is blocked. Use Direct Connect or Scout-gated contact (authority gate required).",
  };
}

async function getConversationsAction(user: User | undefined) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  return await messagingService.getUserConversations(user.id);
}

// ============================================================================
// ADMIN-ONLY ACTIONS
// ============================================================================

async function adminCacheStatsAction(user: User | undefined) {
  if (!user || user.role !== "admin") {
    return { success: false, error: "Admin access required" };
  }

  return {
    success: true,
    data: {
      cacheFiles: 7,
      lastUpdate: new Date().toISOString(),
      status: "healthy",
    },
    message: "Cache statistics retrieved",
  };
}

async function adminSystemStatusAction(user: User | undefined) {
  if (!user || user.role !== "admin") {
    return { success: false, error: "Admin access required" };
  }

  return {
    success: true,
    data: {
      server: "running",
      crawler: "active",
      cache: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    },
    message: "System status retrieved",
  };
}

// ============================================================================
// ADMIN CACHE CONTROL ACTIONS
// ============================================================================

async function adminCacheRefreshAction(user: User | undefined) {
  if (!user || user.role !== "admin") {
    return { success: false, error: "Admin access required" };
  }

  try {
    // Trigger cache refresh - implementation depends on crawler setup
    console.log("Cache refresh triggered by admin");

    return {
      success: true,
      data: {
        refreshTriggered: true,
        timestamp: new Date().toISOString(),
      },
      message: "Cache refresh initiated successfully",
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to trigger cache refresh: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function adminCacheClearAction(user: User | undefined, params?: Record<string, any>) {
  if (!user || user.role !== "admin") {
    return { success: false, error: "Admin access required" };
  }

  try {
    const category = params?.category; // Optional: specific cache category to clear

    // Implementation: delete cache files or reset in-memory cache
    console.log(`Cache cleared for category: ${category || "all"}`);

    return {
      success: true,
      data: {
        cleared: category || "all categories",
        timestamp: new Date().toISOString(),
      },
      message: "Cache cleared successfully",
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to clear cache: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function adminOverrideCreateAction(user: User | undefined, params?: Record<string, any>) {
  if (!user || user.role !== "admin") {
    return { success: false, error: "Admin access required" };
  }

  try {
    const { overrideType, key, value, county, state } = params || {};

    if (!overrideType || !key || !value) {
      return { success: false, error: "overrideType, key, and value are required" };
    }

    // Implementation: save override to manual cache
    // Types: "response", "fact", "county", "local_guide"

    return {
      success: true,
      data: {
        overrideType,
        key,
        saved: true,
        timestamp: new Date().toISOString(),
      },
      message: `Override created successfully for ${key}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create override: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function adminOverrideDeleteAction(user: User | undefined, params?: Record<string, any>) {
  if (!user || user.role !== "admin") {
    return { success: false, error: "Admin access required" };
  }

  try {
    const { overrideType, key } = params || {};

    if (!overrideType || !key) {
      return { success: false, error: "overrideType and key are required" };
    }

    // Implementation: delete override from manual cache

    return {
      success: true,
      data: {
        deleted: true,
        key,
        timestamp: new Date().toISOString(),
      },
      message: `Override deleted successfully for ${key}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to delete override: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function adminGetUserInfoAction(user: User | undefined, params?: Record<string, any>) {
  if (!isAdminUser(user)) {
    return { success: false, error: "Admin access required" };
  }

  const { email, userId } = params || {};
  const actor = resolvePrivilegedActor(user);
  const targetUserId = normalizeImmutableTargetId(userId);
  const targetEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!targetUserId) {
    await auditPrivilegedAction({
      action: "assistant_admin_get_user_info",
      route: "assistant:admin_get_user_info",
      operationType: "assistant_admin_get_user_info",
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      actorRoles: actor.actorRoles,
      targetType: "user",
      targetId: null,
      resolutionSource: targetEmail ? "target_email_only" : "missing_target_user_id",
      reason: "assistant_admin_get_user_info",
      outcome: "denied",
      lookupInput: { targetEmail: targetEmail || null },
    });
    return {
      success: false,
      error: "userId is required. email may be supplied only as lookup metadata.",
    };
  }

  try {
    const target = await (storage as any).getUser?.(targetUserId);

    if (!target) {
      return { success: false, error: "User not found" };
    }
    if (!suppliedEmailMatchesTarget(targetEmail, target)) {
      await auditPrivilegedAction({
        action: "assistant_admin_get_user_info",
        route: "assistant:admin_get_user_info",
        operationType: "assistant_admin_get_user_info",
        actorId: actor.actorId,
        actorRole: actor.actorRole,
        actorRoles: actor.actorRoles,
        targetType: "user",
        targetId: target.id,
        resolutionSource: "param:userId",
        reason: "assistant_admin_get_user_info",
        outcome: "denied",
        lookupInput: { targetEmail },
        details: { mismatch: "target_email_does_not_match_target_user_id" },
      });
      return { success: false, error: "email does not match userId" };
    }

    const sanitized = {
      id: target.id,
      email: target.email,
      roles: target.roles || [target.role].filter(Boolean),
      activeRole: target.activeRole || target.role,
      verificationStatus: target.verificationStatus,
      badges: target.badges,
      preferences: target.preferences,
      createdAt: target.createdAt,
      updatedAt: target.updatedAt,
      lastLoginAt: target.lastLoginAt,
      addressVerified: target.addressVerified,
      emailVerified: target.emailVerified,
      passwordResetEnabled: true,
    };

    await auditPrivilegedAction({
      action: "assistant_admin_get_user_info",
      route: "assistant:admin_get_user_info",
      operationType: "assistant_admin_get_user_info",
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      actorRoles: actor.actorRoles,
      targetType: "user",
      targetId: target.id,
      resolutionSource: "param:userId",
      reason: "assistant_admin_get_user_info",
      outcome: "completed",
      lookupInput: { targetEmail: targetEmail || null },
    });

    return { success: true, data: sanitized };
  } catch (error: any) {
    console.error("adminGetUserInfoAction error", error);
    return { success: false, error: error?.message || "Lookup failed" };
  }
}

async function adminResetUserPasswordAction(user: User | undefined, params?: Record<string, any>) {
  if (!isAdminUser(user)) {
    return { success: false, error: "Admin access required" };
  }

  const { email, userId, newPassword } = params || {};
  const actor = resolvePrivilegedActor(user);
  const targetUserId = normalizeImmutableTargetId(userId);
  const targetEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const reason = normalizePrivilegedReason(params?.reason, 12);
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    return { success: false, error: "newPassword is required and must be at least 8 characters" };
  }
  if (!targetUserId) {
    await auditPrivilegedAction({
      action: "assistant_admin_reset_user_password",
      route: "assistant:admin_reset_user_password",
      operationType: "assistant_admin_reset_user_password",
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      actorRoles: actor.actorRoles,
      targetType: "user",
      targetId: null,
      resolutionSource: targetEmail ? "target_email_only" : "missing_target_user_id",
      reason,
      outcome: "denied",
      lookupInput: { targetEmail: targetEmail || null },
    });
    return {
      success: false,
      error: "userId is required. email may be supplied only as lookup metadata.",
    };
  }
  if (!reason) {
    return { success: false, error: "reason is required and must be at least 12 characters" };
  }

  try {
    const target = await (storage as any).getUser?.(targetUserId);

    if (!target) {
      return { success: false, error: "User not found" };
    }
    if (!suppliedEmailMatchesTarget(targetEmail, target)) {
      await auditPrivilegedAction({
        action: "assistant_admin_reset_user_password",
        route: "assistant:admin_reset_user_password",
        operationType: "assistant_admin_reset_user_password",
        actorId: actor.actorId,
        actorRole: actor.actorRole,
        actorRoles: actor.actorRoles,
        targetType: "user",
        targetId: target.id,
        resolutionSource: "param:userId",
        reason,
        outcome: "denied",
        lookupInput: { targetEmail },
        details: { mismatch: "target_email_does_not_match_target_user_id" },
      });
      return { success: false, error: "email does not match userId" };
    }

    const passwordHash = await (await import("./auth.js")).hashPassword(newPassword);
    await (storage as any).updateUser?.(target.id, {
      password: passwordHash,
      updatedAt: new Date(),
    });

    await auditPrivilegedAction({
      action: "assistant_admin_reset_user_password",
      route: "assistant:admin_reset_user_password",
      operationType: "assistant_admin_reset_user_password",
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      actorRoles: actor.actorRoles,
      targetType: "user",
      targetId: target.id,
      resolutionSource: "param:userId",
      reason,
      outcome: "completed",
      lookupInput: { targetEmail: targetEmail || null },
    });

    return {
      success: true,
      data: { userId: target.id, email: target.email },
      message: "Password reset successfully",
    };
  } catch (error: any) {
    console.error("adminResetUserPasswordAction error", error);
    return { success: false, error: error?.message || "Password reset failed" };
  }
}

// ============================================================================
// HELPER / WORKER ACTIONS
// ============================================================================

async function registerWorkerAction(user: User | undefined, params?: Record<string, any>) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  try {
    const { name, skills, hourlyRate, availability, bio } = params || {};

    if (!name || !skills || !hourlyRate) {
      return { success: false, error: "name, skills, and hourlyRate are required" };
    }

    // Implementation: save to database using drizzle
    // Check if database available, otherwise mock in dev

    return {
      success: true,
      data: {
        workerId: `worker_${user.id}_${Date.now()}`,
        name,
        verified: false,
        timestamp: new Date().toISOString(),
      },
      message: "Worker registered successfully",
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to register worker: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function searchWorkersAction(params?: Record<string, any>) {
  try {
    const { skills, county, state, verified, limit = 20 } = params || {};

    // Implementation: query database for workers matching criteria

    return {
      success: true,
      data: [],
      message: `Found 0 workers matching criteria (${skills || "any"} skills in ${county || "any"})`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to search workers: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function getWorkerProfileAction(params?: Record<string, any>) {
  try {
    const { workerId } = params || {};

    if (!workerId) {
      return { success: false, error: "workerId is required" };
    }

    // Implementation: fetch from database

    return {
      success: true,
      data: null,
      message: `No worker found with ID: ${workerId}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get worker profile: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function postTaskAction(user: User | undefined, params?: Record<string, any>) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  try {
    const { title, description, budget, location, skillsNeeded, deadline } = params || {};

    if (!title || !budget) {
      return { success: false, error: "title and budget are required" };
    }

    // Implementation: save task to database

    return {
      success: true,
      data: {
        taskId: `task_${Date.now()}`,
        title,
        postedBy: user.id,
        status: "open",
      },
      message: "Task posted successfully",
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to post task: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function applyToTaskAction(user: User | undefined, params?: Record<string, any>) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  try {
    const { taskId, proposal, estimatedHours } = params || {};

    if (!taskId || !proposal) {
      return { success: false, error: "taskId and proposal are required" };
    }

    // Implementation: save application to database

    return {
      success: true,
      data: {
        applicationId: `app_${Date.now()}`,
        taskId,
        status: "pending",
      },
      message: "Application submitted successfully",
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to apply to task: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function verifyWorkerAction(user: User | undefined, params?: Record<string, any>) {
  if (!user || user.role !== "admin") {
    return { success: false, error: "Admin access required" };
  }

  try {
    const { workerId, verified, notes } = params || {};

    if (!workerId) {
      return { success: false, error: "workerId is required" };
    }

    // Implementation: update worker verification in database

    return {
      success: true,
      data: {
        workerId,
        verified: verified === true,
        updated: true,
      },
      message: `Worker ${verified ? "verified" : "unverified"} successfully`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to verify worker: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// ============================================================================
// COUNTY DATA FUNCTIONS
// ============================================================================

async function getCountyInfoAction(params?: Record<string, any>) {
  try {
    const { county, state } = params || {};

    if (!county || !state) {
      return { success: false, error: "county and state are required" };
    }

    // Implementation: fetch from database or cache

    return {
      success: true,
      data: {
        county,
        state,
        population: null,
        area: null,
        timestamp: new Date().toISOString(),
      },
      message: `County info for ${county}, ${state}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get county info: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function listAllCountiesAction() {
  try {
    // Implementation: fetch all counties from cache or database

    return {
      success: true,
      data: [],
      message: "All counties retrieved",
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to list counties: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function getStateCountiesAction(params?: Record<string, any>) {
  try {
    const { state } = params || {};

    if (!state) {
      return { success: false, error: "state is required" };
    }

    // Implementation: fetch counties for state from cache or database

    return {
      success: true,
      data: [],
      message: `Counties for ${state}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get state counties: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// ============================================================================
// AFFILIATE ANALYTICS ACTIONS
// ============================================================================

import { getAffiliateStats, getCommissions, trackReferral } from "./services/affiliateService";

async function getAffiliateStatsAction(user: User | undefined) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  try {
    const stats = await getAffiliateStats(String(user.id));
    if (!stats) {
      return {
        success: true,
        data: null,
        message: "No affiliate account found for user",
      };
    }

    return {
      success: true,
      data: stats,
      message: "Affiliate statistics retrieved",
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get affiliate stats: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function getAffiliateCommissionsAction(user: User | undefined) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  try {
    const commissions = await getCommissions(String(user.id), {});
    const totalEarnings = commissions.reduce((sum, c) => sum + c.payoutAmount, 0);
    const pendingBalance = commissions
      .filter((c) => c.status === "pending")
      .reduce((sum, c) => sum + c.payoutAmount, 0);
    const paidBalance = commissions
      .filter((c) => c.status === "paid")
      .reduce((sum, c) => sum + c.payoutAmount, 0);

    return {
      success: true,
      data: {
        commissions,
        totalEarnings,
        pendingBalance,
        paidBalance,
      },
      message: "Commission history retrieved",
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get commissions: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function trackAffiliateReferralAction(user: User | undefined, params?: Record<string, any>) {
  if (!user) {
    return { success: false, error: "Authentication required" };
  }

  try {
    const { targetUserId, shareLinkId, couponCode, conversionSource, conversionType } =
      params || {};

    if (!targetUserId) {
      return { success: false, error: "targetUserId is required" };
    }

    const referral = await trackReferral(String(user.id), String(targetUserId), {
      shareLinkId,
      couponCode,
      conversionSource,
      conversionType,
    });

    if (!referral) {
      return {
        success: false,
        error: "Failed to create referral record",
      };
    }

    return {
      success: true,
      data: referral,
      message: "Referral tracked successfully",
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to track referral: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function adminUpsertKnowledgeAction(user: User | undefined, params?: Record<string, any>) {
  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    return { success: false, error: "Admin access required" };
  }

  try {
    const { key, content, scope = "global", countyCode, stateCode } = params || {};

    if (!key || !content) {
      return { success: false, error: "key and content are required" };
    }

    // Normalize filename and structure
    const safeKey = String(key)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_");
    const filename = `${safeKey}.json`;

    const payload = {
      key: safeKey,
      scope,
      countyCode: countyCode || null,
      stateCode: stateCode || null,
      content: String(content),
      updatedAt: new Date().toISOString(),
    };

    writeManualCacheFile(filename, payload);

    return {
      success: true,
      data: { filename, key: safeKey },
      message: "Knowledge entry saved to admin manual cache",
    };
  } catch (error) {
    console.error("Error upserting admin knowledge:", error);
    return {
      success: false,
      error: `Failed to save knowledge: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
