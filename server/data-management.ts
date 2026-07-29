import { db } from "./db";
import { eq, desc, and, or, isNull, isNotNull, sql } from "drizzle-orm";
import {
  users,
  userDataRequests,
  dataAccessLogs,
  securityIncidents,
  userPrivacySettings,
  leads,
  conversations,
  messages,
  recommendations,
  contractors,
  profiles,
  type User,
  type UserDataRequest,
  type DataAccessLog,
  type SecurityIncident,
  type UserPrivacySettings,
} from "@shared/schema";
import { randomBytes } from "crypto";
import JSZip from "jszip";
import { notifyIndexNow } from "./services/indexNowService";
import {
  collectBusinessIndexNowUrls,
  collectProfileIndexNowUrls,
  collectProfileServiceOfferIndexNowUrls,
} from "./services/indexNowPublicationEvents";

export interface DataExportData {
  profile: any;
  leads: any[];
  conversations: any[];
  messages: any[];
  recommendations: any[];
  contractorProfile?: any;
  privacySettings: any;
  accessLogs: any[];
  dataRequests: any[];
}

/**
 * Comprehensive data management service for user privacy and security
 */
export class DataManagementService {
  /**
   * Log data access for audit trail
   */
  async logDataAccess(params: {
    userId?: string;
    accessorId: string;
    accessorRole: string;
    actionType:
      | "view"
      | "edit"
      | "delete"
      | "export"
      | "login_attempt"
      | "password_reset"
      | "profile_update";
    resourceType?:
      | "profile"
      | "messages"
      | "leads"
      | "recommendations"
      | "payments"
      | "documents"
      | "analytics";
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    success?: boolean;
    errorMessage?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await db.insert(dataAccessLogs).values({
        userId: params.userId,
        accessorId: params.accessorId,
        accessorRole: params.accessorRole,
        actionType: params.actionType,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        success: params.success ?? true,
        errorMessage: params.errorMessage,
        metadata: params.metadata,
      });
    } catch (error) {
      console.error("Failed to log data access:", error);
    }
  }

  /**
   * Create a data request (export, deletion, privacy report)
   */
  async createDataRequest(params: {
    userId: string;
    requestType: "data_export" | "data_deletion" | "privacy_report" | "account_closure";
    reason?: string;
    requestedBy: string;
  }): Promise<UserDataRequest> {
    const verificationCode = randomBytes(16).toString("hex");

    const [request] = await db
      .insert(userDataRequests)
      .values({
        userId: params.userId,
        requestType: params.requestType,
        reason: params.reason,
        requestedBy: params.requestedBy,
        verificationCode,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      })
      .returning();

    return request;
  }

  /**
   * Verify a data request with security code
   */
  async verifyDataRequest(requestId: string, verificationCode: string): Promise<boolean> {
    const [request] = await db
      .update(userDataRequests)
      .set({ isVerified: true })
      .where(
        and(
          eq(userDataRequests.id, requestId),
          eq(userDataRequests.verificationCode, verificationCode),
          eq(userDataRequests.isVerified, false)
        )
      )
      .returning();

    return !!request;
  }

