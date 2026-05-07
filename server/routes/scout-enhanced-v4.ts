import { Router, type Request, type Response } from "express";

const router = Router();

type EnhancedV4Body = {
  message?: string;
  prompt?: string;
};

router.post(
  "/message-v4",
  async (req: Request<unknown, unknown, EnhancedV4Body>, res: Response) => {
    const message = String(req.body?.message || req.body?.prompt || "").trim();

    if (!message) {
      return res.status(400).json({
        error: "message_required",
        message: "Scout enhanced v4 needs a message before it can run.",
      });
    }

    return res.status(503).json({
      error: "enhanced_v4_not_available",
      message:
        "Scout enhanced v4 is mounted as an opt-in route, but no enhanced engine is configured yet.",
      fallback: "classic",
    });
  }
);

export default router;
