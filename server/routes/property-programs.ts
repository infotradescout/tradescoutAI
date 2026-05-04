import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import {
  propertyLifecycleEvents,
  propertyParticipants,
  propertyPrograms,
  userHomes,
} from "@shared/schema";
import {
  addPropertyLifecycleEvent,
  createPropertyProgram,
  getLatestPropertyHomefaxSnapshot,
  getLatestPropertyReadinessSnapshot,
  recomputePropertyHomefaxSnapshot,
  recomputePropertyReadinessSnapshot,
  requirePropertyProgramAccess,
} from "../services/propertyLifecycleService";

const router = Router();

function getUserId(req: any): string {
  return String((req.user as any)?.claims?.sub || (req.user as any)?.id || "").trim();
}

const createPropertyProgramSchema = z.object({
  mode: z.enum(["build", "existing"]).default("existing"),
  countyFips: z
    .string()
    .trim()
    .regex(/^[0-9]{5}$/)
    .optional(),
  stateCode: z.string().trim().length(2).optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  addressJson: z.record(z.any()).optional(),
  parcelId: z.string().trim().max(240).optional(),
  propertyType: z.string().trim().min(1).max(64).optional(),
  yearBuilt: z.number().int().min(1600).max(2100).optional(),
  metadata: z.record(z.any()).optional(),
  homeId: z.string().trim().optional(), // link to private Home Vault home
});

const createEventSchema = z.object({
  actionType: z.string().trim().min(2).max(80),
  phase: z.string().trim().max(80).optional(),
  title: z.string().trim().min(2).max(220),
  description: z.string().trim().max(20_000).optional(),
  occurredAt: z.string().trim().optional(), // ISO string
  source: z.enum(["user", "scout", "integration", "system"]).optional(),
  status: z.enum(["planned", "in_progress", "done", "blocked"]).optional(),
  costAmount: z.union([z.number(), z.string()]).optional(),
  metadata: z.record(z.any()).optional(),
  sourceSurface: z.string().trim().max(80).optional(),
  idempotencyKey: z.string().trim().max(180).optional(),
});

router.get("/api/property-programs", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const participantRows = await db
      .select({ propertyProgramId: propertyParticipants.propertyProgramId })
      .from(propertyParticipants)
      .where(
        and(eq(propertyParticipants.userId, userId), eq(propertyParticipants.status, "active"))
      )
      .limit(500);

    const ids: string[] = Array.from(
      new Set(participantRows.map((r) => String(r.propertyProgramId)).filter(Boolean))
    );

    const programs = ids.length
      ? await db
          .select()
          .from(propertyPrograms)
          .where(inArray(propertyPrograms.id, ids))
          .orderBy(desc(propertyPrograms.updatedAt))
          .limit(100)
      : [];

    return res.json({ programs });
  } catch (err) {
    console.error("[property-programs] list failed:", err);
    return res.status(500).json({ message: "Failed to load property programs" });
  }
});

router.post("/api/property-programs", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const body = createPropertyProgramSchema.parse(req.body ?? {});

    let countyFips = body.countyFips || "";
    let stateCode = body.stateCode || "";
    let addressJson = body.addressJson || {};
    let propertyType = body.propertyType || null;
    let yearBuilt = body.yearBuilt ?? null;
    let userHomeId: string | null = null;

    if (body.homeId) {
      const homeId = String(body.homeId || "").trim();
      const [home] = await db
        .select()
        .from(userHomes)
        .where(and(eq(userHomes.id, homeId), eq(userHomes.ownerUserId, userId)))
        .limit(1);
      if (!home) return res.status(404).json({ message: "Home not found" });

      userHomeId = homeId;
      countyFips = countyFips || String((home as any).countyFips || "");
      stateCode = stateCode || String((home as any).stateCode || "");
      propertyType = propertyType || ((home as any).propertyType ?? null);
      yearBuilt = yearBuilt ?? (home as any).yearBuilt ?? null;
      addressJson = {
        ...(addressJson || {}),
        address1: (home as any).address1 ?? null,
        address2: (home as any).address2 ?? null,
        city: (home as any).city ?? null,
        stateCode: (home as any).stateCode ?? null,
        countyFips: (home as any).countyFips ?? null,
        zipCode: (home as any).zipCode ?? null,
        nickname: (home as any).nickname ?? null,
      };
    }

    if (!countyFips || !/^[0-9]{5}$/.test(countyFips)) {
      return res.status(400).json({ message: "countyFips (5 digits) required" });
    }
    if (!stateCode || String(stateCode).length !== 2) {
      return res.status(400).json({ message: "stateCode (2 letters) required" });
    }

    const program = await createPropertyProgram({
      ownerUserId: userId,
      primaryUserId: userId, // safe default; transfer is a separate audited action
      countyFips,
      stateCode,
      mode: body.mode,
      status: body.status,
      addressJson,
      userHomeId,
      parcelId: body.parcelId ?? null,
      propertyType,
      yearBuilt,
      metadata: body.metadata || {},
    });

    return res.status(201).json({ program });
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid payload" });
    console.error("[property-programs] create failed:", err);
    return res.status(500).json({ message: "Failed to create property program" });
  }
});

