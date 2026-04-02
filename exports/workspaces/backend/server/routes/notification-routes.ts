import type { Express } from "express";
import { notificationService } from "../notification-service";
import { isAuthenticated } from "../auth";
import {
  insertNotificationSchema,
  insertNotificationPreferencesSchema,
  insertUserPersonalEventSchema,
  pushSubscriptions,
} from "@shared/schema";
import { z } from "zod";
import { db } from "../db";
import { eq } from "drizzle-orm";

export function registerNotificationRoutes(app: Express) {
  // =====================================
  // NOTIFICATION ENDPOINTS
  // =====================================

  // Get user's notifications
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { unread_only, limit = 50, offset = 0, type } = req.query;

      const notifications = await notificationService.getUserNotifications(userId, {
        unreadOnly: unread_only === "true",
        limit: parseInt(limit as string) || 50,
        offset: parseInt(offset as string) || 0,
        type: type as string,
      });

      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Get unread notification count
  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const count = await notificationService.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // Mark notification as read
  app.post("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const notificationId = req.params.id;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await notificationService.markNotificationAsRead(notificationId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await notificationService.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  });

  // Archive notification
  app.post("/api/notifications/:id/archive", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const notificationId = req.params.id;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await notificationService.archiveNotification(notificationId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error archiving notification:", error);
      res.status(500).json({ message: "Failed to archive notification" });
    }
  });

  // Create test notification (for development)
  app.post("/api/notifications/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const testNotification = await notificationService.createNotification({
        userId,
        type: "system_update",
        title: "Test Notification",
        message: "This is a test notification to verify the system is working correctly.",
        iconName: "bell",
        iconColor: "blue",
        deliveryMethods: ["in_app"],
      });

      res.json(testNotification);
    } catch (error) {
      console.error("Error creating test notification:", error);
      res.status(500).json({ message: "Failed to create test notification" });
    }
  });

  // =====================================
  // NOTIFICATION PREFERENCES ENDPOINTS
  // =====================================

  // Get user's notification preferences
  app.get("/api/notifications/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      let preferences = await notificationService.getUserPreferences(userId);

      // Create default preferences if none exist
      if (!preferences) {
        preferences = await notificationService.createDefaultPreferences(userId);
      }

      res.json(preferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
  });

  // Update notification preferences
  app.post("/api/notifications/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate request body
      const updateSchema = insertNotificationPreferencesSchema.partial();
      const validatedData = updateSchema.parse(req.body);

      const preferences = await notificationService.updateUserPreferences(userId, validatedData);

      res.json(preferences);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }

      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // =====================================
  // WEB PUSH SUBSCRIPTIONS
  // =====================================

  const pushSubscriptionSchema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
    userAgent: z.string().optional(),
  });

  app.post("/api/notifications/push-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const body = pushSubscriptionSchema.parse(req.body);

      // Upsert by endpoint
      const existing = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, body.endpoint));

      if (existing.length) {
        await db
          .update(pushSubscriptions)
          .set({
            userId,
            keys: body.keys,
            userAgent: body.userAgent,
            updatedAt: new Date(),
          })
          .where(eq(pushSubscriptions.endpoint, body.endpoint));
      } else {
        await db.insert(pushSubscriptions).values({
          userId,
          endpoint: body.endpoint,
          keys: body.keys,
          userAgent: body.userAgent,
        });
      }

      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      console.error("Error saving push subscription:", error);
      res.status(500).json({ message: "Failed to save push subscription" });
    }
  });

  app.delete("/api/notifications/push-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const endpoint = req.query.endpoint as string | undefined;
      if (!endpoint) {
        return res.status(400).json({ message: "Missing endpoint" });
      }

      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting push subscription:", error);
      res.status(500).json({ message: "Failed to delete push subscription" });
    }
  });

  // =====================================
  // PERSONAL EVENTS ENDPOINTS
  // =====================================

  // Get user's personal events
  app.get("/api/notifications/personal-events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const events = await notificationService.getUserPersonalEvents(userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching personal events:", error);
      res.status(500).json({ message: "Failed to fetch personal events" });
    }
  });

  // Add personal event
  app.post("/api/notifications/personal-events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate request body
      const validatedData = insertUserPersonalEventSchema.parse({
        ...req.body,
        userId,
      });

      const event = await notificationService.addPersonalEvent(validatedData);
      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }

      console.error("Error adding personal event:", error);
      res.status(500).json({ message: "Failed to add personal event" });
    }
  });

  // Update personal event
  app.put("/api/notifications/personal-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const eventId = req.params.id;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate request body
      const updateSchema = insertUserPersonalEventSchema.partial().omit({ userId: true });
      const validatedData = updateSchema.parse(req.body);

      const event = await notificationService.updatePersonalEvent(eventId, userId, validatedData);

      if (!event) {
        return res.status(404).json({ message: "Personal event not found" });
      }

      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }

      console.error("Error updating personal event:", error);
      res.status(500).json({ message: "Failed to update personal event" });
    }
  });

  // Delete personal event
  app.delete("/api/notifications/personal-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const eventId = req.params.id;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await notificationService.deletePersonalEvent(eventId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting personal event:", error);
      res.status(500).json({ message: "Failed to delete personal event" });
    }
  });

  // =====================================
  // MILESTONE AND WELCOME ENDPOINTS
  // =====================================

  // Send welcome notification (usually called during registration)
  app.post("/api/notifications/welcome", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await notificationService.sendWelcomeNotification(userId, userRole || "homeowner");
      res.json({ success: true });
    } catch (error) {
      console.error("Error sending welcome notification:", error);
      res.status(500).json({ message: "Failed to send welcome notification" });
    }
  });

  // Send milestone notification
  app.post("/api/notifications/milestone", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { milestone, description, metadata } = (req.body ?? {}) as any;

      if (!milestone || !description) {
        return res.status(400).json({
          message: "Milestone and description are required",
        });
      }

      await notificationService.sendMilestoneNotification(userId, milestone, description, metadata);

      res.json({ success: true });
    } catch (error) {
      console.error("Error sending milestone notification:", error);
      res.status(500).json({ message: "Failed to send milestone notification" });
    }
  });

  // =====================================
  // ADMIN ENDPOINTS
  // =====================================

  // Process birthday notifications (admin only)
  app.post("/api/admin/notifications/process-birthdays", isAuthenticated, async (req: any, res) => {
    try {
      const rawRole = typeof req.user?.role === "string" ? req.user.role.trim().toLowerCase() : "";
      const role = rawRole === "owner" || rawRole === "head_admin" ? "super_admin" : rawRole;
      if (role !== "super_admin" && role !== "ops_admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      await notificationService.processBirthdayNotifications();
      res.json({ success: true, message: "Birthday notifications processed" });
    } catch (error) {
      console.error("Error processing birthday notifications:", error);
      res.status(500).json({ message: "Failed to process birthday notifications" });
    }
  });

  // Process scheduled notifications (admin only)
  app.post("/api/admin/notifications/process-scheduled", isAuthenticated, async (req: any, res) => {
    try {
      const rawRole = typeof req.user?.role === "string" ? req.user.role.trim().toLowerCase() : "";
      const role = rawRole === "owner" || rawRole === "head_admin" ? "super_admin" : rawRole;
      if (role !== "super_admin" && role !== "ops_admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      await notificationService.processScheduledNotifications();
      res.json({ success: true, message: "Scheduled notifications processed" });
    } catch (error) {
      console.error("Error processing scheduled notifications:", error);
      res.status(500).json({ message: "Failed to process scheduled notifications" });
    }
  });
}
