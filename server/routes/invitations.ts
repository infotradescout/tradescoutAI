import type { Express, Request } from "express";
import { isAdmin, isAuthenticated } from "../auth";
import { emailService } from "../services/emailService";
import { storage } from "../storage";

export type InvitationRouteDependencies = {
  getPublicBaseUrlFromRequest: (req: Request) => string;
};

export function registerInvitationRoutes(
  app: Express,
  dependencies: InvitationRouteDependencies
): void {
  const { getPublicBaseUrlFromRequest } = dependencies;
  // Invitation System API Routes

  // Send email invitation
  app.post("/api/invitations/send", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const { email, targetRole, personalMessage } = req.body;

      // Validate required fields
      if (!email || !targetRole) {
        return res.status(400).json({ message: "Email and target role are required" });
      }

      if (!userId) {
        return res.status(401).json({ message: "User authentication required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Generate invitation code
      const invitationCode = await storage.generateInvitationCode();

      // Create invitation
      const invitation = await storage.createInvitation({
        inviterId: userId,
        inviteeEmail: email,
        targetRole,
        personalMessage: personalMessage || null,
        invitationCode,
        type: "email",
        status: "pending",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      // Update user's referral stats
      await storage.incrementInvitationsSent(userId);

      try {
        const inviteBase =
          process.env.PUBLIC_WEB_URL || process.env.APP_URL || getPublicBaseUrlFromRequest(req);
        const inviteLink = `${inviteBase.replace(/\/$/, "")}/register?invite=${encodeURIComponent(invitationCode)}`;
        await emailService.sendEmail({
          to: email,
          subject: "You're invited to TradeScout",
          html: `<p>You were invited to TradeScout as <strong>${targetRole}</strong>.</p><p><a href="${inviteLink}">Accept invitation</a></p>${
            personalMessage ? `<p>Message: ${personalMessage}</p>` : ""
          }`,
          text: `You were invited to TradeScout as ${targetRole}. Accept invitation: ${inviteLink}${
            personalMessage ? `\nMessage: ${personalMessage}` : ""
          }`,
          purpose: "invitation",
        });
      } catch (emailError) {
        console.error("Invitation email send failed:", emailError);
      }

      res.status(201).json(invitation);
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  // Get user's invitations
  app.get("/api/invitations/my", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const invitations = await storage.getUserInvitations(userId);
      res.json(invitations);
    } catch (error: any) {
      console.error("Error fetching user invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Accept invitation (public endpoint)
  app.post("/api/invitations/accept/:code", async (req: any, res: any) => {
    try {
      const { code } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Get invitation
      const invitation = await storage.getInvitationByCode(code);
      if (!invitation) {
        return res.status(404).json({ message: "Invalid invitation code" });
      }

      if (invitation.status !== "pending") {
        return res.status(400).json({ message: "Invitation has already been used or expired" });
      }

      // Accept invitation
      const acceptedInvitation = await storage.acceptInvitation(code, userId);

      // Update inviter's stats
      if (invitation.inviterId) {
        await storage.incrementInvitationsAccepted(
          invitation.inviterId,
          invitation.targetRole as "homeowner" | "contractor"
        );
      }

      res.json(acceptedInvitation);
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Validate invitation code (public endpoint for signup page)
  app.get("/api/invitations/validate/:code", async (req: any, res: any) => {
    try {
      const { code } = req.params;

      const invitation = await storage.getInvitationByCode(code);
      if (!invitation) {
        return res.status(404).json({
          message: "Invalid invitation code",
          valid: false,
        });
      }

      if (invitation.status !== "pending") {
        return res.status(400).json({
          message: "Invitation has already been used or expired",
          valid: false,
        });
      }

      res.json({
        valid: true,
        email: invitation.inviteeEmail,
        targetRole: invitation.targetRole,
        personalMessage: invitation.personalMessage,
      });
    } catch (error: any) {
      console.error("Error validating invitation:", error);
      res.status(500).json({ message: "Failed to validate invitation" });
    }
  });

  // Generate or get user's referral code
  app.post("/api/referrals/generate-code", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let referralCode = user.referralCode;

      // Generate code if user doesn't have one
      if (!referralCode) {
        referralCode = await storage.generateUserReferralCode(userId);
      }

      res.json({ referralCode });
    } catch (error: any) {
      console.error("Error generating referral code:", error);
      res.status(500).json({ message: "Failed to generate referral code" });
    }
  });

  // Get user's referral stats
  app.get("/api/referrals/stats", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const stats = await storage.getReferralStats(userId);

      if (!stats) {
        // Return default stats if none exist
        return res.json({
          totalInvitationsSent: 0,
          totalInvitationsAccepted: 0,
          contractorReferrals: 0,
          homeownerReferrals: 0,
        });
      }

      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  // Get top referrers leaderboard
  app.get("/api/referrals/leaderboard", async (req: any, res: any) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topReferrers = await storage.getTopReferrers(limit);
      res.json(topReferrers);
    } catch (error: any) {
      console.error("Error fetching referral leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Cleanup expired invitations (internal endpoint)
  app.post("/api/invitations/cleanup", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      await storage.expireOldInvitations();
      res.json({ message: "Expired invitations cleaned up successfully" });
    } catch (error: any) {
      console.error("Error cleaning up invitations:", error);
      res.status(500).json({ message: "Failed to cleanup invitations" });
    }
  });
}