router.get("/api/property-programs/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "id required" });

    const program = await requirePropertyProgramAccess({ propertyProgramId: id, userId });
    return res.json({ program });
  } catch (err: any) {
    if (String(err?.message || "").includes("Not allowed"))
      return res.status(403).json({ message: "Not allowed" });
    if (String(err?.message || "").includes("not found"))
      return res.status(404).json({ message: "Not found" });
    console.error("[property-programs] get failed:", err);
    return res.status(500).json({ message: "Failed to load property program" });
  }
});

router.get("/api/property-programs/:id/events", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "id required" });

    await requirePropertyProgramAccess({ propertyProgramId: id, userId });

    const events = await db
      .select()
      .from(propertyLifecycleEvents)
      .where(eq(propertyLifecycleEvents.propertyProgramId, id))
      .orderBy(desc(propertyLifecycleEvents.occurredAt), desc(propertyLifecycleEvents.createdAt))
      .limit(200);

    return res.json({ events });
  } catch (err: any) {
    if (String(err?.message || "").includes("Not allowed"))
      return res.status(403).json({ message: "Not allowed" });
    if (String(err?.message || "").includes("not found"))
      return res.status(404).json({ message: "Not found" });
    console.error("[property-programs] events list failed:", err);
    return res.status(500).json({ message: "Failed to load events" });
  }
});

router.post("/api/property-programs/:id/events", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "id required" });

    await requirePropertyProgramAccess({ propertyProgramId: id, userId });

    const body = createEventSchema.parse(req.body ?? {});
    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
    if (!Number.isFinite(occurredAt.getTime())) {
      return res.status(400).json({ message: "occurredAt must be a valid ISO date" });
    }

    const created = await addPropertyLifecycleEvent({
      propertyProgramId: id,
      actionType: body.actionType,
      phase: body.phase || null,
      title: body.title,
      description: body.description || null,
      occurredAt,
      source: body.source || "user",
      status: body.status || "done",
      costAmount: body.costAmount ?? null,
      metadata: body.metadata || {},
      createdByUserId: userId,
      sourceSurface: body.sourceSurface || null,
      idempotencyKey: body.idempotencyKey || null,
    });

    return res.status(201).json({ event: created });
  } catch (err: any) {
    if (err?.name === "ZodError") return res.status(400).json({ message: "Invalid payload" });
    if (String(err?.message || "").includes("Not allowed"))
      return res.status(403).json({ message: "Not allowed" });
    if (String(err?.message || "").includes("not found"))
      return res.status(404).json({ message: "Not found" });
    console.error("[property-programs] event create failed:", err);
    return res.status(500).json({ message: "Failed to create event" });
  }
});

router.get("/api/property-programs/:id/homefax", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "id required" });

    await requirePropertyProgramAccess({ propertyProgramId: id, userId });

    const existing = await getLatestPropertyHomefaxSnapshot({ propertyProgramId: id });
    const snapshot =
      existing || (await recomputePropertyHomefaxSnapshot({ propertyProgramId: id }));

    return res.json({ snapshot });
  } catch (err: any) {
    if (String(err?.message || "").includes("Not allowed"))
      return res.status(403).json({ message: "Not allowed" });
    if (String(err?.message || "").includes("not found"))
      return res.status(404).json({ message: "Not found" });
    console.error("[property-programs] homefax failed:", err);
    return res.status(500).json({ message: "Failed to load homefax snapshot" });
  }
});

router.get("/api/property-programs/:id/readiness", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "id required" });

    await requirePropertyProgramAccess({ propertyProgramId: id, userId });

    const existing = await getLatestPropertyReadinessSnapshot({ propertyProgramId: id });
    const snapshot =
      existing || (await recomputePropertyReadinessSnapshot({ propertyProgramId: id }));

    return res.json({ snapshot });
  } catch (err: any) {
    if (String(err?.message || "").includes("Not allowed"))
      return res.status(403).json({ message: "Not allowed" });
    if (String(err?.message || "").includes("not found"))
      return res.status(404).json({ message: "Not found" });
    console.error("[property-programs] readiness failed:", err);
    return res.status(500).json({ message: "Failed to load readiness snapshot" });
  }
});

export const propertyProgramsRouter = router;
