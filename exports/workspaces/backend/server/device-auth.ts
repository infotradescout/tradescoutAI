import { randomBytes, createHash } from "crypto";
import { Request, Response } from "express";
import { db } from "./db";
import { trustedDevices, users } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

interface DeviceFingerprint {
  userAgent: string;
  ipAddress: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
}

export class DeviceAuthService {
  // Generate device fingerprint from request
  static generateDeviceFingerprint(req: Request): string {
    const components = [
      req.headers["user-agent"] || "",
      req.ip || req.connection.remoteAddress || "",
      req.headers["accept-language"] || "",
      req.headers["accept-encoding"] || "",
    ];

    return createHash("sha256").update(components.join("|")).digest("hex");
  }

  // Generate secure session token
  static generateSessionToken(): string {
    return randomBytes(32).toString("hex");
  }

  // Get device name from user agent
  static getDeviceName(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    let browser = "Unknown Browser";
    let os = "Unknown OS";

    // Detect browser
    if (ua.includes("chrome")) browser = "Chrome";
    else if (ua.includes("firefox")) browser = "Firefox";
    else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
    else if (ua.includes("edge")) browser = "Edge";

    // Detect OS
    if (ua.includes("windows")) os = "Windows";
    else if (ua.includes("mac")) os = "macOS";
    else if (ua.includes("linux")) os = "Linux";
    else if (ua.includes("android")) os = "Android";
    else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

    return `${browser} on ${os}`;
  }

  // Check if device is trusted for user
  static async checkTrustedDevice(
    userId: string,
    deviceFingerprint: string
  ): Promise<string | null> {
    const [device] = await db
      .select()
      .from(trustedDevices)
      .where(
        and(
          eq(trustedDevices.userId, userId),
          eq(trustedDevices.deviceFingerprint, deviceFingerprint),
          eq(trustedDevices.isActive, true)
        )
      )
      .limit(1);

    if (!device) return null;

    // Check if session token has expired
    if (new Date() > device.expiresAt) {
      await this.deactivateDevice(device.sessionToken);
      return null;
    }

    // Update last used timestamp
    await db
      .update(trustedDevices)
      .set({ lastUsed: new Date() })
      .where(eq(trustedDevices.id, device.id));

    return device.sessionToken;
  }

  // Register new trusted device
  static async registerTrustedDevice(
    userId: string,
    req: Request,
    expiryDays: number = 30
  ): Promise<string> {
    const deviceFingerprint = this.generateDeviceFingerprint(req);
    const sessionToken = this.generateSessionToken();
    const deviceName = this.getDeviceName(req.headers["user-agent"] || "");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Check if device already exists and deactivate it
    await db
      .update(trustedDevices)
      .set({ isActive: false })
      .where(
        and(
          eq(trustedDevices.userId, userId),
          eq(trustedDevices.deviceFingerprint, deviceFingerprint)
        )
      );

    // Create new trusted device record
    await db.insert(trustedDevices).values({
      userId,
      deviceFingerprint,
      deviceName,
      userAgent: req.headers["user-agent"] || "",
      ipAddress: req.ip || req.connection.remoteAddress || "",
      sessionToken,
      expiresAt,
      isActive: true,
    });

    return sessionToken;
  }

  // Validate session token
  static async validateSessionToken(sessionToken: string): Promise<any | null> {
    const [device] = await db
      .select({
        device: trustedDevices,
        user: users,
      })
      .from(trustedDevices)
      .innerJoin(users, eq(trustedDevices.userId, users.id))
      .where(and(eq(trustedDevices.sessionToken, sessionToken), eq(trustedDevices.isActive, true)))
      .limit(1);

    if (!device) return null;

    // Check if expired
    if (new Date() > device.device.expiresAt) {
      await this.deactivateDevice(sessionToken);
      return null;
    }

    return device.user;
  }

  // Get user's trusted devices
  static async getUserTrustedDevices(userId: string) {
    return await db
      .select({
        id: trustedDevices.id,
        deviceName: trustedDevices.deviceName,
        userAgent: trustedDevices.userAgent,
        ipAddress: trustedDevices.ipAddress,
        lastUsed: trustedDevices.lastUsed,
        createdAt: trustedDevices.createdAt,
        expiresAt: trustedDevices.expiresAt,
      })
      .from(trustedDevices)
      .where(and(eq(trustedDevices.userId, userId), eq(trustedDevices.isActive, true)))
      .orderBy(desc(trustedDevices.lastUsed));
  }

  // Deactivate device
  static async deactivateDevice(sessionToken: string): Promise<void> {
    await db
      .update(trustedDevices)
      .set({ isActive: false })
      .where(eq(trustedDevices.sessionToken, sessionToken));
  }

  // Deactivate all devices for user except current
  static async deactivateOtherDevices(userId: string, currentSessionToken: string): Promise<void> {
    await db
      .update(trustedDevices)
      .set({ isActive: false })
      .where(and(eq(trustedDevices.userId, userId), eq(trustedDevices.isActive, true)));

    // Reactivate current device
    await db
      .update(trustedDevices)
      .set({ isActive: true })
      .where(eq(trustedDevices.sessionToken, currentSessionToken));
  }

  // Clean up expired devices
  static async cleanupExpiredDevices(): Promise<void> {
    await db
      .update(trustedDevices)
      .set({ isActive: false })
      .where(eq(trustedDevices.isActive, true));
  }
}

// Express middleware to check trusted device
export const checkTrustedDevice = async (req: any, res: Response, next: any) => {
  const sessionToken = req.cookies?.trusted_session || req.headers["x-trusted-session"];

  if (!sessionToken) {
    return next();
  }

  try {
    const user = await DeviceAuthService.validateSessionToken(sessionToken);
    const rawRole = typeof user?.role === "string" ? user.role.trim().toLowerCase() : "";
    const normalizedRole =
      rawRole === "owner" || rawRole === "head_admin" ? "super_admin" : rawRole;
    if (user && normalizedRole === "super_admin") {
      req.user = user;
      req.trustedSession = true;
    }
  } catch (error) {
    console.error("Trusted device validation error:", error);
  }

  next();
};
