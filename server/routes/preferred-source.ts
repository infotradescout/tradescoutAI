import { Router, type Request, type Response } from "express";
import { isAuthenticated } from "../auth";
import {
  checkPreferredSourceEligibility,
  logCompletedAction,
  markPreferredSourcePromptAccepted,
  markPreferredSourcePromptShown,
} from "../services/preferredSource";

const router = Router();

// Check if user is eligible for the preferred source prompt (5 actions, never shown)
router.get("/eligibility", isAuthenticated, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const result = await checkPreferredSourceEligibility(userId);
  res.json(result);
});

// Mark the prompt as shown (user dismissed with "Not now")
router.post("/shown", isAuthenticated, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  await markPreferredSourcePromptShown(userId);
  res.json({ success: true });
});

// Mark the prompt as accepted (user clicked "Set as preferred source")
router.post("/accepted", isAuthenticated, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  await markPreferredSourcePromptAccepted(userId);
  res.json({ success: true });
});

export default router;
