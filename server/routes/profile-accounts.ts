import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import {
  ensureProfileAccount,
  getProfileAccountState,
} from "../services/profileAccountService";
import {
  ensureProfileAccountEntitlement,
  listProfileAccountEntitlements,
  type ProfileAccountEntitlement,
} from "../services/profileAccountEntitlementService";

function isSafeSourcePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return false;
  try {
    const parsed = new URL(value, "https://profile-account.local");
    if (parsed.origin !== "https://profile-account.local") return false;
    const decodedPath = decodeURIComponent(parsed.pathname);
    return !decodedPath.split("/").includes("..");
  } catch {
    return false;
  }
}

const createProfileAccountSchema = z
  .object({
    businessName: z.string().trim().min(2).max(160).optional(),
    sourcePath: z.string().trim().max(500).refine(isSafeSourcePath).optional(),
  })
  .strict();

function getUserId(req: Request): string | null {
  const user = req.user as any;
  const userId = user?.id || user?.claims?.sub;
  const normalized = String(userId || "").trim();
  return normalized || null;
}

export function registerProfileAccountRoutes(app: Express) {
  app.get("/api/u/:slug/account", async (req: Request, res: Response): Promise<void> => {
    try {
      const state = await getProfileAccountState({
        profileSlug: String(req.params.slug || ""),
        userId: getUserId(req),
      });
      if (!state) {
        res.status(404).json({ message: "Profile not found" });
        return;
      }
      const entitlements = state.account
        ? await listProfileAccountEntitlements(state.account.id)
        : [];
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ ...state, entitlements });
    } catch (error) {
      console.error("[profile-accounts] state failed", error);
      res.status(500).json({ message: "Profile account is temporarily unavailable." });
    }
  });

  app.post(
    "/api/u/:slug/account",
    isAuthenticated,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const userId = getUserId(req);
        if (!userId) {
          res.status(401).json({ message: "Authentication required" });
          return;
        }
        const parsed = createProfileAccountSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ message: "Profile account request is invalid." });
          return;
        }

        const created = await ensureProfileAccount({
          userId,
          profileSlug: String(req.params.slug || ""),
          businessName: parsed.data.businessName,
          sourcePath: parsed.data.sourcePath,
        });
        let entitlements: readonly ProfileAccountEntitlement[];
        if (created.policy.includesBidRock) {
          entitlements = [
            await ensureProfileAccountEntitlement({
              profileAccountId: created.account.id,
              productKey: "bidrock",
              verificationStatus: created.account.verificationStatus,
            }),
          ];
        } else {
          entitlements = await listProfileAccountEntitlements(created.account.id);
        }

        res.setHeader("Cache-Control", "private, no-store");
        res.status(201).json({ ...created, entitlements });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Profile account could not be created.";
        if (/business name is required/i.test(message)) {
          res.status(409).json({ message, requiresBusinessSetup: true });
          return;
        }
        const status = /not found/i.test(message)
          ? 404
          : /not available|invalid/i.test(message)
            ? 400
            : /authentication|required|identity/i.test(message)
              ? 401
              : 500;
        if (status === 500) console.error("[profile-accounts] create failed", error);
        res.status(status).json({ message });
      }
    }
  );
}
