import { db } from "./db";
import {
  notifications,
  notificationPreferences,
  userPersonalEvents,
  notificationTemplates,
  notificationDeliveryLog,
  notificationJobs,
  users,
  pushSubscriptions,
  type Notification,
  type InsertNotification,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  type UserPersonalEvent,
  type InsertUserPersonalEvent,
  type NotificationTemplate,
  type InsertNotificationTemplate,
  type User,
  type MarketplaceListing,
} from "@shared/schema";
import { eq, and, or, sql, desc, asc, isNull } from "drizzle-orm";
import webPush from "web-push";
import { emailService } from "./services/emailService";

export type NotificationEmailPurpose =
  | "notification"
  | "direct_connect_account_setup"
  | "direct_connect_request"
  | "direct_connect_admin_oversight";

export type NotificationDeliveryMethod = "in_app" | "email" | "sms" | "push" | "webhook";
export type NotificationDeliveryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced"
  | "suppressed";

export type NotificationDeliveryLogInput = {
  notificationId: string;
  userId: string;
  deliveryMethod: NotificationDeliveryMethod;
  status: NotificationDeliveryStatus;
  contactInfo?: string;
  externalId?: string;
  externalResponse?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
};

export type EmailSuppression = {
  errorCode:
    | "GLOBAL_NOTIFICATIONS_DISABLED"
    | "NOTIFICATION_TYPE_DISABLED"
    | "NOTIFICATION_TYPE_EMAIL_DISABLED"
    | "EMAIL_NOTIFICATIONS_DISABLED"
    | "RECIPIENT_EMAIL_MISSING";
  errorMessage: string;
};

export function resolveRequestedEmailSuppression(input: {
  requestedDeliveryMethods: readonly string[];
  typeDeliveryMethods?: readonly string[] | null;
  globalNotificationsEnabled: boolean;
  typeNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  recipientEmail?: string | null;
  notificationType: string;
}): EmailSuppression | null {
  const requestedEmail = input.requestedDeliveryMethods.includes("email");
  const hasTypeOverride = Array.isArray(input.typeDeliveryMethods);
  const typeRequestsEmail = input.typeDeliveryMethods?.includes("email") === true;
  const emailWasRequested = requestedEmail || typeRequestsEmail;

  if (!emailWasRequested) return null;

  if (!input.globalNotificationsEnabled) {
    return {
      errorCode: "GLOBAL_NOTIFICATIONS_DISABLED",
      errorMessage: "Email suppressed because the recipient disabled all notifications.",
    };
  }

  if (!input.typeNotificationsEnabled) {
    return {
      errorCode: "NOTIFICATION_TYPE_DISABLED",
      errorMessage: `Email suppressed because the recipient disabled ${input.notificationType} notifications.`,
    };
  }

  if (requestedEmail && hasTypeOverride && !typeRequestsEmail) {
    return {
      errorCode: "NOTIFICATION_TYPE_EMAIL_DISABLED",
      errorMessage:
        "Email suppressed because the recipient's notification-type preference excludes email delivery.",
    };
  }

  if (!input.emailNotificationsEnabled) {
    return {
      errorCode: "EMAIL_NOTIFICATIONS_DISABLED",
      errorMessage: "Email suppressed because the recipient disabled email notifications.",
    };
  }

  if (!String(input.recipientEmail || "").trim()) {
    return {
      errorCode: "RECIPIENT_EMAIL_MISSING",
      errorMessage: "Email suppressed because the recipient has no email address.",
    };
  }

  return null;
}

