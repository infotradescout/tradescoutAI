import type { Express, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "../db";
import { emailService } from "../services/emailService";
import {
  JW_STONE_SAVED_STONES_EMAIL_PURPOSE,
  buildJwStoneSavedStonesEmail,
  sanitizeJwStoneSavedStoneEmailItems,
} from "../services/jwStoneSavedStonesEmail";
import { registerBidRockStoneBoundary } from "../services/bidrockStoneBoundary";
import { createPostgresRateLimitStore } from "../utils/postgresRateLimitStore";
import { JW_STONE_DIRECT_CONNECT_SELECTION_LIMIT } from "@shared/jwStoneDirectConnect";
import { registerBidRockRoutes } from "./bidrock";
import { registerProfileAccountRoutes } from "./profile-accounts";

type OptionalAuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string }; [key: string]: any };
};

const savedStonesEmailSchema = z
  .object({
    email: z.string().trim().email().max(320),
    stones: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(180),
            shareSlug: z
              .string()
              .trim()
              .max(120)
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
              .nullable()
              .optional(),
          })
          .strict()
      )
      .min(1)
      .max(JW_STONE_DIRECT_CONNECT_SELECTION_LIMIT),
    // Quiet bot trap. Real browsers never populate this hidden field.
    website: z.string().max(0).optional(),
  })
  .strict();

function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function registerJwStoneSavedStonesEmailRoutes(app: Express) {
  // Profile accounts are a platform capability. BidRock consumes the resulting
  // stone-profile entitlement and never creates a second account system.
  registerProfileAccountRoutes(app);
  registerBidRockStoneBoundary(app);
  registerBidRockRoutes(app);

  const isProduction = process.env.NODE_ENV === "production";
  const noopLimiter: any = (_req: Request, _res: Response, next: () => void) => next();
  const keyGenerator = (req: OptionalAuthedRequest) => {
    const userId = req.user?.id || req.user?.claims?.sub;
    return userId ? `u:${userId}` : String(req.ip || "unknown");
  };
  const emailLimiter = isProduction
    ? rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        store: createPostgresRateLimitStore({
          pool,
          prefix: "jw_stone_saved_stones_email",
          cleanupIntervalMs: Number(process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || 600_000),
        }),
      })
    : noopLimiter;

  app.post(
    "/api/jw-stone/saved-stones/email",
    emailLimiter,
    async (req: OptionalAuthedRequest, res: Response) => {
      try {
        const parsed = savedStonesEmailSchema.safeParse(req.body);
        if (!parsed.success) {
          // Filled honeypot (`website`) also fails max(0) — reject quietly as invalid input.
          return res
            .status(400)
            .json({ message: "Enter a valid email and at least one saved stone." });
        }

        const stones = sanitizeJwStoneSavedStoneEmailItems(parsed.data.stones);
        if (!stones.length) {
          return res.status(400).json({ message: "No named stones were available to email." });
        }

        if (!emailService.isConfigured()) {
          return res
            .status(503)
            .json({ message: "Email is temporarily unavailable. Try again shortly." });
        }

        const publicBase = String(
          process.env.APP_BASE_URL || "https://www.thetradescout.com"
        ).replace(/\/$/, "");
        const content = buildJwStoneSavedStonesEmail({ publicBaseUrl: publicBase, stones });
        const result = await emailService.sendEmail({
          to: normalizeEmail(parsed.data.email),
          subject: content.subject,
          html: content.html,
          text: content.text,
          purpose: JW_STONE_SAVED_STONES_EMAIL_PURPOSE,
          // Customer copy only — do not BCC or notify JW business.
        });

        if (result.skipped) {
          console.warn("[jw-stone-saved-stones-email] send skipped", {
            purpose: JW_STONE_SAVED_STONES_EMAIL_PURPOSE,
            stoneCount: stones.length,
          });
          return res
            .status(503)
            .json({ message: "Email could not be sent right now. Try again shortly." });
        }

        console.info("[jw-stone-saved-stones-email] sent", {
          stoneCount: stones.length,
          messageId: result.messageId || null,
        });
        return res.status(200).json({ sent: true, stoneCount: stones.length });
      } catch (error) {
        console.error("[jw-stone-saved-stones-email] failed", error);
        return res.status(500).json({ message: "Email could not be sent." });
      }
    }
  );
}
