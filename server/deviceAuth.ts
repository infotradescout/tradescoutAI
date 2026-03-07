import crypto from "crypto";
import type { Request } from "express";
import { db } from "./db";
import { trustedDevices } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface DeviceFingerprint {
  userAgent: string;
  ipAddress: string;
  acceptLanguage: string;
  acceptEncoding: string;
  timezone: string;
  screenResolution: string;
}

export class DeviceAuthService {
  // Generate device fingerprint from request headers and client data
  static generateFingerprint(req: Request, clientData?: Partial<DeviceFingerprint>): string {
    const fpData = {
      userAgent: req.headers["user-agent"] || "",
      ipAddress: req.ip || req.connection.remoteAddress || "",
      acceptLanguage: req.headers["accept-language"] || "",
      acceptEncoding: req.headers["accept-encoding"] || "",
      timezone: clientData?.timezone || "unknown",
      screenResolution: clientData?.screenResolution || "unknown",
    };

    const fingerprintString = Object.values(fpData).join("|");
    return crypto.createHash("sha256").update(fingerprintString).digest("hex");
  }

  // Get friendly device name from user agent
  static getDeviceName(userAgent: string): string {
    if (userAgent.includes("iPhone")) return "iPhone";
    if (userAgent.includes("iPad")) return "iPad";
    if (userAgent.includes("Android")) return "Android Device";
    if (userAgent.includes("Windows NT")) return "Windows Computer";
    if (userAgent.includes("Macintosh")) return "Mac Computer";
    if (userAgent.includes("Linux")) return "Linux Computer";
    if (userAgent.includes("Chrome")) return "Chrome Browser";
    if (userAgent.includes("Firefox")) return "Firefox Browser";
    if (userAgent.includes("Safari")) return "Safari Browser";
    return "Unknown Device";
  }

  // Check if device is trusted and approved for this user
  static async isDeviceTrusted(userId: string, deviceFingerprint: string): Promise<boolean> {
    const [device] = await db
      .select()
      .from(trustedDevices)
      .where(
        and(
          eq(trustedDevices.userId, userId),
          eq(trustedDevices.deviceFingerprint, deviceFingerprint),
          eq(trustedDevices.status, "approved")
        )
      )
      .limit(1);

    if (!device) return false;

    // Check if device has expired
    if (device.expiresAt && device.expiresAt < new Date()) {
      // Mark device as expired
      await db
        .update(trustedDevices)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(trustedDevices.id, device.id));
      return false;
    }

    // Update last used timestamp
    await db
      .update(trustedDevices)
      .set({ lastUsedAt: new Date(), updatedAt: new Date() })
      .where(eq(trustedDevices.id, device.id));

    return true;
  }

  // Register a new device for approval (requires admin approval for super_admin users)
  static async registerDevice(
    userId: string,
    req: Request,
    clientData?: Partial<DeviceFingerprint>,
    autoApprove: boolean = false
  ): Promise<{ deviceId: string; needsApproval: boolean }> {
    const deviceFingerprint = this.generateFingerprint(req, clientData);
    const deviceName = this.getDeviceName(req.headers["user-agent"] || "");

    // Check if device already exists
    const [existingDevice] = await db
      .select()
      .from(trustedDevices)
      .where(
        and(
          eq(trustedDevices.userId, userId),
          eq(trustedDevices.deviceFingerprint, deviceFingerprint)
        )
      )
      .limit(1);

    if (existingDevice) {
      if (existingDevice.status === "approved") {
        return { deviceId: existingDevice.id, needsApproval: false };
      }
      return { deviceId: existingDevice.id, needsApproval: true };
    }

    // Create new device registration
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const [newDevice] = await db
      .insert(trustedDevices)
      .values({
        userId,
        deviceFingerprint,
        deviceName,
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip || req.connection.remoteAddress,
        sessionToken,
        status: autoApprove ? "approved" : "pending",
        approvedAt: autoApprove ? new Date() : null,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      })
      .returning();

    return {
      deviceId: newDevice.id,
      needsApproval: !autoApprove,
    };
  }

  // Approve a pending device (admin only)
  static async approveDevice(deviceId: string, adminUserId: string): Promise<boolean> {
    const [updated] = await db
      .update(trustedDevices)
      .set({
        status: "approved",
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(trustedDevices.id, deviceId), eq(trustedDevices.status, "pending")))
      .returning();

    return !!updated;
  }

  // Revoke device access
  static async revokeDevice(deviceId: string, adminUserId: string): Promise<boolean> {
    const [updated] = await db
      .update(trustedDevices)
      .set({
        status: "revoked",
        updatedAt: new Date(),
      })
      .where(eq(trustedDevices.id, deviceId))
      .returning();

    return !!updated;
  }

  // Get all devices for a user
  static async getUserDevices(userId: string) {
    return await db
      .select({
        id: trustedDevices.id,
        deviceName: trustedDevices.deviceName,
        userAgent: trustedDevices.userAgent,
        ipAddress: trustedDevices.ipAddress,
        status: trustedDevices.status,
        lastUsedAt: trustedDevices.lastUsedAt,
        createdAt: trustedDevices.createdAt,
        expiresAt: trustedDevices.expiresAt,
      })
      .from(trustedDevices)
      .where(eq(trustedDevices.userId, userId))
      .orderBy(trustedDevices.lastUsedAt);
  }

  // Get pending devices for admin approval
  static async getPendingDevices() {
    return await db
      .select({
        id: trustedDevices.id,
        userId: trustedDevices.userId,
        deviceName: trustedDevices.deviceName,
        userAgent: trustedDevices.userAgent,
        ipAddress: trustedDevices.ipAddress,
        createdAt: trustedDevices.createdAt,
      })
      .from(trustedDevices)
      .where(eq(trustedDevices.status, "pending"))
      .orderBy(trustedDevices.createdAt);
  }
}
