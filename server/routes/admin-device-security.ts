import type { Express, Request, RequestHandler, Response } from "express";
import type { UserRole } from "../../shared/roles";

export type AdminDeviceSecurityDeps = {
  isAuthenticated: RequestHandler;
  requireRole: (roles: UserRole[]) => RequestHandler;
};

export function registerAdminDeviceSecurityRoutes(app: Express, deps: AdminDeviceSecurityDeps) {
  const { isAuthenticated, requireRole } = deps;

  app.get(
    "/api/admin/devices",
    isAuthenticated,
    requireRole(["super_admin"]),
    async (req: Request, res: Response) => {
      try {
        const user = req.user as any;
        const userId: string = user.id || user.claims?.sub || "";
        const { DeviceAuthService } = await import("../deviceAuth");
        if (!userId) return res.status(400).json({ message: "User ID missing" });
        const devices = await DeviceAuthService.getUserDevices(userId);
        res.json({ devices });
      } catch (error: any) {
        console.error("Get devices error:", error);
        res.status(500).json({ message: "Failed to fetch devices" });
      }
    }
  );

  app.get(
    "/api/admin/pending-devices",
    isAuthenticated,
    requireRole(["super_admin"]),
    async (_req: Request, res: Response) => {
      try {
        const { DeviceAuthService } = await import("../deviceAuth");
        const pendingDevices = await DeviceAuthService.getPendingDevices();
        res.json({ pendingDevices });
      } catch (error: any) {
        console.error("Get pending devices error:", error);
        res.status(500).json({ message: "Failed to fetch pending devices" });
      }
    }
  );

  app.post(
    "/api/admin/approve-device",
    isAuthenticated,
    requireRole(["super_admin"]),
    async (req: Request, res: Response) => {
      try {
        const user = req.user as any;
        const userId: string = user.id || user.claims?.sub || "";
        const { deviceId } = (req.body ?? {}) as any;
        const { DeviceAuthService } = await import("../deviceAuth");
        if (!userId) return res.status(400).json({ message: "User ID missing" });
        if (!deviceId) return res.status(400).json({ message: "Device ID missing" });
        const success = await DeviceAuthService.approveDevice(deviceId, userId);

        if (success) {
          res.json({ message: "Device approved successfully" });
        } else {
          res.status(400).json({ message: "Failed to approve device" });
        }
      } catch (error: any) {
        console.error("Approve device error:", error);
        res.status(500).json({ message: "Failed to approve device" });
      }
    }
  );

  app.post(
    "/api/admin/revoke-device",
    isAuthenticated,
    requireRole(["super_admin"]),
    async (req: Request, res: Response) => {
      try {
        const user = req.user as any;
        const userId: string = user.id || user.claims?.sub || "";
        const { deviceId } = (req.body ?? {}) as any;
        const { DeviceAuthService } = await import("../deviceAuth");
        if (!userId) return res.status(400).json({ message: "User ID missing" });
        if (!deviceId) return res.status(400).json({ message: "Device ID missing" });
        const success = await DeviceAuthService.revokeDevice(deviceId, userId);

        if (success) {
          res.json({ message: "Device revoked successfully" });
        } else {
          res.status(400).json({ message: "Failed to revoke device" });
        }
      } catch (error: any) {
        console.error("Revoke device error:", error);
        res.status(500).json({ message: "Failed to revoke device" });
      }
    }
  );
}