export function resolveNotificationDeliveryFailure(
  error: unknown,
  deliveryMethod: NotificationDeliveryMethod
): {
  status: "failed" | "suppressed";
  errorCode: string;
  errorMessage: string;
} {
  const details =
    error && typeof error === "object"
      ? (error as {
          code?: unknown;
          statusCode?: unknown;
          deliveryStatus?: unknown;
          deliveryErrorCode?: unknown;
          message?: unknown;
        })
      : null;
  const status = details?.deliveryStatus === "suppressed" ? "suppressed" : "failed";
  const explicitCode = String(details?.deliveryErrorCode || "").trim();
  const providerCode = String(details?.code || details?.statusCode || "")
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  const prefix = deliveryMethod.toUpperCase();
  const errorCode =
    explicitCode || (providerCode ? `${prefix}_${providerCode}` : `${prefix}_DELIVERY_FAILED`);
  const errorMessage =
    error instanceof Error
      ? error.message
      : String(details?.message || error || `${deliveryMethod} delivery failed`);

  return {
    status,
    errorCode,
    errorMessage,
  };
}

export function buildNotificationDeliveryLogValues(
  input: NotificationDeliveryLogInput,
  now: Date = new Date()
) {
  return {
    notificationId: input.notificationId,
    userId: input.userId,
    deliveryMethod: input.deliveryMethod,
    status: input.status,
    contactInfo: input.contactInfo,
    externalId: input.externalId,
    externalResponse: input.externalResponse,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    // "sent" means the provider accepted the message. A provider callback
    // must establish "delivered"; acceptance alone never sets deliveredAt.
    sentAt: input.status === "sent" || input.status === "delivered" ? now : undefined,
    deliveredAt: input.status === "delivered" ? now : undefined,
    failedAt: input.status === "failed" ? now : undefined,
  };
}

class NotificationDeliveryAttemptError extends Error {
  constructor(
    readonly deliveryStatus: "failed" | "suppressed",
    readonly deliveryErrorCode: string,
    message: string
  ) {
    super(message);
    this.name = "NotificationDeliveryAttemptError";
  }
}

const CANONICAL_TRADESCOUT_BASE_URL = "https://www.thetradescout.com";

export function resolveNotificationEmailPurpose(metadata: unknown): NotificationEmailPurpose {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "notification";
  }

  if (!Object.prototype.hasOwnProperty.call(metadata, "emailPurpose")) {
    return "notification";
  }

  const purpose = String((metadata as Record<string, unknown>).emailPurpose || "")
    .toLowerCase()
    .trim();

  if (
    purpose === "direct_connect_account_setup" ||
    purpose === "direct_connect_request" ||
    purpose === "direct_connect_admin_oversight"
  ) {
    return purpose;
  }

  return "notification";
}

export function resolveCanonicalTradeScoutBaseUrl(
  candidate: unknown = process.env.APP_BASE_URL
): string {
  if (typeof candidate !== "string" || !candidate.trim()) {
    return CANONICAL_TRADESCOUT_BASE_URL;
  }

  try {
    const url = new URL(candidate.trim());
    if (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === "www.thetradescout.com" &&
      !url.username &&
      !url.password
    ) {
      return CANONICAL_TRADESCOUT_BASE_URL;
    }
  } catch {
    // Fall through to the canonical production origin.
  }

  return CANONICAL_TRADESCOUT_BASE_URL;
}

