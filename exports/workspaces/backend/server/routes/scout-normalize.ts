import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { normalizeScoutInteraction } from "../services/scoutNormalization";

const router = Router();

const normalizeScoutSchema = z
  .object({
    raw_text: z.string().trim().min(1, "raw_text is required").optional(),
    text: z.string().trim().min(1, "text is required").optional(),
  })
  .refine((value) => Boolean(value.raw_text || value.text), {
    message: "raw_text is required",
    path: ["raw_text"],
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
    const rawText = parsed.data.raw_text ?? parsed.data.text ?? "";
    return res.json(normalizeScoutInteraction(rawText));
  } catch (error) {
    console.error("[scout.normalize] error", error);
    return res.status(500).json({
      error: "Failed to normalize scout intake",
      requestId: (req as any).requestId || null,
    });
  }
});

export default router;