  /**
   * Export all user data in a comprehensive format
   */
  async exportUserData(userId: string): Promise<DataExportData> {
    try {
      // Get user profile
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        throw new Error("User not found");
      }

      // Get all related data
      const [
        userLeads,
        userConversations,
        userMessages,
        userRecommendations,
        contractorProfile,
        privacySettings,
        accessLogs,
        dataRequests,
      ] = await Promise.all([
        db.select().from(leads).where(eq(leads.userId, userId)),
        db
          .select()
          .from(conversations)
          .where(or(eq(conversations.homeownerId, userId), eq(conversations.contractorId, userId))),
        db.select().from(messages).where(eq(messages.senderId, userId)),
        db.select().from(recommendations).where(eq(recommendations.contractorId, userId)),
        db.select().from(contractors).where(eq(contractors.userId, userId)),
        db.select().from(userPrivacySettings).where(eq(userPrivacySettings.userId, userId)),
        db
          .select()
          .from(dataAccessLogs)
          .where(eq(dataAccessLogs.userId, userId))
          .orderBy(desc(dataAccessLogs.timestamp)),
        db
          .select()
          .from(userDataRequests)
          .where(eq(userDataRequests.userId, userId))
          .orderBy(desc(userDataRequests.createdAt)),
      ]);

      const exportData: DataExportData = {
        profile: {
          ...user,
          passwordHash: undefined, // Never export password hash
        },
        leads: userLeads,
        conversations: userConversations,
        messages: userMessages,
        recommendations: userRecommendations,
        contractorProfile: contractorProfile[0] || null,
        privacySettings: privacySettings[0] || null,
        accessLogs: accessLogs.slice(0, 1000), // Limit to last 1000 logs
        dataRequests: dataRequests,
      };

      return exportData;
    } catch (error) {
      console.error("Error exporting user data:", error);
      throw new Error("Failed to export user data");
    }
  }

  /**
   * Create downloadable data export file
   */
  async createDataExportFile(exportData: DataExportData): Promise<Buffer> {
    const zip = new JSZip();

    // Add profile data
    zip.file("profile.json", JSON.stringify(exportData.profile, null, 2));

    // Add activity data
    zip.file("leads.json", JSON.stringify(exportData.leads, null, 2));
    zip.file("conversations.json", JSON.stringify(exportData.conversations, null, 2));
    zip.file("messages.json", JSON.stringify(exportData.messages, null, 2));
    zip.file("recommendations.json", JSON.stringify(exportData.recommendations, null, 2));

    // Add contractor data if applicable
    if (exportData.contractorProfile) {
      zip.file("contractor_profile.json", JSON.stringify(exportData.contractorProfile, null, 2));
    }

    // Add privacy and security data
    zip.file("privacy_settings.json", JSON.stringify(exportData.privacySettings, null, 2));
    zip.file("access_logs.json", JSON.stringify(exportData.accessLogs, null, 2));
    zip.file("data_requests.json", JSON.stringify(exportData.dataRequests, null, 2));

    // Add README
    const readme = `
# Your TradeScout Data Export

This archive contains all your personal data from TradeScout as of ${new Date().toISOString()}.

## Files Included:

- **profile.json**: Your user profile information
- **leads.json**: All leads you've submitted
- **conversations.json**: Your conversations with contractors
- **messages.json**: All messages you've sent
- **recommendations.json**: Recommendations you've given or received
- **contractor_profile.json**: Your contractor profile (if applicable)
- **privacy_settings.json**: Your privacy and notification preferences
- **access_logs.json**: Recent access logs for your account
- **data_requests.json**: History of data requests you've made

## Data Protection

This export contains sensitive personal information. Please store it securely and delete it when no longer needed.

For questions about your data, contact: support@tradescout.com
    `;
    zip.file("README.txt", readme);

    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  }

  /**
   * Securely delete user data (GDPR compliance)
   */
  async deleteUserData(userId: string, adminId: string): Promise<void> {
    try {
      const deletionPublicationUrls: string[] = [];
      try {
        const [account] = await db
          .select({
            businessSlug: users.businessSlug,
            preferences: users.preferences,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        const ownedProfiles = await db
          .select({
            slug: profiles.slug,
            status: profiles.status,
            contentBlocks: profiles.contentBlocks,
            seoMeta: profiles.seoMeta,
          })
          .from(profiles)
          .where(eq(profiles.ownerUserId, userId));

        for (const profile of ownedProfiles) {
          deletionPublicationUrls.push(...collectProfileIndexNowUrls(profile, true));
        }

        const businessVisibility = String(
          (account?.preferences as any)?.provisional?.profileDraft?.visibility || ""
        );
        deletionPublicationUrls.push(
          ...collectBusinessIndexNowUrls(
            { slug: account?.businessSlug, visibility: businessVisibility },
            true
          )
        );

        try {
          const offers = (await db.execute(sql`
            SELECT id, offer_type, is_active
            FROM profile_offers
            WHERE seller_user_id = ${userId}
              AND offer_type = 'service'
              AND is_active = true
          `)) as any;
          for (const offer of offers?.rows || []) {
            deletionPublicationUrls.push(...collectProfileServiceOfferIndexNowUrls(offer, true));
          }
        } catch (error) {
          const message = String((error as any)?.message || error).toLowerCase();
          if (!message.includes("profile_offers") && (error as any)?.code !== "42P01") {
            console.warn("[IndexNow] Failed loading service URLs before account deletion:", error);
          }
        }
      } catch (error) {
        console.warn("[IndexNow] Failed loading public URLs before account deletion:", error);
      }

      // Log the deletion request
      await this.logDataAccess({
        userId,
        accessorId: adminId,
        accessorRole: "admin",
        actionType: "delete",
        resourceType: "profile",
        metadata: { action: "full_data_deletion" },
      });

      // Delete in order to respect foreign key constraints
      await db.transaction(async (tx: any) => {
        // Delete messages
        await tx.delete(messages).where(eq(messages.senderId, userId));

        // Delete conversations where user is homeowner or contractor
        await tx
          .delete(conversations)
          .where(or(eq(conversations.homeownerId, userId), eq(conversations.contractorId, userId)));

        // Delete leads
        await tx.delete(leads).where(eq(leads.userId, userId));

        // Delete recommendations
        await tx.delete(recommendations).where(eq(recommendations.contractorId, userId));

        // Delete contractor profile
        await tx.delete(contractors).where(eq(contractors.userId, userId));

        // Delete privacy settings
        await tx.delete(userPrivacySettings).where(eq(userPrivacySettings.userId, userId));

        // Mark data requests as completed
        await tx
          .update(userDataRequests)
          .set({ status: "completed", completedBy: adminId, completedAt: new Date() })
          .where(eq(userDataRequests.userId, userId));

        // Finally, delete the user profile
        await tx.delete(users).where(eq(users.id, userId));
      });
      notifyIndexNow(deletionPublicationUrls);
    } catch (error) {
      console.error("Error deleting user data:", error);
      throw new Error("Failed to delete user data");
    }
  }

  /**
   * Report a security incident
   */
  async reportSecurityIncident(params: {
    userId?: string;
    incidentType:
      | "unauthorized_access"
      | "data_breach"
      | "failed_login_attempts"
      | "suspicious_activity"
      | "phishing_attempt"
      | "malware_detection";
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    sourceIp?: string;
    detectionMethod?: string;
    affectedData?: {
      userIds?: string[];
      dataTypes?: string[];
      recordCount?: number;
    };
  }): Promise<SecurityIncident> {
    const [incident] = await db
      .insert(securityIncidents)
      .values({
        userId: params.userId,
        incidentType: params.incidentType,
        severity: params.severity,
        description: params.description,
        sourceIp: params.sourceIp,
        detectionMethod: params.detectionMethod || "automated",
        affectedData: params.affectedData,
      })
      .returning();

    return incident;
  }

  /**
   * Get user privacy settings or create default ones
   */
  async getUserPrivacySettings(userId: string): Promise<UserPrivacySettings> {
    let [settings] = await db
      .select()
      .from(userPrivacySettings)
      .where(eq(userPrivacySettings.userId, userId));

    if (!settings) {
      [settings] = await db
        .insert(userPrivacySettings)
        .values({
          userId,
        })
        .returning();
    }

    return settings;
  }

  /**
   * Update user privacy settings
   */
  async updateUserPrivacySettings(
    userId: string,
    updates: Partial<UserPrivacySettings>
  ): Promise<UserPrivacySettings> {
    const [settings] = await db
      .update(userPrivacySettings)
      .set({
        ...updates,
        lastUpdated: new Date(),
      })
      .where(eq(userPrivacySettings.userId, userId))
      .returning();

    return settings;
  }

  /**
   * Get data access logs for a user (admin only)
   */
  async getUserAccessLogs(userId: string, limit: number = 100): Promise<DataAccessLog[]> {
    return db
      .select()
      .from(dataAccessLogs)
      .where(eq(dataAccessLogs.userId, userId))
      .orderBy(desc(dataAccessLogs.timestamp))
      .limit(limit);
  }

  /**
   * Get all data requests for admin review
   */
  async getAllDataRequests(status?: string): Promise<UserDataRequest[]> {
    const query = db.select().from(userDataRequests);

    if (status) {
      query.where(eq(userDataRequests.status, status as any));
    }

    return query.orderBy(desc(userDataRequests.createdAt));
  }

  /**
   * Get security incidents for admin review
   */
  async getSecurityIncidents(status?: string): Promise<SecurityIncident[]> {
    const query = db.select().from(securityIncidents);

    if (status) {
      query.where(eq(securityIncidents.status, status as any));
    }

    return query.orderBy(desc(securityIncidents.createdAt));
  }
}

export const dataManagementService = new DataManagementService();
