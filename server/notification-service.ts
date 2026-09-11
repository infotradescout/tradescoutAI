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
  workRequests,
  workRequestAssignments,
  workRequestEvents,
  contractors,
  businesses,
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
import { eq, and, or, sql, desc, asc, isNull, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { emailService, EmailDeliveryError, maskEmailForLog } from "./services/emailService";
import webPush from "web-push";

const EMAIL_JOB_TYPE = "notification_email_v1";
const EMAIL_MAX_ATTEMPTS = 5;
const EMAIL_LEASE_MS = 10 * 60_000;

type ProviderEmailBinding = { requestId: string; assignmentId: string; eventId: string };
type ProviderEmailContext = {
  request: any;
  assignment: any;
  event: any;
  contractor: any | null;
  business: any | null;
};

function providerNotificationId(binding: ProviderEmailBinding, userId: string) {
  return `dc-provider:${createHash("sha256")
    .update(JSON.stringify([binding.requestId, binding.assignmentId, binding.eventId, userId]))
    .digest("hex")}`;
}

function hasExplicitProviderEmailConsent(
  user: Pick<User, "emailVerified">,
  preferences: NotificationPreferences | null
) {
  const type = preferences?.typePreferences?.new_project_request;
  return (
    user.emailVerified === true &&
    preferences?.enableNotifications === true &&
    preferences.enableEmailNotifications === true &&
    type?.enabled === true &&
    Array.isArray(type.delivery_methods) &&
    type.delivery_methods.includes("email")
  );
}

function deliveryMethodsFor(
  notification: Notification,
  preferences: NotificationPreferences | null
): string[] {
  if (preferences?.enableNotifications === false) return [];
  const typePreferences = preferences?.typePreferences?.[notification.type];
  if (typePreferences?.enabled === false) return [];
  const requested = notification.deliveryMethods || ["in_app"];
  // Preferences can narrow the producer's contact boundary, never broaden it.
  return Array.isArray(typePreferences?.delivery_methods)
    ? requested.filter((method) => typePreferences.delivery_methods.includes(method))
    : requested;
}

function escapeEmailHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!
  );
}

// Notification Service Class
export class NotificationService {
  private webPushConfigured = false;
  private processingEmailJobs = false;
  private providerEmailEligibility?: (context: ProviderEmailContext) => Promise<boolean>;

