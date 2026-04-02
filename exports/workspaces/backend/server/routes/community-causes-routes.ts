import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";

const router = Router();

router.get("/profile/:profileId", async (req: Request, res: Response) => {
  try {
    const profileId = String(req.params.profileId);
    const causes = await storage.listCommunityCausesByProfile(profileId);
    res.json(causes);
  } catch (error) {
    console.error("Error listing community causes:", error);
    res.status(500).json({ error: "Failed to list causes" });
  }
});

const createCauseSchema = z.object({
  profileId: z.string().min(1),
  title: z.string().min(2).max(140),
  description: z.string().max(5000).optional(),
});

const PLATFORM_CAUSE_CURATOR_ROLES = new Set(["super_admin", "ops_admin"]);

router.post("/", isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const user = await storage.getUser(userId);
    const roles = Array.isArray(user?.roles) ? (user!.roles as string[]) : [];
    if (!roles.some((role) => PLATFORM_CAUSE_CURATOR_ROLES.has(role))) {
      return res.status(403).json({ error: "Platform curator access required to create causes" });
    }

    const parsed = createCauseSchema.parse(req.body);

    const created = await storage.createCommunityCauseForOwner(userId, {
      profileId: parsed.profileId,
      title: parsed.title,
      description: parsed.description ?? null,
    });

    res.status(201).json(created);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Error creating community cause:", error);
    res.status(500).json({
      error: "Failed to create cause",
      requestId: (req as any).requestId || null,
    });
  }
});

router.post("/:causeId/vote", isAuthenticated, async (req: any, res: Response) => {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const user = await storage.getUser(userId);
    const roles = Array.isArray(user?.roles) ? (user!.roles as string[]) : [];
    if (!roles.includes("community_builder")) {
      return res.status(403).json({ error: "Community Builder badge required to vote on causes" });
    }

    const causeId = String(req.params.causeId);
    const result = await storage.voteForCommunityCause(userId, causeId);

    res.json({
      success: true,
      vote: result.vote,
      voteCount: result.voteCount,
      weightedVoteTotal: result.weightedVoteTotal,
      allocationShare: result.allocationShare,
      voteWeight: result.voteWeight,
    });
  } catch (error: any) {
    console.error("Error voting for community cause:", error);
    res.status(500).json({ error: "Failed to vote", requestId: (req as any).requestId || null });
  }
});

export default router;
