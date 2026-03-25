import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { normalizeScoutInteraction } from "../services/scoutNormalization";

const router = Router();

const normalizeScoutSchema = z.object({
  text: z.string().min(1, "Text is required"),
});

router.post("/normalize", (req: Request, res: Response) => {
  const parsed = normalizeScoutSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parsed.error.issues,
    });
  }

  try {
    return res.json(normalizeScoutInteraction(parsed.data.text));
  } catch (error) {
    console.error("[scout.normalize] error", error);
    return res.status(500).json({
      error: "Failed to normalize scout intake",
      requestId: (req as any).requestId || null,
    });
  }
});

export default router;
