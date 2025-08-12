import { db } from "./db";
import {
  notifications,
  notificationPreferences,
  userPersonalEvents,
  notificationTemplates,
  notificationDeliveryLog,
  notificationJobs,
  users,
  type Notification,
  type InsertNotification,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  type UserPersonalEvent,
  type InsertUserPersonalEvent,
  type NotificationTemplate,
  type InsertNotificationTemplate,
  type User,
} from "@shared/schema";
import { eq, and, or, sql, desc, asc } from "drizzle-orm";
import { MailService } from '@sendgrid/mail';

// Notification Service Class
export class NotificationService {
  private mailService?: MailService;

  constructor() {
    // Initialize SendGrid if API key is available
    if (process.env.SENDGRID_API_KEY) {
      this.mailService = new MailService();
      this.mailService.setApiKey(process.env.SENDGRID_API_KEY);
    }
  }

  // =====================================
  // NOTIFICATION OPERATIONS
  // =====================================

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    
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
    let query = db.select().from(notifications).where(eq(notifications.userId, userId));

    if (options.unreadOnly) {
      query = query.where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    }

    if (options.type) {
      query = query.where(and(
        eq(notifications.userId, userId),
        eq(notifications.type, options.type as any)
      ));
    }

    query = query.orderBy(desc(notifications.createdAt));

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return await query;
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    
    return result[0]?.count || 0;
  }

  async archiveNotification(notificationId: string, userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));
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
      const [updated] = await db
        .update(notificationPreferences)
        .set({ ...preferences, updatedAt: new Date() })
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return updated;
    } else {
      // Create new preferences
      const [created] = await db
        .insert(notificationPreferences)
        .values({ userId, ...preferences })
        .returning();
      return created;
    }
  }

  async createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
    const [created] = await db
      .insert(notificationPreferences)
      .values({
        userId,
        enableNotifications: true,
        enableEmailNotifications: true,
        enableSmsNotifications: false,
        enablePushNotifications: true,
        typePreferences: {
          birthday: { enabled: true, delivery_methods: ['in_app', 'email'] },
          anniversary: { enabled: true, delivery_methods: ['in_app'] },
          new_message: { enabled: true, delivery_methods: ['in_app', 'email'] },
          new_lead: { enabled: true, delivery_methods: ['in_app', 'email'] },
          review_received: { enabled: true, delivery_methods: ['in_app'] },
          system_update: { enabled: true, delivery_methods: ['in_app'] },
          promotional: { enabled: false, delivery_methods: ['in_app'] },
        },
      })
      .returning();
    
    return created;
  }

  // =====================================
  // PERSONAL EVENTS (BIRTHDAYS, ANNIVERSARIES)
  // =====================================

  async addPersonalEvent(event: InsertUserPersonalEvent): Promise<UserPersonalEvent> {
    const [created] = await db.insert(userPersonalEvents).values(event).returning();
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
    const [updated] = await db
      .update(userPersonalEvents)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(userPersonalEvents.id, eventId),
        eq(userPersonalEvents.userId, userId)
      ))
      .returning();
    
    return updated || null;
  }

  async deletePersonalEvent(eventId: string, userId: string): Promise<void> {
    await db
      .delete(userPersonalEvents)
      .where(and(
        eq(userPersonalEvents.id, eventId),
        eq(userPersonalEvents.userId, userId)
      ));
  }

  // =====================================
  // BIRTHDAY AND ANNIVERSARY PROCESSING
  // =====================================

  async processBirthdayNotifications(): Promise<void> {
    const today = new Date();
    const todayString = String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(today.getDate()).padStart(2, '0'); // MM-DD format

    // Find all birthday events for today
    const birthdayEvents = await db
      .select()
      .from(userPersonalEvents)
      .innerJoin(users, eq(userPersonalEvents.userId, users.id))
      .where(and(
        eq(userPersonalEvents.eventType, 'birthday'),
        eq(userPersonalEvents.eventDate, todayString),
        eq(userPersonalEvents.enableNotifications, true)
      ));

    for (const { user_personal_events: event, users: user } of birthdayEvents) {
      // Calculate age if birth year is provided
      let age: number | null = null;
      if (event.eventYear) {
        age = today.getFullYear() - event.eventYear;
      }

      // Create birthday notification
      await this.createNotification({
        userId: user.id,
        type: 'birthday',
        priority: 'normal',
        title: age ? `Happy ${age}th Birthday!` : 'Happy Birthday!',
        message: event.customMessage || 
          `${user.firstName ? `Happy birthday, ${user.firstName}` : 'Happy birthday'}! 🎉 Wishing you a wonderful day filled with joy and celebration.`,
        iconName: 'gift',
        iconColor: 'pink',
        deliveryMethods: ['in_app', 'email'],
        metadata: {
          age,
          eventType: 'birthday',
          celebrationYear: today.getFullYear(),
        },
      });
    }

    // Process anniversary notifications similarly
    await this.processAnniversaryNotifications(todayString);
  }

  async processAnniversaryNotifications(todayString?: string): Promise<void> {
    if (!todayString) {
      const today = new Date();
      todayString = String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(today.getDate()).padStart(2, '0');
    }

    const anniversaryEvents = await db
      .select()
      .from(userPersonalEvents)
      .innerJoin(users, eq(userPersonalEvents.userId, users.id))
      .where(and(
        or(
          eq(userPersonalEvents.eventType, 'work_anniversary'),
          eq(userPersonalEvents.eventType, 'business_anniversary')
        ),
        eq(userPersonalEvents.eventDate, todayString),
        eq(userPersonalEvents.enableNotifications, true)
      ));

    for (const { user_personal_events: event, users: user } of anniversaryEvents) {
      let years: number | null = null;
      if (event.eventYear) {
        years = new Date().getFullYear() - event.eventYear;
      }

      const anniversaryType = event.eventType === 'work_anniversary' ? 'work' : 'business';
      
      await this.createNotification({
        userId: user.id,
        type: 'anniversary',
        priority: 'normal',
        title: years ? `${years} Year ${anniversaryType.charAt(0).toUpperCase() + anniversaryType.slice(1)} Anniversary!` : 
                      `${anniversaryType.charAt(0).toUpperCase() + anniversaryType.slice(1)} Anniversary!`,
        message: event.customMessage || 
          `Congratulations on your ${years ? `${years} year ` : ''}${anniversaryType} anniversary! 🎊`,
        iconName: 'award',
        iconColor: 'gold',
        deliveryMethods: ['in_app', 'email'],
        metadata: {
          years,
          eventType: event.eventType,
          anniversaryYear: new Date().getFullYear(),
        },
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
      throw new Error('Notification not found');
    }

    const { notifications: notification, users: user, notification_preferences: preferences } = notificationData;

    // Check if user has notifications enabled
    if (preferences && !preferences.enableNotifications) {
      return;
    }

    // Send via enabled delivery methods
    const deliveryMethods = notification.deliveryMethods || ['in_app'];

    for (const method of deliveryMethods) {
      try {
        switch (method) {
          case 'email':
            if (preferences?.enableEmailNotifications !== false && user.email) {
              await this.sendEmailNotification(notification, user);
            }
            break;
          case 'sms':
            if (preferences?.enableSmsNotifications && user.phoneNumber) {
              await this.sendSMSNotification(notification, user);
            }
            break;
          case 'in_app':
            // In-app notifications are already stored in the database
            await this.logDelivery(notificationId, user.id, 'in_app', 'delivered');
            break;
        }
      } catch (error) {
        console.error(`Failed to send ${method} notification:`, error);
        await this.logDelivery(notificationId, user.id, method as any, 'failed', String(error));
      }
    }

    // Update notification as sent
    await db
      .update(notifications)
      .set({ sentAt: new Date() })
      .where(eq(notifications.id, notificationId));
  }

  private async sendEmailNotification(notification: Notification, user: User): Promise<void> {
    if (!this.mailService || !user.email) {
      throw new Error('Email service not configured or user email missing');
    }

    const emailSubject = notification.title;
    const emailBody = this.generateEmailHTML(notification, user);

    await this.mailService.send({
      to: user.email,
      from: 'notifications@tradescout.app',
      subject: emailSubject,
      html: emailBody,
      text: notification.message,
    });

    await this.logDelivery(notification.id, user.id, 'email', 'sent', user.email);
  }

  private async sendSMSNotification(notification: Notification, user: User): Promise<void> {
    // SMS implementation would go here (Twilio, etc.)
    // For now, just log that SMS would be sent
    console.log(`SMS notification would be sent to ${user.phoneNumber}: ${notification.message}`);
    await this.logDelivery(notification.id, user.id, 'sms', 'sent', user.phoneNumber);
  }

  private generateEmailHTML(notification: Notification, user: User): string {
    const userName = user.firstName || 'there';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${notification.title}</title>
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
            <h2>${notification.title}</h2>
            <p>Hi ${userName},</p>
            <p>${notification.message}</p>
            ${notification.actionUrl ? 
              `<p><a href="${notification.actionUrl}" class="button">${notification.actionText || 'View Details'}</a></p>` : 
              ''
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
    method: 'in_app' | 'email' | 'sms' | 'push' | 'webhook',
    status: string,
    contactInfo?: string
  ): Promise<void> {
    await db.insert(notificationDeliveryLog).values({
      notificationId,
      userId,
      deliveryMethod: method,
      status,
      contactInfo,
      sentAt: status === 'sent' || status === 'delivered' ? new Date() : undefined,
      deliveredAt: status === 'delivered' ? new Date() : undefined,
      failedAt: status === 'failed' ? new Date() : undefined,
    });
  }

  // =====================================
  // BULK OPERATIONS
  // =====================================

  async sendBulkNotification(
    userIds: string[],
    notification: Omit<InsertNotification, 'userId'>
  ): Promise<void> {
    const notifications: InsertNotification[] = userIds.map(userId => ({
      ...notification,
      userId,
    }));

    await db.insert(notifications).values(notifications);
  }

  async processScheduledNotifications(): Promise<void> {
    const now = new Date();
    
    // Get notifications scheduled for now or earlier that haven't been sent
    const scheduledNotifications = await db
      .select()
      .from(notifications)
      .where(and(
        sql`${notifications.scheduledFor} <= ${now}`,
        eq(notifications.sentAt, null)
      ));

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
        title: 'Welcome to TradeScout! 🏠',
        message: 'Ready to find reliable contractors for your home projects? Start by exploring contractors in your area and get quotes for your next project.',
        actionUrl: '/contractors/board'
      },
      contractor_user: {
        title: 'Welcome to TradeScout! 🔨',
        message: 'Start growing your contracting business today! Complete your profile to attract quality leads and join our contractor community.',
        actionUrl: '/profile'
      },
      helper: {
        title: 'Welcome to TradeScout Helpers! 🤝',
        message: 'Ready to find work opportunities? Browse available tasks and start earning by helping contractors and homeowners with their projects.',
        actionUrl: '/helpers'
      },
      accelerator_member: {
        title: 'Welcome to TradeScout Accelerator! ⭐',
        message: 'Unlock premium features, priority leads, and advanced business tools. Your accelerated growth starts now!',
        actionUrl: '/dashboard'
      }
    };

    const roleConfig = roleMessages[userRole] || roleMessages.homeowner;

    await this.createNotification({
      userId,
      type: 'welcome',
      priority: 'normal',
      title: roleConfig.title,
      message: roleConfig.message,
      actionUrl: roleConfig.actionUrl,
      actionText: 'Get Started',
      iconName: 'sparkles',
      iconColor: 'blue',
      deliveryMethods: ['in_app', 'email'],
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
      type: 'milestone',
      priority: 'normal',
      title: `Milestone Achieved: ${milestone}! 🎉`,
      message: description,
      iconName: 'award',
      iconColor: 'gold',
      deliveryMethods: ['in_app'],
      metadata: {
        milestone,
        ...metadata,
      },
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();