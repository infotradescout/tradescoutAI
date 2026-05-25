import { Router } from "express";
import { z } from "zod";
import {
  completeUnifiedOnboardingStep,
  getUnifiedOnboardingStatus,
  startUnifiedOnboarding,
  submitUnifiedOnboardingClaim,
  type OnboardingClaimType,
  type OnboardingLane,
} from "../services/onboardingService";

const router = Router();

const onboardingLaneSchema = z.enum([
  "homeowner",
  "vehicle_owner",
  "service_provider",
  "seller",
  "realtor",
  "business_owner",
  "community_member",
  "browse_only",
]);

const onboardingClaimSchema = z.enum([
  "owns_or_manages_home",
  "owns_or_manages_vehicle",
  "provides_services",
  "sells_or_lists_items",
  "works_in_real_estate",
  "handles_local_requests_jobs",
  "browse_search_only",
  "represents_business",
]);

const startSchema = z.object({
  lane: onboardingLaneSchema,
  claimType: onboardingClaimSchema.optional(),
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
  lane: onboardingLaneSchema,
  claimType: onboardingClaimSchema,
  countyFips: z.string().optional(),
  countyName: z.string().optional(),
  legacySource: z.string().optional(),
});

const completeStepSchema = z.object({
  stepKey: z.string().min(1),
  completeOnboarding: z.boolean().optional(),
});

function getUserId(req: any): string | null {
  const id = req?.user?.id || req?.user?.claims?.sub;
  const clean = String(id || "").trim();
  return clean || null;
}

// POST /api/onboarding/start
router.post("/api/onboarding/start", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const parsed = startSchema.parse(req.body ?? {});
    const { storage } = await import("../storage");
    const state = await startUnifiedOnboarding(storage as any, {
      userId,
      lane: parsed.lane as OnboardingLane,
      claimType: parsed.claimType as OnboardingClaimType | undefined,
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
    const { storage } = await import("../storage");
    const state = await submitUnifiedOnboardingClaim(storage as any, {
      userId,
      lane: parsed.lane as OnboardingLane,
      claimType: parsed.claimType as OnboardingClaimType,
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