export function resolveNotificationEmailActionUrl(
  actionUrl: unknown,
  candidateBaseUrl?: unknown
): string | null {
  const rawActionUrl = String(actionUrl || "").trim();
  if (!rawActionUrl) return null;

  const canonicalBaseUrl = resolveCanonicalTradeScoutBaseUrl(candidateBaseUrl);
  try {
    const resolved = new URL(rawActionUrl, `${canonicalBaseUrl}/`);
    const canonical = new URL(canonicalBaseUrl);
    if (resolved.origin !== canonical.origin) return null;

    return `${canonicalBaseUrl}${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}

export function escapeNotificationEmailHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type NotificationEmailContent = {
  title?: unknown;
  message?: unknown;
  actionUrl?: unknown;
  actionText?: unknown;
};

type NotificationEmailRecipient = {
  firstName?: unknown;
};

export function renderNotificationEmailHtml(
  notification: NotificationEmailContent,
  user: NotificationEmailRecipient,
  candidateBaseUrl?: unknown
): string {
  const title = escapeNotificationEmailHtml(notification.title);
  const message = escapeNotificationEmailHtml(notification.message);
  const userName = escapeNotificationEmailHtml(user.firstName || "there");
  const actionText = escapeNotificationEmailHtml(notification.actionText || "View Details");
  const actionUrl = resolveNotificationEmailActionUrl(notification.actionUrl, candidateBaseUrl);
  const safeActionUrl = actionUrl ? escapeNotificationEmailHtml(actionUrl) : null;

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f97316; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #f97316;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>TradeScout</h1>
          </div>
          <div class="content">
            <h2>${title}</h2>
            <p>Hi ${userName},</p>
            <p>${message}</p>
            ${
              safeActionUrl
                ? `<p><a href="${safeActionUrl}" class="button">${actionText}</a></p>`
                : ""
            }
          </div>
          <div class="footer">
            <p>This notification was sent from TradeScout. If you no longer wish to receive these emails, you can update your notification preferences in your account settings.</p>
          </div>
        </div>
      </body>
      </html>
    `;
}

export function renderNotificationEmailText(
  notification: NotificationEmailContent,
  candidateBaseUrl?: unknown
): string {
  const actionUrl = resolveNotificationEmailActionUrl(notification.actionUrl, candidateBaseUrl);
  return [
    String(notification.message ?? ""),
    actionUrl ? `${String(notification.actionText || "View Details")}: ${actionUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Notification Service Class
export class NotificationService {
  private webPushConfigured = false;

  constructor() {
    if (
      process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
    ) {
      webPush.setVapidDetails(
        process.env.VAPID_SUBJECT,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
      this.webPushConfigured = true;
    }
  }

  // =====================================
  // GEO UTILS
  // =====================================

  /**
   * Compute haversine distance between two lat/lng points in meters.
   */
  private haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371e3; // Earth radius in meters

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // =====================================
  // NOTIFICATION OPERATIONS
  // =====================================

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const notificationData: any = {
      ...notification,
      deliveryMethods: notification.deliveryMethods || ["in_app"],
    };

    const [created] = await db.insert(notifications).values([notificationData]).returning();

    // Send notification if not scheduled
    if (!notification.scheduledFor) {
      await this.sendNotification(created.id);
    }

    return created;
  }

  async getUserNotifications(
    userId: string,
    options: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
      type?: string;
    } = {}
  ): Promise<Notification[]> {
    const conditions = [eq(notifications.userId, userId)];

    if (options.unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    if (options.type) {
      conditions.push(eq(notifications.type, options.type as any));
    }

    const baseQuery = db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt));

    const withLimit = options.limit ? baseQuery.limit(options.limit) : baseQuery;
    const finalQuery = options.offset ? withLimit.offset(options.offset) : withLimit;

    return await finalQuery;
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    return result[0]?.count || 0;
  }

  async archiveNotification(notificationId: string, userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isArchived: true, archivedAt: new Date() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }

  // =====================================
  // NOTIFICATION PREFERENCES
  // =====================================

  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    const [preferences] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    return preferences || null;
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<InsertNotificationPreferences>
  ): Promise<NotificationPreferences> {
    // Check if preferences exist
    const existing = await this.getUserPreferences(userId);

    if (existing) {
      const updateData: any = { ...preferences, updatedAt: new Date() };
      const [updated] = await db
        .update(notificationPreferences)
        .set(updateData)
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return updated;
    } else {
      // Create new preferences
      const [created] = await db
        .insert(notificationPreferences)
        .values({ userId, ...preferences } as any)
        .returning();
      return created;
    }
  }

  async createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
    const preferencesData: any = {
      userId,
      enableNotifications: true,
      enableEmailNotifications: true,
      enableSmsNotifications: false,
      enablePushNotifications: true,
      typePreferences: {
        birthday: { enabled: true, delivery_methods: ["in_app", "email"] },
        anniversary: { enabled: true, delivery_methods: ["in_app"] },
        new_message: { enabled: true, delivery_methods: ["in_app", "email"] },
        new_inquiry: { enabled: true, delivery_methods: ["in_app", "email"] },
        review_received: { enabled: true, delivery_methods: ["in_app"] },
        system_update: { enabled: true, delivery_methods: ["in_app"] },
        promotional: { enabled: true, delivery_methods: ["in_app", "push"] },
      },
    };

    const [created] = await db
      .insert(notificationPreferences)
      .values(preferencesData as any)
      .returning();

    return created;
  }

  // =====================================
  // PERSONAL EVENTS (BIRTHDAYS, ANNIVERSARIES)
  // =====================================

  async addPersonalEvent(event: InsertUserPersonalEvent): Promise<UserPersonalEvent> {
    const eventData: any = {
      ...event,
      notifyDaysBefore: event.notifyDaysBefore || [0, 1, 7],
    };

    const [created] = await db.insert(userPersonalEvents).values([eventData]).returning();
    return created;
  }

  async getUserPersonalEvents(userId: string): Promise<UserPersonalEvent[]> {
    return await db
      .select()
      .from(userPersonalEvents)
      .where(eq(userPersonalEvents.userId, userId))
      .orderBy(asc(userPersonalEvents.eventDate));
  }

  async updatePersonalEvent(
    eventId: string,
    userId: string,
    updates: Partial<InsertUserPersonalEvent>
  ): Promise<UserPersonalEvent | null> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    const [updated] = await db
      .update(userPersonalEvents)
      .set(updateData)
      .where(and(eq(userPersonalEvents.id, eventId), eq(userPersonalEvents.userId, userId)))
      .returning();

    return updated || null;
  }

  async deletePersonalEvent(eventId: string, userId: string): Promise<void> {
    await db
      .delete(userPersonalEvents)
      .where(and(eq(userPersonalEvents.id, eventId), eq(userPersonalEvents.userId, userId)));
  }

  // =====================================
  // BIRTHDAY AND ANNIVERSARY PROCESSING
  // =====================================

  async processBirthdayNotifications(): Promise<void> {
    const today = new Date();
    const todayString =
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0"); // MM-DD format

    // Find all birthday events for today
    const birthdayEvents = await db
      .select()
      .from(userPersonalEvents)
      .innerJoin(users, eq(userPersonalEvents.userId, users.id))
      .where(
        and(
          eq(userPersonalEvents.eventType, "birthday"),
          eq(userPersonalEvents.eventDate, todayString),
          eq(userPersonalEvents.enableNotifications, true)
        )
      );

    for (const { user_personal_events: event, users: user } of birthdayEvents) {
      // Calculate age if birth year is provided
      let age: number | null = null;
      if (event.eventYear) {
        age = today.getFullYear() - event.eventYear;
      }

      // Create birthday notification
      await this.createNotification({
        userId: user.id,
        type: "birthday",
        priority: "normal",
        title: age ? `Happy ${age}th Birthday!` : "Happy Birthday!",
        message:
          event.customMessage ||
          `${user.firstName ? `Happy birthday, ${user.firstName}` : "Happy birthday"}! 🎉 Wishing you a wonderful day filled with joy and celebration.`,
        iconName: "gift",
        iconColor: "pink",
        deliveryMethods: ["in_app", "email"] as string[],
        metadata: {
          age: age,
          eventType: "birthday",
          celebrationYear: today.getFullYear(),
        } as any,
      });
    }

    // Process anniversary notifications similarly
    await this.processAnniversaryNotifications(todayString);
  }

  async processAnniversaryNotifications(todayString?: string): Promise<void> {
    if (!todayString) {
      const today = new Date();
      todayString =
        String(today.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getDate()).padStart(2, "0");
    }

    const anniversaryEvents = await db
      .select()
      .from(userPersonalEvents)
      .innerJoin(users, eq(userPersonalEvents.userId, users.id))
      .where(
        and(
          or(
            eq(userPersonalEvents.eventType, "work_anniversary"),
            eq(userPersonalEvents.eventType, "business_anniversary")
          ),
          eq(userPersonalEvents.eventDate, todayString),
          eq(userPersonalEvents.enableNotifications, true)
        )
      );

    for (const { user_personal_events: event, users: user } of anniversaryEvents) {
      let years: number | null = null;
      if (event.eventYear) {
        years = new Date().getFullYear() - event.eventYear;
      }

      const anniversaryType = event.eventType === "work_anniversary" ? "work" : "business";

      await this.createNotification({
        userId: user.id,
        type: "anniversary",
        priority: "normal",
        title: years
          ? `${years} Year ${anniversaryType.charAt(0).toUpperCase() + anniversaryType.slice(1)} Anniversary!`
          : `${anniversaryType.charAt(0).toUpperCase() + anniversaryType.slice(1)} Anniversary!`,
        message:
          event.customMessage ||
          `Congratulations on your ${years ? `${years} year ` : ""}${anniversaryType} anniversary! 🎊`,
        iconName: "award",
        iconColor: "gold",
        deliveryMethods: ["in_app", "email"] as string[],
        metadata: {
          years: years,
          eventType: event.eventType,
          anniversaryYear: new Date().getFullYear(),
        } as any,
      });
    }
  }

  // =====================================
  // NOTIFICATION DELIVERY
  // =====================================

  async sendNotification(notificationId: string): Promise<void> {
    // Get notification with user preferences
    const [notificationData] = await db
      .select()
      .from(notifications)
      .innerJoin(users, eq(notifications.userId, users.id))
      .leftJoin(notificationPreferences, eq(notifications.userId, notificationPreferences.userId))
      .where(eq(notifications.id, notificationId));

    if (!notificationData) {
      throw new Error("Notification not found");
    }

    const {
      notifications: notification,
      users: user,
      notification_preferences: preferences,
    } = notificationData;

    const requestedDeliveryMethods = notification.deliveryMethods || ["in_app"];
    const typePrefs = (preferences?.typePreferences || {}) as Record<
      string,
      { enabled?: boolean; delivery_methods?: string[] }
    >;
    const currentTypePrefs = typePrefs[notification.type as string];
    const typeDeliveryMethods = Array.isArray(currentTypePrefs?.delivery_methods)
      ? currentTypePrefs.delivery_methods
      : null;
    const emailSuppression = resolveRequestedEmailSuppression({
      requestedDeliveryMethods,
      typeDeliveryMethods,
      globalNotificationsEnabled: preferences?.enableNotifications !== false,
      typeNotificationsEnabled: currentTypePrefs?.enabled !== false,
      emailNotificationsEnabled: preferences?.enableEmailNotifications !== false,
      recipientEmail: user.email,
      notificationType: String(notification.type),
    });

    if (emailSuppression) {
      await this.logDelivery({
        notificationId,
        userId: user.id,
        deliveryMethod: "email",
        status: "suppressed",
        contactInfo: user.email || undefined,
        errorCode: emailSuppression.errorCode,
        errorMessage: emailSuppression.errorMessage,
      });
    }

    // Preserve global and per-type suppression for every delivery method after
    // recording why a requested email was not attempted.
    if (preferences?.enableNotifications === false || currentTypePrefs?.enabled === false) {
      return;
    }

    const deliveryMethods = typeDeliveryMethods || requestedDeliveryMethods;

    for (const method of deliveryMethods) {
      try {
        switch (method) {
          case "email":
            if (!emailSuppression) {
              await this.sendEmailNotification(notification, user);
            }
            break;
          case "sms":
            if (preferences?.enableSmsNotifications && user.phone) {
              await this.sendSMSNotification(notification, user);
            }
            break;
          case "in_app":
            // In-app notifications are already stored in the database
            await this.logDelivery({
              notificationId,
              userId: user.id,
              deliveryMethod: "in_app",
              status: "delivered",
            });
            break;
          case "push":
            if (preferences?.enablePushNotifications && this.webPushConfigured) {
              await this.sendPushNotification(notification, user.id);
            }
            break;
        }
      } catch (error) {
        console.error(`Failed to send ${method} notification:`, error);
        const deliveryMethod = method as NotificationDeliveryMethod;
        const failure = resolveNotificationDeliveryFailure(error, deliveryMethod);
        await this.logDelivery({
          notificationId,
          userId: user.id,
          deliveryMethod,
          status: failure.status,
          contactInfo:
            deliveryMethod === "email"
              ? user.email || undefined
              : deliveryMethod === "sms"
                ? user.phone || undefined
                : undefined,
          errorCode: failure.errorCode,
          errorMessage: failure.errorMessage,
        });
      }
    }

    // Marking the aggregate notification is evidence, not delivery itself.
    // A write failure here must not report an already-attempted email as an
    // overall send failure and invite duplicate retries.
    try {
      await db
        .update(notifications)
        .set({ sentAt: new Date() })
        .where(eq(notifications.id, notificationId));
    } catch (error) {
      console.error("[notifications] Failed to mark notification sent", {
        notificationId,
        error,
      });
    }
  }

  // =====================================
  // HYPER-LOCAL NEARBY CONTENT
  // =====================================

  /**
   * Notify geo-opted-in users when a marketplace listing goes live near them.
   *
   * Uses user.preferences.geo.homeLocation (lat/lng) and an optional
   * geo.notifyNearbyRadiusMeters (default ~0.5mi ≈ 800m).
   */
  async notifyNearbyUsersOfMarketplaceListing(listing: MarketplaceListing): Promise<void> {
    // Respect listing-level location privacy; only notify for exact-location listings
    const visibility: string | undefined = (listing as any).locationVisibility as any;
    if (visibility && visibility !== "exact") {
      return;
    }

    // Require coordinates on the listing
    const listingLatRaw: any = (listing as any).latitude;
    const listingLngRaw: any = (listing as any).longitude;

    const listingLat = listingLatRaw != null ? Number(listingLatRaw) : NaN;
    const listingLng = listingLngRaw != null ? Number(listingLngRaw) : NaN;

    if (!Number.isFinite(listingLat) || !Number.isFinite(listingLng)) {
      return;
    }

    // Fetch users who have geo preferences defined
    const usersWithGeo = await db
      .select()
      .from(users)
      .where(sql<boolean>`preferences ? 'geo'`);

    if (!usersWithGeo.length) {
      return;
    }

    const defaultRadiusMeters = 800; // ~0.5 miles

    for (const user of usersWithGeo) {
      const prefs: any = (user as any).preferences || {};
      const geo = prefs.geo;

      if (!geo || !geo.homeLocation) {
        continue;
      }

      if (geo.enableNearbyDeals === false) {
        continue;
      }

      const includeTypes: string[] =
        Array.isArray(geo.includeTypes) && geo.includeTypes.length
          ? geo.includeTypes
          : ["marketplace", "trade"];

      if (!includeTypes.includes("marketplace")) {
        continue;
      }

      const homeLat = Number(geo.homeLocation.lat);
      const homeLng = Number(geo.homeLocation.lng);

      if (!Number.isFinite(homeLat) || !Number.isFinite(homeLng)) {
        continue;
      }

      const radiusMeters: number =
        Number(geo.notifyNearbyRadiusMeters) > 0
          ? Number(geo.notifyNearbyRadiusMeters)
          : defaultRadiusMeters;

      const distanceMeters = this.haversineDistanceMeters(homeLat, homeLng, listingLat, listingLng);

      if (!Number.isFinite(distanceMeters) || distanceMeters > radiusMeters) {
        continue;
      }

      const price = (listing as any).price;
      const priceText =
        typeof price === "string" || typeof price === "number"
          ? `$${Number(price).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          : "a new item";

      const distanceText =
        distanceMeters < 100
          ? "right by you"
          : `${(distanceMeters / 1609.34).toFixed(2)} miles away`;

      const actionUrl = listing.slug
        ? `/exchange?item=${encodeURIComponent(listing.slug)}`
        : `/exchange?item=${encodeURIComponent(listing.id)}`;

      await this.createNotification({
        userId: (user as any).id,
        type: "promotional",
        priority: "normal",
        title: "New Exchange listing near you",
        message: `${listing.title} just went live ${distanceText} for ${priceText}.`,
        iconName: "MapPin",
        iconColor: "orange",
        actionUrl,
        actionText: "View listing",
        deliveryMethods: ["in_app", "push"] as string[],
        metadata: {
          source: "marketplace",
          listingId: listing.id,
          radiusMeters,
          distanceMeters,
          city: listing.city,
          state: listing.state,
        } as any,
      });
    }
  }

  private async sendEmailNotification(notification: Notification, user: User): Promise<void> {
    if (!user.email) {
      throw new NotificationDeliveryAttemptError(
        "suppressed",
        "RECIPIENT_EMAIL_MISSING",
        "Email suppressed because the recipient has no email address."
      );
    }
    if (!emailService.isConfigured()) {
      throw new NotificationDeliveryAttemptError(
        "failed",
        "EMAIL_PROVIDER_NOT_CONFIGURED",
        "Email delivery failed because no email provider is configured."
      );
    }

    const emailSubject = notification.title;

    const result = await emailService.sendEmail({
      to: user.email,
      subject: emailSubject,
      html: renderNotificationEmailHtml(notification, user),
      text: renderNotificationEmailText(notification),
      purpose: resolveNotificationEmailPurpose(notification.metadata),
    });

    if (result.skipped) {
      if (result.skippedReason === "email_mode_suppressed") {
        throw new NotificationDeliveryAttemptError(
          "suppressed",
          "EMAIL_MODE_SUPPRESSED",
          `Email suppressed by EMAIL_MODE for purpose ${resolveNotificationEmailPurpose(notification.metadata)}.`
        );
      }
      throw new NotificationDeliveryAttemptError(
        "failed",
        "EMAIL_PROVIDER_NOT_CONFIGURED",
        "Email delivery failed because no email provider is configured."
      );
    }

    await this.logDelivery({
      notificationId: notification.id,
      userId: user.id,
      deliveryMethod: "email",
      status: "sent",
      contactInfo: user.email,
      externalId: result.messageId,
      externalResponse: {
        provider: result.provider,
        providerStatus: "accepted",
      },
    });
  }

  private async sendSMSNotification(notification: Notification, user: User): Promise<void> {
    // SMS implementation would go here (Twilio, etc.)
    // For now, just log that SMS would be sent
    console.log(`SMS notification would be sent to ${user.phone}: ${notification.message}`);
    await this.logDelivery({
      notificationId: notification.id,
      userId: user.id,
      deliveryMethod: "sms",
      status: "sent",
      contactInfo: user.phone || undefined,
    });
  }

  private async sendPushNotification(notification: Notification, userId: string): Promise<void> {
    if (!this.webPushConfigured) return;

    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (!subs.length) return;

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.message,
      url: notification.actionUrl || undefined,
    });

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys as any,
            },
            payload
          );
          await this.logDelivery({
            notificationId: notification.id,
            userId,
            deliveryMethod: "push",
            status: "sent",
            contactInfo: sub.endpoint,
          });
        } catch (err: any) {
          console.error("Failed to send web push notification", err);
          const failure = resolveNotificationDeliveryFailure(err, "push");
          await this.logDelivery({
            notificationId: notification.id,
            userId,
            deliveryMethod: "push",
            status: failure.status,
            contactInfo: sub.endpoint,
            errorCode: failure.errorCode,
            errorMessage: failure.errorMessage,
          });

          const statusCode = err?.statusCode ?? err?.statusCode?.value;
          if (statusCode === 404 || statusCode === 410) {
            try {
              await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
            } catch (cleanupErr) {
              console.error("Failed to cleanup dead push subscription", cleanupErr);
            }
          }
        }
      })
    );
  }

  private async logDelivery(input: NotificationDeliveryLogInput): Promise<void> {
    try {
      await db.insert(notificationDeliveryLog).values(buildNotificationDeliveryLogValues(input));
    } catch (error) {
      // Delivery evidence must never become a second delivery gate. In
      // particular, a missing/lagging delivery-log migration must not prevent
      // later methods (email/push) from being attempted.
      console.error("[notifications] Failed to persist delivery evidence", {
        notificationId: input.notificationId,
        userId: input.userId,
        deliveryMethod: input.deliveryMethod,
        status: input.status,
        error,
      });
    }
  }

  // =====================================
  // BULK OPERATIONS
  // =====================================

  async sendBulkNotification(
    userIds: string[],
    notification: Omit<InsertNotification, "userId">
  ): Promise<void> {
    const notificationRecords: any[] = userIds.map((userId) => ({
      ...notification,
      userId,
      deliveryMethods: notification.deliveryMethods || ["in_app"],
    }));

    await db.insert(notifications).values(notificationRecords);
  }

  async processScheduledNotifications(): Promise<void> {
    const now = new Date();

    // Get notifications scheduled for now or earlier that haven't been sent
    const scheduledNotifications = await db
      .select()
      .from(notifications)
      .where(and(sql`${notifications.scheduledFor} <= ${now}`, isNull(notifications.sentAt)));

    for (const notification of scheduledNotifications) {
      try {
        await this.sendNotification(notification.id);
      } catch (error) {
        console.error(`Failed to send scheduled notification ${notification.id}:`, error);
      }
    }
  }

  // =====================================
  // ROLE-SPECIFIC NOTIFICATIONS
  // =====================================

  async sendWelcomeNotification(userId: string, userRole: string): Promise<void> {
    const roleMessages: Record<string, { title: string; message: string; actionUrl?: string }> = {
      homeowner: {
        title: "Welcome to TradeScout! 🏠",
        message:
          "Ready to find reliable contractors for your home? Start by opening a Direct Connect request and exploring contractors in your area. Scout surfaces local options, and TradeScout routes your next step for quotes and coordination.",
        actionUrl: "/contractors/board",
      },
      contractor_user: {
        title: "Welcome to TradeScout! 🔨",
        message:
          "Start growing your contracting business today! Complete your profile to attract quality leads and join our contractor community.",
        actionUrl: "/profile",
      },
      helper: {
        title: "Welcome to TradeScout Helpers! 🤝",
        message:
          "Ready to find work opportunities? Browse helper and crew opportunities from contractors and communities. Homeowners start coordination in Direct Connect; you respond here.",
        actionUrl: "/helpers",
      },
      accelerator_member: {
        title: "Welcome to TradeScout Accelerator! ⭐",
        message:
          "Unlock premium features, priority leads, and advanced business tools. Your accelerated growth starts now!",
        actionUrl: "/dashboard",
      },
    };

    const roleConfig = roleMessages[userRole] || roleMessages.homeowner;

    await this.createNotification({
      userId,
      type: "welcome",
      priority: "normal",
      title: roleConfig.title,
      message: roleConfig.message,
      actionUrl: roleConfig.actionUrl,
      actionText: "Get Started",
      iconName: "sparkles",
      iconColor: "blue",
      deliveryMethods: ["in_app", "email"] as string[],
    });
  }

  async sendMilestoneNotification(
    userId: string,
    milestone: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.createNotification({
      userId,
      type: "milestone",
      priority: "normal",
      title: `Milestone Achieved: ${milestone}! 🎉`,
      message: description,
      iconName: "award",
      iconColor: "gold",
      deliveryMethods: ["in_app"] as string[],
      metadata: {
        milestone: milestone,
        ...metadata,
      } as any,
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