  configureDirectConnectEmailEligibility(
    validator: (context: ProviderEmailContext) => Promise<boolean>
  ) {
    this.providerEmailEligibility = validator;
  }

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
    return this.persistNotification(notification);
  }

  /** Normal provider event producers only; staff oversight uses createNotification. */
  async createAssignedProviderNotification(
    notification: InsertNotification,
    requestId: string
  ): Promise<Notification> {
    const safeNotification = {
      ...notification,
      deliveryMethods: (notification.deliveryMethods || ["in_app"]).filter(
        (method) => method !== "email"
      ),
    };
    let context: ProviderEmailContext | null = null;
    try {
      context =
        notification.type === "new_project_request"
          ? await this.loadProviderEmailContext(requestId, notification.userId)
          : null;
    } catch {
      console.warn(
        "[Notifications] Provider email context unavailable; retaining in-app notification",
        { requestId }
      );
    }
    if (!context) return this.persistNotification(safeNotification);
    const binding = { requestId, assignmentId: context.assignment.id, eventId: context.event.id };
    let explicitConsent = false;
    let evaluationDeferred = false;
    try {
      const [user] = await db
        .select({ emailVerified: users.emailVerified })
        .from(users)
        .where(eq(users.id, notification.userId));
      const preferences = await this.getUserPreferences(notification.userId);
      explicitConsent = Boolean(user && hasExplicitProviderEmailConsent(user, preferences));
      if (
        explicitConsent &&
        this.providerEmailEligibility &&
        (await this.providerEmailEligibility(context))
      )
        safeNotification.deliveryMethods.push("email");
    } catch {
      evaluationDeferred = explicitConsent;
      console.warn(
        "[Notifications] Provider eligibility unavailable; retaining in-app notification",
        { requestId }
      );
    }
    return this.persistNotification(
      {
        ...safeNotification,
        metadata: {
          ...notification.metadata,
          directConnectProviderEmail: binding,
          directConnectProviderEmailDeferred: evaluationDeferred,
        },
      },
      providerNotificationId(binding, notification.userId),
      true
    );
  }

  private async persistNotification(
    notification: InsertNotification,
    id?: string,
    recoverDeferredProviderEmail = false
  ): Promise<Notification> {
    const notificationData: any = {
      ...notification,
      ...(id ? { id } : {}),
      deliveryMethods: notification.deliveryMethods || ["in_app"],
    };

    // Persist the email intent in the same transaction as the inbox record.
    // A request process exiting before delivery cannot lose an opted-in email.
    const result = await db.transaction(async (tx: any) => {
      const [record] = await tx
        .insert(notifications)
        .values([notificationData])
        .onConflictDoNothing({ target: notifications.id })
        .returning();
      if (!record) {
        const [existing] = await tx
          .select()
          .from(notifications)
          .where(eq(notifications.id, id!))
          .for("update");
        if (!existing || existing.userId !== notification.userId)
          throw new Error("Notification identity conflict");
        // Retry only an explicitly opted-in event whose initial eligibility
        // evaluation failed. New opt-ins never backfill old notifications.
        if (
          recoverDeferredProviderEmail &&
          existing.metadata?.directConnectProviderEmailDeferred === true &&
          notification.deliveryMethods?.includes("email")
        ) {
          const [recovered] = await tx
            .update(notifications)
            .set({
              deliveryMethods: Array.from(
                new Set([...(existing.deliveryMethods || ["in_app"]), "email"])
              ),
              metadata: { ...existing.metadata, directConnectProviderEmailDeferred: false },
              updatedAt: new Date(),
            })
            .where(eq(notifications.id, id!))
            .returning();
          // A completed/unknown/failed job keeps its existing identity and state.
          await this.enqueueEmailNotification(tx, recovered);
          return { notification: recovered as Notification, created: false };
        }
        return { notification: existing as Notification, created: false };
      }
      await this.enqueueEmailNotification(tx, record);
      return { notification: record as Notification, created: true };
    });
    const created = result.notification;

    // Send notification if not scheduled
    if (result.created && !notification.scheduledFor) {
      await this.sendNotification(created.id);
    }

    return created;
  }

  private async loadProviderEmailContext(
    requestId: string,
    userId: string,
    binding?: ProviderEmailBinding
  ): Promise<ProviderEmailContext | null> {
    const [request] = await db.select().from(workRequests).where(eq(workRequests.id, requestId));
    if (
      !request ||
      request.source !== "direct_connect" ||
      request.status !== "routed" ||
      request.createdByUserId === userId
    )
      return null;
    const assignments = await db
      .select()
      .from(workRequestAssignments)
      .where(eq(workRequestAssignments.workRequestId, requestId));
    const contractorIds = assignments.map((a: any) => a.contractorId).filter(Boolean);
    const profiles = contractorIds.length
      ? await db.select().from(contractors).where(inArray(contractors.id, contractorIds))
      : [];
    const matching = assignments.filter((a: any) => {
      const contractor = profiles.find((profile: any) => profile.id === a.contractorId);
      return a.contractorId ? contractor?.userId === userId : a.responderUserId === userId;
    });
    // An account with multiple assignments is ambiguous; never pick the newest.
    if (matching.length !== 1) return null;
    const assignment = matching[0];
    if (
      assignment.workerId ||
      !["suggested", "invited"].includes(assignment.status) ||
      (binding && binding.assignmentId !== assignment.id) ||
      String(assignment.scoreSnapshot?.routingMode || "").includes("admin")
    )
      return null;
    const contractor =
      profiles.find((profile: any) => profile.id === assignment.contractorId) || null;
    const events = await db
      .select()
      .from(workRequestEvents)
      .where(eq(workRequestEvents.workRequestId, requestId));
    const matchingEvents = events.filter((event: any) => {
      const metadata = event.metadata || {};
      return (
        ["provider_suggested", "provider_invited"].includes(event.type) &&
        event.actorUserId === request.createdByUserId &&
        metadata.source === "direct_connect" &&
        metadata.author?.kind !== "staff" &&
        !String(metadata.routeMode || "").includes("admin") &&
        (!metadata.assignmentId || metadata.assignmentId === assignment.id) &&
        new Date(event.createdAt).getTime() >= new Date(assignment.createdAt).getTime() &&
        (contractor
          ? metadata.contractorId === contractor.id && metadata.contractorUserId === userId
          : !metadata.contractorId && metadata.responderUserId === userId)
      );
    });
    if (matchingEvents.length !== 1 || (binding && binding.eventId !== matchingEvents[0].id))
      return null;
    const event = matchingEvents[0];
    const [business] =
      !contractor && typeof event.metadata?.businessId === "string"
        ? await db
            .select()
            .from(businesses)
            .where(
              and(eq(businesses.id, event.metadata.businessId), eq(businesses.ownerUserId, userId))
            )
        : [];
    if (!contractor && !business) return null;
    return { request, assignment, event, contractor, business: business || null };
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
    // The authenticated method argument owns the preference row. A submitted
    // userId must never transfer another person's delivery consent.
    const { userId: _submittedUserId, ...ownedPreferences } = preferences;
    // Check if preferences exist
    const existing = await this.getUserPreferences(userId);

    if (existing) {
      const updateData: any = { ...ownedPreferences, updatedAt: new Date() };
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
        .values({ ...ownedPreferences, userId } as any)
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

    const deliveryMethods = deliveryMethodsFor(notification, preferences);

    for (const method of deliveryMethods) {
      try {
        switch (method) {
          case "email":
            if (preferences?.enableEmailNotifications !== false && user.email) {
              await this.enqueueEmailNotification(db, notification);
            }
            break;
          case "sms":
            if (preferences?.enableSmsNotifications && user.phone) {
              await this.sendSMSNotification(notification, user);
            }
            break;
          case "in_app":
            // In-app notifications are already stored in the database
            await this.logDelivery(notificationId, user.id, "in_app", "delivered");
            break;
          case "push":
            if (preferences?.enablePushNotifications && this.webPushConfigured) {
              await this.sendPushNotification(notification, user.id);
            }
            break;
        }
      } catch (error) {
        console.error(`Failed to send ${method} notification:`, error);
        await this.logDelivery(notificationId, user.id, method as any, "failed", String(error));
      }
    }

    // Mark notification dispatch complete. Email acceptance and mailbox
    // delivery are separate per-channel evidence in notification_delivery_log.
    await db
      .update(notifications)
      .set({ sentAt: new Date() })
      .where(eq(notifications.id, notificationId));
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

  private async enqueueEmailNotification(
    connection: any,
    notification: Notification
  ): Promise<void> {
    if (!notification.deliveryMethods?.includes("email")) return;
    await connection
      .insert(notificationJobs)
      .values({
        id: `notification-email:${notification.id}`,
        jobType: EMAIL_JOB_TYPE,
        scheduledFor: notification.scheduledFor || new Date(),
        notificationType: notification.type,
        targetUserIds: [notification.userId],
        templateData: { notificationId: notification.id },
        status: "pending",
        maxRetries: EMAIL_MAX_ATTEMPTS,
        retryCount: 0,
        targetCount: 1,
      })
      .onConflictDoNothing({ target: notificationJobs.id });
  }

  /** Drain persisted email intent; safe to run on more than one scheduler. */
  async processEmailDeliveryJobs(limit = 20): Promise<number> {
    if (this.processingEmailJobs) return 0;
    this.processingEmailJobs = true;
    let processed = 0;
    try {
      // A process can die after the provider accepts but before the receipt is
      // committed. Such leases require reconciliation, never automatic resend.
      await db.execute(sql`
        UPDATE notification_jobs
        SET status = 'unknown', completed_at = NOW(), updated_at = NOW()
        WHERE job_type = ${EMAIL_JOB_TYPE} AND status = 'running'
          AND started_at < ${new Date(Date.now() - EMAIL_LEASE_MS)}
      `);
      // Validation has not submitted anything externally and is safe to retry
      // after interruption. Only a running submission has an uncertain outcome.
      await db.execute(sql`
        UPDATE notification_jobs
        SET status = CASE WHEN retry_count < max_retries THEN 'retry' ELSE 'failed' END,
            next_retry_at = NOW() + INTERVAL '1 minute', updated_at = NOW()
        WHERE job_type = ${EMAIL_JOB_TYPE} AND status = 'validating'
          AND started_at < ${new Date(Date.now() - EMAIL_LEASE_MS)}
      `);
      const batchSize = Math.min(100, Math.max(1, Math.floor(limit) || 20));
      while (processed < batchSize) {
        const claimed = await db.execute(sql`
          UPDATE notification_jobs AS job
          SET status = 'validating', started_at = NOW(), updated_at = NOW(),
              template_data = COALESCE(job.template_data, '{}'::jsonb) || jsonb_build_object('leaseId', gen_random_uuid()::text),
              retry_count = COALESCE(job.retry_count, 0) + 1
          WHERE job.id IN (
            SELECT id FROM notification_jobs
            WHERE job_type = ${EMAIL_JOB_TYPE} AND status IN ('pending', 'retry')
              AND scheduled_for <= NOW()
              AND (next_retry_at IS NULL OR next_retry_at <= NOW())
              AND COALESCE(retry_count, 0) < COALESCE(max_retries, ${EMAIL_MAX_ATTEMPTS})
            ORDER BY scheduled_for, id
            FOR UPDATE SKIP LOCKED LIMIT 1
          )
          RETURNING job.id, job.template_data AS "templateData",
            job.target_user_ids AS "targetUserIds", job.retry_count AS "retryCount",
            job.max_retries AS "maxRetries"
        `);
        const job = claimed.rows[0];
        if (!job) break;
        try {
          await this.deliverEmailJob(job);
        } catch (error) {
          if (job.providerAttemptStarted) throw error;
          await this.finishEmailJob(job, { status: "retry", code: "validation_unavailable" });
        }
        processed += 1;
      }
      return processed;
    } finally {
      this.processingEmailJobs = false;
    }
  }

  private async deliverEmailJob(job: any): Promise<void> {
    const notificationId = job.templateData?.notificationId;
    const [data] =
      typeof notificationId === "string"
        ? await db
            .select({
              notification: notifications,
              user: {
                id: users.id,
                email: users.email,
                firstName: users.firstName,
                emailVerified: users.emailVerified,
              },
              preferences: notificationPreferences,
            })
            .from(notifications)
            .innerJoin(users, eq(notifications.userId, users.id))
            .leftJoin(
              notificationPreferences,
              eq(notifications.userId, notificationPreferences.userId)
            )
            .where(eq(notifications.id, notificationId))
        : [];
    if (
      !data ||
      job.id !== `notification-email:${notificationId}` ||
      job.targetUserIds?.length !== 1 ||
      job.targetUserIds[0] !== data.user.id
    ) {
      await this.finishEmailJob(job, { status: "cancelled", code: "notification_unavailable" });
      return;
    }
    const { notification, user, preferences } = data;
    if (notification.scheduledFor && notification.scheduledFor > new Date()) {
      await db
        .update(notificationJobs)
        .set({
          status: "pending",
          scheduledFor: notification.scheduledFor,
          nextRetryAt: null,
          startedAt: null,
          retryCount: job.retryCount - 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(notificationJobs.id, job.id),
            eq(notificationJobs.status, "validating"),
            sql`${notificationJobs.templateData}->>'leaseId' = ${job.templateData.leaseId}`
          )
        );
      return;
    }
    if (
      notification.isArchived ||
      (notification.expiresAt && notification.expiresAt <= new Date()) ||
      !user.email ||
      preferences?.enableEmailNotifications === false ||
      !deliveryMethodsFor(notification, preferences).includes("email")
    ) {
      await this.finishEmailJob(
        job,
        { status: "cancelled", code: "notification_ineligible" },
        data
      );
      return;
    }

    let submissionAuthority = sql`TRUE`;
    if (notification.type === "new_project_request") {
      const binding = notification.metadata?.directConnectProviderEmail as
        | ProviderEmailBinding
        | undefined;
      const validBinding =
        binding &&
        [binding.requestId, binding.assignmentId, binding.eventId].every(
          (value) => typeof value === "string" && value.length > 0
        );
      const context =
        validBinding && notification.id === providerNotificationId(binding, user.id)
          ? await this.loadProviderEmailContext(binding.requestId, user.id, binding)
          : null;
      if (
        !context ||
        !hasExplicitProviderEmailConsent(user, preferences) ||
        !this.providerEmailEligibility ||
        !(await this.providerEmailEligibility(context))
      ) {
        await this.finishEmailJob(
          job,
          { status: "cancelled", code: "provider_invitation_ineligible" },
          data
        );
        return;
      }
      const current = await this.loadProviderEmailContext(binding!.requestId, user.id, binding);
      if (!current) {
        await this.finishEmailJob(
          job,
          { status: "cancelled", code: "provider_invitation_ineligible" },
          data
        );
        return;
      }
      if (JSON.stringify(current) !== JSON.stringify(context)) {
        await this.finishEmailJob(job, { status: "retry", code: "eligibility_changed" }, data);
        return;
      }
      // Serialize consent and invitation state with the submission transition.
      // Revocation after this transition cannot recall an already submitted email.
      submissionAuthority = sql`EXISTS (
        SELECT 1 FROM users recipient
        JOIN work_request_assignments assignment ON assignment.id = ${binding!.assignmentId}
        JOIN work_requests request ON request.id = assignment.work_request_id
        JOIN notifications notification ON notification.id = ${notification.id}
        LEFT JOIN contractors provider ON provider.id = assignment.contractor_id
        WHERE recipient.id = ${user.id} AND recipient.email = ${user.email}
          AND recipient.email_verified = true
          AND request.id = ${binding!.requestId} AND request.source = 'direct_connect' AND request.status = 'routed'
          AND request.county_fips IS NOT DISTINCT FROM ${current.request.countyFips}
          AND request.trade_id IS NOT DISTINCT FROM ${current.request.tradeId}
          AND assignment.status IN ('suggested', 'invited') AND assignment.worker_id IS NULL
          AND COALESCE(provider.user_id, assignment.responder_user_id) = recipient.id
          AND notification.user_id = recipient.id AND notification.is_archived IS NOT TRUE
          AND (notification.expires_at IS NULL OR notification.expires_at > NOW())
          AND notification.delivery_methods @> '["email"]'::jsonb
          AND EXISTS (
            SELECT 1 FROM notification_preferences preference WHERE preference.user_id = recipient.id
            GROUP BY preference.user_id HAVING BOOL_AND(COALESCE(
              preference.enable_notifications = true AND preference.enable_email_notifications = true
              AND preference.type_preferences @> '{"new_project_request":{"enabled":true,"delivery_methods":["email"]}}'::jsonb, false))
          )
      )`;
    }

    // Request titles and message bodies can contain private contact details.
    // Direct Connect mail is an inbox pointer, never a second contact surface.
    const isDirectConnect =
      notification.type.startsWith("dc_") ||
      ["new_project_request", "direct_connect_beta_request"].includes(notification.type);
    const content = isDirectConnect
      ? {
          ...notification,
          title: "Direct Connect update",
          message: "You have an update in Direct Connect. Sign in to review it and respond.",
          actionUrl: "/direct-connect/inbox",
          actionText: "Open Direct Connect",
        }
      : notification;
    let outcome: { status: string; code?: string; provider?: string; messageId?: string };
    const started = await db
      .update(notificationJobs)
      .set({ status: "running", updatedAt: new Date() })
      .where(
        and(
          eq(notificationJobs.id, job.id),
          eq(notificationJobs.status, "validating"),
          sql`${notificationJobs.templateData}->>'leaseId' = ${job.templateData.leaseId}`,
          submissionAuthority
        )
      )
      .returning({ id: notificationJobs.id });
    if (!started.length) {
      await this.finishEmailJob(
        job,
        { status: "cancelled", code: "submission_authority_changed" },
        data
      );
      return;
    }
    job.providerAttemptStarted = true;
    try {
      const result = await emailService.sendEmail({
        to: user.email,
        subject: content.title,
        html: this.generateEmailHTML(content, user),
        text: content.message,
        purpose: "notification",
        correlationId: notification.id,
        singleAttempt: true,
      });
      outcome = result.skipped
        ? {
            status: result.skippedReason === "email_mode_suppressed" ? "cancelled" : "retry",
            code: result.skippedReason,
            provider: result.provider,
          }
        : { status: "accepted", provider: result.provider, messageId: result.messageId };
    } catch (error) {
      const disposition = error instanceof EmailDeliveryError ? error.disposition : "unknown";
      outcome = {
        status:
          disposition === "retryable" ? "retry" : disposition === "rejected" ? "failed" : "unknown",
        code: `provider_${disposition}`,
      };
    }
    // Keep receipt persistence outside the provider catch. A DB failure after
    // acceptance must leave an uncertain lease, not schedule another send.
    await this.finishEmailJob(job, outcome, data);
  }

  private async finishEmailJob(
    job: any,
    outcome: { status: string; code?: string; provider?: string; messageId?: string },
    data?: { notification: Notification; user: { id: string; email: string | null } }
  ): Promise<void> {
    const now = new Date();
    const retry = outcome.status === "retry" && job.retryCount < job.maxRetries;
    const status = outcome.status === "retry" && !retry ? "failed" : outcome.status;
    const nextRetryAt = retry
      ? new Date(
          now.getTime() +
            Math.round(60_000 * 2 ** (job.retryCount - 1) * (0.85 + Math.random() * 0.3))
        )
      : null;
    await db.transaction(async (tx: any) => {
      const updated = await tx
        .update(notificationJobs)
        .set({
          status: status === "accepted" ? "completed" : status,
          completedAt: retry ? null : now,
          updatedAt: now,
          nextRetryAt,
          successCount: status === "accepted" ? 1 : 0,
          failureCount: status === "accepted" || status === "cancelled" ? 0 : job.retryCount,
          errorLog: outcome.code
            ? [{ userId: data?.user.id || "", error: outcome.code, timestamp: now.toISOString() }]
            : [],
        })
        .where(
          and(
            eq(notificationJobs.id, job.id),
            inArray(notificationJobs.status, ["validating", "running", "unknown"]),
            sql`${notificationJobs.templateData}->>'leaseId' = ${job.templateData.leaseId}`
          )
        )
        .returning({ id: notificationJobs.id });
      if (data && updated.length)
        await tx.insert(notificationDeliveryLog).values({
          notificationId: data.notification.id,
          userId: data.user.id,
          deliveryMethod: "email",
          status,
          contactInfo: data.user.email ? maskEmailForLog(data.user.email) : undefined,
          externalId: outcome.messageId,
          externalResponse: { provider: outcome.provider || null, state: status },
          errorCode: outcome.code,
          retryCount: job.retryCount,
          nextRetryAt,
          sentAt: status === "accepted" ? now : null,
          // Provider acceptance does not establish mailbox delivery.
          deliveredAt: null,
          failedAt: status === "failed" ? now : null,
        });
    });
  }

  private async sendSMSNotification(notification: Notification, user: User): Promise<void> {
    // SMS implementation would go here (Twilio, etc.)
    // For now, just log that SMS would be sent
    console.log(`SMS notification would be sent to ${user.phone}: ${notification.message}`);
    await this.logDelivery(notification.id, user.id, "sms", "sent", user.phone || undefined);
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
          await this.logDelivery(notification.id, userId, "push", "sent", sub.endpoint);
        } catch (err: any) {
          console.error("Failed to send web push notification", err);
          await this.logDelivery(notification.id, userId, "push", "failed", sub.endpoint);

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

  private generateEmailHTML(notification: Notification, user: Pick<User, "firstName">): string {
    const userName = escapeEmailHtml(user.firstName || "there");
    const title = escapeEmailHtml(notification.title);
    const message = escapeEmailHtml(notification.message);
    let actionUrl = "";
    try {
      const origin = new URL(
        process.env.APP_URL || process.env.CLIENT_ORIGIN || "https://www.thetradescout.com"
      );
      const target = new URL(notification.actionUrl || "", origin);
      if (
        notification.actionUrl &&
        ["http:", "https:"].includes(target.protocol) &&
        target.origin === origin.origin
      ) {
        actionUrl = escapeEmailHtml(target.href);
      }
    } catch {}

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
              actionUrl
                ? `<p><a href="${actionUrl}" class="button">${escapeEmailHtml(notification.actionText || "View Details")}</a></p>`
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

  private async logDelivery(
    notificationId: string,
    userId: string,
    method: "in_app" | "email" | "sms" | "push" | "webhook",
    status: string,
    contactInfo?: string
  ): Promise<void> {
    await db.insert(notificationDeliveryLog).values({
      notificationId,
      userId,
      deliveryMethod: method,
      status,
      contactInfo,
      sentAt: status === "sent" || status === "delivered" ? new Date() : undefined,
      deliveredAt: status === "delivered" ? new Date() : undefined,
      failedAt: status === "failed" ? new Date() : undefined,
    });
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

    if (!notificationRecords.length) return;
    await db.transaction(async (tx: any) => {
      const created = await tx.insert(notifications).values(notificationRecords).returning();
      for (const notification of created) await this.enqueueEmailNotification(tx, notification);
    });
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
