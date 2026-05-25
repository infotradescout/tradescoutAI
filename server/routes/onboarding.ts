import { Router } from "express";
import { z } from "zod";
import {
  completeUnifiedOnboardingStep,
  getUnifiedOnboardingStatus,
  mapLegacyLaneToUnified,
  startUnifiedOnboarding,
  submitUnifiedOnboardingClaim,
  type OnboardingAsset,
  type OnboardingClaimType,
  type OnboardingLane,
} from "../services/onboardingService";

const router = Router();

const onboardingLaneSchema = z.enum([
  "find_help",
  "manage_projects",
  "offer_services",
  "sell_items",
  "real_estate",
  "business",
  "community",
  "browse_only",
]);

const onboardingLegacyLaneSchema = z.enum([
  "homeowner",
  "vehicle_owner",
  "service_provider",
  "seller",
  "realtor",
  "business_owner",
  "community_member",
]);

const onboardingClaimSchema = z.enum([
  "find_local_help",
  "manage_local_projects",
  "offer_local_services",
  "sell_or_list_items",
  "real_estate_property_work",
  "run_local_business",
  "see_local_activity",
  "browse_search_only",
]);

const onboardingAssetSchema = z.enum(["home", "vehicle", "project", "business", "saved_search"]);

const startSchema = z.object({
  lane: z.union([onboardingLaneSchema, onboardingLegacyLaneSchema]),
  claimType: onboardingClaimSchema.optional(),
  assets: z.array(onboardingAssetSchema).optional(),
  legacySource: z.string().optional(),
  profile: z
    .object({
      fullName: z.string().optional(),
      phone: z.string().optional(),
      location: z
        .object({
          state: z.string().optional(),
          county: z.string().optional(),
          city: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

const claimSchema = z.object({
  lane: z.union([onboardingLaneSchema, onboardingLegacyLaneSchema]),
  claimType: onboardingClaimSchema,
  assets: z.array(onboardingAssetSchema).optional(),
  countyFips: z.string().optional(),
  countyName: z.string().optional(),
  legacySource: z.string().optional(),
});

const completeStepSchema = z.object({
  stepKey: z.string().min(1),
  assets: z.array(onboardingAssetSchema).optional(),
  completeOnboarding: z.boolean().optional(),
});

function getUserId(req: any): string | null {
  const id = req?.user?.id || req?.user?.claims?.sub;
  const clean = String(id || "").trim();
  return clean || null;
}

function resolveLaneAndAssets(parsedLane: string, parsedAssets?: OnboardingAsset[]) {
  if (onboardingLaneSchema.safeParse(parsedLane).success) {
    return { lane: parsedLane as OnboardingLane, assets: parsedAssets || [], claimType: undefined };
  }
  const mapped = mapLegacyLaneToUnified(parsedLane);
  return {
    lane: mapped.lane || "find_help",
    assets: Array.from(new Set([...(parsedAssets || []), ...(mapped.asset ? [mapped.asset] : [])])),
    claimType: mapped.claimType,
  };
}

// POST /api/onboarding/start
router.post("/api/onboarding/start", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const parsed = startSchema.parse(req.body ?? {});
    const mapped = resolveLaneAndAssets(
      parsed.lane,
      parsed.assets as OnboardingAsset[] | undefined
    );
    const { storage } = await import("../storage");
    const state = await startUnifiedOnboarding(storage as any, {
      userId,
      lane: mapped.lane,
      claimType:
        (parsed.claimType as OnboardingClaimType | undefined) ||
        (mapped.claimType as OnboardingClaimType | undefined),
      assets: mapped.assets,
      legacySource: parsed.legacySource,
      profile: parsed.profile,
    });
    return res.json({ success: true, state });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Invalid onboarding start payload", errors: error.errors });
    }
    console.error("[onboarding.start] error", error);
    return res.status(500).json({ message: "Failed to start onboarding" });
  }
});

// POST /api/onboarding/claim
router.post("/api/onboarding/claim", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const parsed = claimSchema.parse(req.body ?? {});
    const mapped = resolveLaneAndAssets(
      parsed.lane,
      parsed.assets as OnboardingAsset[] | undefined
    );
    const { storage } = await import("../storage");
    const state = await submitUnifiedOnboardingClaim(storage as any, {
      userId,
      lane: mapped.lane,
      claimType: parsed.claimType as OnboardingClaimType,
      assets: mapped.assets,
      countyFips: parsed.countyFips,
      countyName: parsed.countyName,
      legacySource: parsed.legacySource,
    });
    return res.json({ success: true, state });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Invalid onboarding claim payload", errors: error.errors });
    }
    console.error("[onboarding.claim] error", error);
    return res.status(500).json({ message: "Failed to submit onboarding claim" });
  }
});

// POST /api/onboarding/complete-step
router.post("/api/onboarding/complete-step", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const parsed = completeStepSchema.parse(req.body ?? {});
    const { storage } = await import("../storage");
    const state = await completeUnifiedOnboardingStep(storage as any, {
      userId,
      stepKey: parsed.stepKey,
      assets: parsed.assets as OnboardingAsset[] | undefined,
      completeOnboarding: parsed.completeOnboarding,
    });
    if (!state) {
      return res.status(404).json({ message: "No onboarding session found" });
    }
    return res.json({ success: true, state });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Invalid onboarding step payload", errors: error.errors });
    }
    console.error("[onboarding.complete-step] error", error);
    return res.status(500).json({ message: "Failed to complete onboarding step" });
  }
});

// GET /api/onboarding/status
router.get("/api/onboarding/status", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const { storage } = await import("../storage");
    const state = await getUnifiedOnboardingStatus(storage as any, userId);
    return res.json({ success: true, state });
  } catch (error) {
    console.error("[onboarding.status] error", error);
    return res.status(500).json({ message: "Failed to fetch onboarding status" });
  }
});

export { router as onboardingRouter };
