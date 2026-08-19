import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import {
  PROFILE_ACCOUNT_ROLES,
  profileAccountRoleIncludesBidRock,
} from "@shared/profileAccount";
import {
  ensureProfileAccount,
  getProfileAccountState,
} from "../services/profileAccountService";
import {
  ensureProfileAccountEntitlement,
  listProfileAccountEntitlements,
} from "../services/profileAccountEntitlementService";

type OptionalAuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string }; [key: string]: unknown };
};

const createProfileAccountSchema = z
  .object({
    role: z.enum(PROFILE_ACCOUNT_ROLES),
    sourcePath: z
      .string()
      .trim()
      .max(500)
      .regex(/^\/u\/[a-z0-9-]+(?:[/?#].*)?$/)
      .optional(),
  })
  .strict();

function getUserId(req: OptionalAuthedRequest): string | null {
  const userId = req.user?.id || req.user?.claims?.sub;
  const normalized = String(userId || "").trim();
  return normalized || null;
}

export function registerProfileAccountRoutes(app: Express) {
  app.get("/api/u/:slug/account", async (req: OptionalAuthedRequest, res: Response) => {
    try {
      const state = await getProfileAccountState({
        profileSlug: String(req.params.slug || ""),
        userId: getUserId(req),
      });
      if (!state) return res.status(404).json({ message: "Profile not found" });
      const entitlements = state.account
        ? await listProfileAccountEntitlements(state.account.id)
        : [];
      res.setHeader("Cache-Control", "private, no-store");
      return res.json({ ...state, entitlements });
    } catch (error) {
      console.error("[profile-accounts] state failed", error);
      return res.status(500).json({ message: "Profile account is temporarily unavailable." });
    }
  });

  app.post(
    "/api/u/:slug/account",
    isAuthenticated,
    async (req: OptionalAuthedRequest, res: Response) => {
      try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ message: "Authentication required" });
        const parsed = createProfileAccountSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "Choose a valid account type." });
        }

        const created = await ensureProfileAccount({
          userId,
          profileSlug: String(req.params.slug || ""),
          role: parsed.data.role,
          sourcePath: parsed.data.sourcePath,
        });
        const entitlements = [];
        if (
          created.policy.kind === "stone_business" &&
          profileAccountRoleIncludesBidRock(parsed.data.role)
        ) {
          entitlements.push(
            await ensureProfileAccountEntitlement({
              profileAccountId: created.account.id,
              productKey: "bidrock",
              verificationStatus: created.account.verificationStatus,
            })
          );
        } else {
          entitlements.push(...(await listProfileAccountEntitlements(created.account.id)));
        }

        res.setHeader("Cache-Control", "private, no-store");
        return res.status(201).json({ ...created, entitlements });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Profile account could not be created.";
        const status = /not found/i.test(message)
          ? 404
          : /not available|valid account type|choose/i.test(message)
            ? 400
            : /authentication|required|identity/i.test(message)
              ? 401
              : 500;
        if (status === 500) console.error("[profile-accounts] create failed", error);
        return res.status(status).json({ message });
      }
    }
  );
}
