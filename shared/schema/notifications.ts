import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export function createNotificationSchema(userId: () => AnyPgColumn) {
  const notificationTypeEnum = pgEnum("notification_type", [
    // Personal notifications
    "birthday",
    "anniversary",
    "milestone",
    "welcome",
    "reminder",

    // Activity notifications
    "new_message",
    "new_project_request",
    "new_application",
    "project_update",
    "payment_received",
    "review_received",
    "favorite_added",

    // System notifications
    "system_update",
    "maintenance",
    "security_alert",
    "verification_required",
    "document_expiring",
    "subscription_reminder",

    // Social notifications
    "new_follower",
    "post_liked",
    "comment_received",
    "mention",
    "community_invitation",

    // Direct Connect notifications
    "dc_provider_accepted",
    "dc_provider_declined",
    "dc_provider_interested",
    "dc_request_completed",
    "direct_connect_beta_request",
    // Marketing notifications
    "promotional",
    "feature_announcement",
    "tips_and_advice",
    "market_update",
    "seasonal_promotion",
  ]);

  // Notification priority enum
  const notificationPriorityEnum = pgEnum("notification_priority", [
    "low",
    "normal",
    "high",
    "urgent",
    "critical",
  ]);

  // Notification delivery method enum
  const deliveryMethodEnum = pgEnum("delivery_method", [
    "in_app",
    "email",
    "sms",
    "push",
    "webhook",
  ]);

  // Main notifications table
  const notifications = pgTable(
    "notifications",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(userId, { onDelete: "cascade" }),
      type: notificationTypeEnum("type").notNull(),
      priority: notificationPriorityEnum("priority").default("normal"),

      // Content
      title: varchar("title").notNull(),
      message: text("message").notNull(),
      actionUrl: varchar("action_url"), // URL to navigate to when clicked
      actionText: varchar("action_text"), // Button text for action

      // Rich content
      iconName: varchar("icon_name"), // Lucide icon name
      iconColor: varchar("icon_color").default("blue"), // Icon color theme
      imageUrl: varchar("image_url"),
      metadata: jsonb("metadata").$type<Record<string, any>>(), // Additional data

      // Delivery and status
      deliveryMethods: jsonb("delivery_methods")
        .$type<string[]>()
        .default(sql`'["in_app"]'`),
      isRead: boolean("is_read").default(false),
      readAt: timestamp("read_at"),
      isArchived: boolean("is_archived").default(false),
      archivedAt: timestamp("archived_at"),

      // Scheduling
      scheduledFor: timestamp("scheduled_for"), // For delayed notifications
      expiresAt: timestamp("expires_at"), // When notification becomes irrelevant

      // Grouping and batching
      groupId: varchar("group_id"), // For grouping similar notifications
      batchId: varchar("batch_id"), // For batch sending

      // Tracking
      sentAt: timestamp("sent_at"),
      deliveredAt: timestamp("delivered_at"),
      clickedAt: timestamp("clicked_at"),

      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow(),
    },
    (table) => [
      index("idx_notifications_user").on(table.userId),
      index("idx_notifications_type").on(table.type),
      index("idx_notifications_scheduled").on(table.scheduledFor),
      index("idx_notifications_unread").on(table.userId, table.isRead),
      index("idx_notifications_group").on(table.groupId),
    ]
  );

  // User notification preferences
  const notificationPreferences = pgTable(
    "notification_preferences",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(userId, { onDelete: "cascade" }),

      // General preferences
      enableNotifications: boolean("enable_notifications").default(true),
      enableEmailNotifications: boolean("enable_email_notifications").default(true),
      enableSmsNotifications: boolean("enable_sms_notifications").default(false),
      enablePushNotifications: boolean("enable_push_notifications").default(true),

      // Notification type preferences (jsonb for flexibility)
      typePreferences: jsonb("type_preferences")
        .$type<
          Record<
            string,
            {
              enabled: boolean;
              delivery_methods: string[];
              frequency?: "instant" | "hourly" | "daily" | "weekly";
            }
          >
        >()
        .default(sql`'{}'`),

      // Time preferences
      quietHoursStart: varchar("quiet_hours_start").default("22:00"), // 10 PM
      quietHoursEnd: varchar("quiet_hours_end").default("08:00"), // 8 AM
      timezone: varchar("timezone").default("America/New_York"),

      // Batching preferences
      batchDailyDigest: boolean("batch_daily_digest").default(false),
      batchWeeklyDigest: boolean("batch_weekly_digest").default(false),
      digestTime: varchar("digest_time").default("09:00"), // 9 AM

      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow(),
    },
    (table) => [index("idx_notification_preferences_user").on(table.userId)]
  );

  // Web push subscriptions for browser/device notifications
  const pushSubscriptions = pgTable(
    "push_subscriptions",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(userId, { onDelete: "cascade" }),
      endpoint: text("endpoint").notNull(),
      keys: jsonb("keys").$type<{ p256dh: string; auth: string }>().notNull(),
      userAgent: text("user_agent"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow(),
    },
    (table) => [
      index("idx_push_subscriptions_user").on(table.userId),
      uniqueIndex("uidx_push_subscriptions_endpoint").on(table.endpoint),
    ]
  );

  // User personal events for birthday and anniversary notifications
  const userPersonalEvents = pgTable(
    "user_personal_events",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(userId, { onDelete: "cascade" }),

      // Event details
      eventType: varchar("event_type").notNull(), // 'birthday', 'work_anniversary', 'business_anniversary', 'custom'
      eventName: varchar("event_name"), // Custom name for the event
      eventDate: varchar("event_date").notNull(), // MM-DD format for recurring events
      eventYear: integer("event_year"), // Optional year for non-recurring events

      // Notification settings
      enableNotifications: boolean("enable_notifications").default(true),
      notifyDaysBefore: jsonb("notify_days_before")
        .$type<number[]>()
        .default(sql`'[0, 1, 7]'`), // Day of, 1 day before, 1 week before
      customMessage: text("custom_message"),

      // Privacy
      isPublic: boolean("is_public").default(false), // Whether others can see this event
      shareWithTeam: boolean("share_with_team").default(false), // Share with team/company

      // Metadata
      metadata: jsonb("metadata").$type<Record<string, any>>(),

      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow(),
    },
    (table) => [
      index("idx_user_personal_events_user").on(table.userId),
      index("idx_user_personal_events_date").on(table.eventDate),
    ]
  );

  // Notification delivery log for tracking and analytics
  const notificationDeliveryLog = pgTable(
    "notification_delivery_log",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()`),
      notificationId: varchar("notification_id")
        .notNull()
        .references(() => notifications.id, { onDelete: "cascade" }),
      userId: varchar("user_id").notNull().references(userId, { onDelete: "cascade" }),

      // Delivery details
      deliveryMethod: deliveryMethodEnum("delivery_method").notNull(),
      status: varchar("status").notNull(), // 'pending', 'sent', 'delivered', 'failed', 'bounced'

      // Contact info used
      contactInfo: varchar("contact_info"), // Email address or phone number used

      // External service details
      externalId: varchar("external_id"), // ID from external service (SendGrid, Twilio, etc.)
      externalResponse: jsonb("external_response").$type<Record<string, any>>(),

      // Error tracking
      errorCode: varchar("error_code"),
      errorMessage: text("error_message"),
      retryCount: integer("retry_count").default(0),
      nextRetryAt: timestamp("next_retry_at"),

      // Timestamps
      sentAt: timestamp("sent_at"),
      deliveredAt: timestamp("delivered_at"),
      failedAt: timestamp("failed_at"),

      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow(),
    },
    (table) => [
      index("idx_notification_delivery_notification").on(table.notificationId),
      index("idx_notification_delivery_user").on(table.userId),
      index("idx_notification_delivery_status").on(table.status),
      index("idx_notification_delivery_retry").on(table.nextRetryAt),
    ]
  );

  // Notification templates for consistent messaging
  const notificationTemplates = pgTable(
    "notification_templates",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()`),

      // Template identification
      type: notificationTypeEnum("type").notNull(),
      name: varchar("name").notNull(),
      description: text("description"),

      // Template content
      titleTemplate: varchar("title_template").notNull(),
      messageTemplate: text("message_template").notNull(),
      emailSubjectTemplate: varchar("email_subject_template"),
      emailBodyTemplate: text("email_body_template"),
      smsTemplate: text("sms_template"),

      // Template variables
      templateVariables: jsonb("template_variables").$type<string[]>(), // List of available variables

      // Appearance
      iconName: varchar("icon_name"),
      iconColor: varchar("icon_color").default("blue"),
      priority: notificationPriorityEnum("priority").default("normal"),

      // Settings
      defaultDeliveryMethods: jsonb("default_delivery_methods")
        .$type<string[]>()
        .default(sql`'["in_app"]'`),
      expiresAfterHours: integer("expires_after_hours").default(168), // 1 week default

      // Status
      isActive: boolean("is_active").default(true),
      isDefault: boolean("is_default").default(false), // Default template for this type

      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow(),
    },
    (table) => [
      index("idx_notification_templates_type").on(table.type),
      index("idx_notification_templates_active").on(table.isActive),
    ]
  );

  // Scheduled notification jobs for batch processing
  const notificationJobs = pgTable(
    "notification_jobs",
    {
      id: varchar("id")
        .primaryKey()
        .default(sql`gen_random_uuid()`),

      // Job details
      jobType: varchar("job_type").notNull(), // 'birthday_batch', 'weekly_digest', 'reminder_batch', etc.
      scheduledFor: timestamp("scheduled_for").notNull(),

      // Target criteria
      targetUserIds: jsonb("target_user_ids").$type<string[]>(),
      targetFilters: jsonb("target_filters").$type<Record<string, any>>(), // Dynamic user filtering

      // Notification details
      notificationType: notificationTypeEnum("notification_type").notNull(),
      templateId: varchar("template_id").references(() => notificationTemplates.id),
      templateData: jsonb("template_data").$type<Record<string, any>>(),

      // Processing status
      status: varchar("status").default("pending"), // 'pending', 'running', 'completed', 'failed', 'cancelled'
      startedAt: timestamp("started_at"),
      completedAt: timestamp("completed_at"),

      // Results
      targetCount: integer("target_count").default(0),
      successCount: integer("success_count").default(0),
      failureCount: integer("failure_count").default(0),
      errorLog: jsonb("error_log").$type<
        Array<{
          userId: string;
          error: string;
          timestamp: string;
        }>
      >(),

      // Retry logic
      maxRetries: integer("max_retries").default(3),
      retryCount: integer("retry_count").default(0),
      nextRetryAt: timestamp("next_retry_at"),

      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow(),
    },
    (table) => [
      index("idx_notification_jobs_scheduled").on(table.scheduledFor),
      index("idx_notification_jobs_status").on(table.status),
      index("idx_notification_jobs_type").on(table.jobType),
    ]
  );

  // Insert schemas for notification system
  const insertNotificationSchema = createInsertSchema(notifications).omit({
    id: true,
    isRead: true,
    readAt: true,
    isArchived: true,
    archivedAt: true,
    sentAt: true,
    deliveredAt: true,
    clickedAt: true,
    createdAt: true,
    updatedAt: true,
  });

  const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

  const insertUserPersonalEventSchema = createInsertSchema(userPersonalEvents).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

  const insertNotificationTemplateSchema = createInsertSchema(notificationTemplates).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });
  return {
    notificationTypeEnum,
    notificationPriorityEnum,
    deliveryMethodEnum,
    notifications,
    notificationPreferences,
    pushSubscriptions,
    userPersonalEvents,
    notificationDeliveryLog,
    notificationTemplates,
    notificationJobs,
    insertNotificationSchema,
    insertNotificationPreferencesSchema,
    insertUserPersonalEventSchema,
    insertNotificationTemplateSchema,
  };
}
