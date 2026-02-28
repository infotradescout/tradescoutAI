import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import {
  USER_HOME_DOCUMENT_TYPES,
  USER_HOME_RECORD_TYPES,
  businesses,
  homeProjectPlans,
  homeProjects,
  homeMaintenanceSchedules,
  propertyPrograms,
  userHomeAppliances,
  userHomeDocuments,
  userHomeRecords,
  userHomes,
} from "../../shared/schema";
import { addPropertyLifecycleEvent } from "../services/propertyLifecycleService";

const router = Router();

const createHomeSchema = z.object({
  nickname: z.string().trim().min(1).max(160).optional(),
  propertyType: z.string().trim().min(1).max(64).optional(),
  yearBuilt: z.number().int().min(1600).max(2100).optional(),
  address1: z.string().trim().min(1).max(180).optional(),
  address2: z.string().trim().min(1).max(180).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  stateCode: z.string().trim().length(2).optional(),
  countyFips: z
    .string()
    .trim()
    .regex(/^[0-9]{5}$/)
    .optional(),
  zipCode: z.string().trim().min(3).max(12).optional(),
});

const createRecordSchema = z.object({
  recordType: z.enum(USER_HOME_RECORD_TYPES),
  occurredAt: z.string().trim().optional(), // YYYY-MM-DD
  title: z.string().trim().min(2).max(220),
  details: z.string().trim().max(20_000).optional(),
  cost: z.number().finite().nonnegative().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(24).optional(),
});

const createApplianceSchema = z.object({
  category: z.string().trim().min(2).max(64),
  brand: z.string().trim().max(120).optional(),
  model: z.string().trim().max(160).optional(),
  serial: z.string().trim().max(160).optional(),
  installedAt: z.string().trim().optional(), // YYYY-MM-DD
  notes: z.string().trim().max(20_000).optional(),
});

const addDocumentSchema = z.object({
  documentType: z.enum(USER_HOME_DOCUMENT_TYPES).optional(),
  objectKey: z.string().trim().min(3).max(600),
  originalName: z.string().trim().max(260).optional(),
  contentType: z.string().trim().max(160).optional(),
  bytes: z.number().int().nonnegative().optional(),
  recordId: z.string().trim().optional(),
});

const createMaintenanceScheduleSchema = z.object({
  title: z.string().trim().min(2).max(220),
  description: z.string().trim().max(20_000).optional(),
  category: z.string().trim().max(64).optional(),
  cadenceDays: z.number().int().min(1).max(3650).default(90),
  nextDueAt: z.string().trim().optional(), // ISO date
  assignedBusinessSlug: z.string().trim().min(2).max(140).optional(),
  shareWithAssignedProvider: z.boolean().optional(),
  shareAddress: z.boolean().optional(),
});

const updateMaintenanceScheduleSchema = z.object({
  title: z.string().trim().min(2).max(220).optional(),
  description: z.string().trim().max(20_000).optional(),
  category: z.string().trim().max(64).optional(),
  cadenceDays: z.number().int().min(1).max(3650).optional(),
  nextDueAt: z.string().trim().optional(), // ISO date
  status: z.enum(["active", "paused", "archived"]).optional(),
  assignedBusinessSlug: z.string().trim().min(0).max(140).optional(), // empty string clears assignment
  shareWithAssignedProvider: z.boolean().optional(),
  shareAddress: z.boolean().optional(),
});

const completeMaintenanceScheduleSchema = z.object({
  occurredAt: z.string().trim().optional(), // YYYY-MM-DD
  notes: z.string().trim().max(20_000).optional(),
  cost: z.number().finite().nonnegative().optional(),
});

const createHomeProjectSchema = z.object({
  title: z.string().trim().min(2).max(220),
  description: z.string().trim().max(20_000).optional(),
  projectType: z.string().trim().max(80).optional(),
  estimatedCost: z.number().finite().nonnegative().optional(),
  desiredStartAt: z.string().trim().optional(), // YYYY-MM-DD

  hasBudgetNow: z.boolean().optional(),
  monthlySavings: z.number().finite().nonnegative().optional(),
  targetBy: z.string().trim().optional(), // YYYY-MM-DD
  fundingSources: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  planNotes: z.string().trim().max(20_000).optional(),
});

const updateHomeProjectSchema = z.object({
  title: z.string().trim().min(2).max(220).optional(),
  description: z.string().trim().max(20_000).optional(),
  projectType: z.string().trim().max(80).optional(),
  estimatedCost: z.number().finite().nonnegative().optional(),
  desiredStartAt: z.string().trim().optional(), // YYYY-MM-DD
  status: z
    .enum(["planning", "saving", "ready", "in_progress", "completed", "paused", "canceled"])
    .optional(),
});

const upsertHomeProjectPlanSchema = z.object({
  planType: z.enum(["savings", "funding"]).optional(),
  targetAmount: z.number().finite().positive(),
  currentSaved: z.number().finite().nonnegative().optional(),
  targetBy: z.string().trim().optional(), // YYYY-MM-DD
  monthlyContribution: z.number().finite().nonnegative().optional(),
  fundingSources: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  notes: z.string().trim().max(20_000).optional(),
});

function getUserId(req: any): string {
  return String((req.user as any)?.claims?.sub || (req.user as any)?.id || "").trim();
}

async function requireHomeOwner(userId: string, homeId: string) {
  const [home] = await db
    .select()
    .from(userHomes)
    .where(and(eq(userHomes.id, homeId), eq(userHomes.ownerUserId, userId)))
    .limit(1);
  return home ?? null;
}

async function getLinkedPropertyProgramIdsForHome(homeId: string): Promise<string[]> {
  const rows = await db
    .select({ id: propertyPrograms.id })
    .from(propertyPrograms)
    .where(eq(propertyPrograms.userHomeId, homeId))
    .orderBy(desc(propertyPrograms.updatedAt))
    .limit(5);
  return rows.map((r) => String(r.id)).filter(Boolean);
}

function dateToNoonUtc(value: string): Date {
  // Stored as YYYY-MM-DD in the Home Vault. Convert to a stable timestamp.
  return new Date(`${value}T12:00:00.000Z`);
}

function parseIsoDateOrNull(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

function parseYmdOrNull(value: string | undefined): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function monthsBetweenInclusive(from: Date, to: Date): number {
  const f = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const t = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  const months =
    (t.getUTCFullYear() - f.getUTCFullYear()) * 12 + (t.getUTCMonth() - f.getUTCMonth());
  return Math.max(1, months + 1);
}

router.get("/api/homes", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homes = await db
    .select()
    .from(userHomes)
    .where(eq(userHomes.ownerUserId, userId))
    .orderBy(desc(userHomes.updatedAt))
    .limit(50);

  res.json({ homes });
});

router.post("/api/homes", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const body = createHomeSchema.parse(req.body ?? {});
  const [created] = await db
    .insert(userHomes)
    .values({
      ownerUserId: userId,
      nickname: body.nickname || null,
      propertyType: body.propertyType || null,
      yearBuilt: body.yearBuilt ?? null,
      address1: body.address1 || null,
      address2: body.address2 || null,
      city: body.city || null,
      stateCode: body.stateCode || null,
      countyFips: body.countyFips || null,
      zipCode: body.zipCode || null,
      updatedAt: new Date(),
    })
    .returning();

  res.status(201).json({ home: created });
});

router.get("/api/homes/:homeId", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const records = await db
    .select()
    .from(userHomeRecords)
    .where(eq(userHomeRecords.homeId, homeId))
    .orderBy(desc(userHomeRecords.occurredAt), desc(userHomeRecords.createdAt))
    .limit(100);

  const appliances = await db
    .select()
    .from(userHomeAppliances)
    .where(eq(userHomeAppliances.homeId, homeId))
    .orderBy(desc(userHomeAppliances.updatedAt))
    .limit(200);

  const documents = await db
    .select()
    .from(userHomeDocuments)
    .where(eq(userHomeDocuments.homeId, homeId))
    .orderBy(desc(userHomeDocuments.createdAt))
    .limit(200);

  res.json({ home, records, appliances, documents });
});

router.get("/api/homes/:homeId/maintenance-schedules", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const rows = await db
    .select({
      schedule: homeMaintenanceSchedules,
      businessName: businesses.name,
      businessSlug: businesses.slug,
    })
    .from(homeMaintenanceSchedules)
    .leftJoin(businesses, eq(businesses.id, homeMaintenanceSchedules.assignedBusinessId))
    .where(
      and(
        eq(homeMaintenanceSchedules.userHomeId, homeId),
        eq(homeMaintenanceSchedules.ownerUserId, userId)
      )
    )
    .orderBy(desc(homeMaintenanceSchedules.updatedAt))
    .limit(200);

  res.json({
    schedules: rows.map((row) => ({
      ...row.schedule,
      assignedBusiness: row.businessSlug
        ? { name: row.businessName, slug: row.businessSlug }
        : null,
    })),
  });
});

// ---------------------------------------------------------------------------
// Home Projects (Home Vault)
// ---------------------------------------------------------------------------

router.get("/api/homes/:homeId/projects", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const projects = await db
    .select()
    .from(homeProjects)
    .where(and(eq(homeProjects.userHomeId, homeId), eq(homeProjects.ownerUserId, userId)))
    .orderBy(desc(homeProjects.updatedAt))
    .limit(200);

  const projectIds = projects.map((p) => String((p as any).id)).filter(Boolean);
  const plans = projectIds.length
    ? await db
        .select()
        .from(homeProjectPlans)
        .where(
          and(
            eq(homeProjectPlans.ownerUserId, userId),
            inArray(homeProjectPlans.homeProjectId, projectIds)
          )
        )
        .orderBy(desc(homeProjectPlans.updatedAt))
    : [];

  const plansByProject = new Map<string, any>();
  for (const plan of plans) {
    const pid = String((plan as any).homeProjectId || "");
    if (pid && !plansByProject.has(pid)) plansByProject.set(pid, plan);
  }

  res.json({
    projects: projects.map((p: any) => ({ ...p, plan: plansByProject.get(String(p.id)) || null })),
  });
});

router.post("/api/homes/:homeId/projects", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const body = createHomeProjectSchema.parse(req.body ?? {});

  const desiredStartAt = parseYmdOrNull(body.desiredStartAt);
  const targetBy = parseYmdOrNull(body.targetBy);

  const hasBudgetNow = body.hasBudgetNow === true;
  const estimatedCost = body.estimatedCost != null ? Number(body.estimatedCost) : null;

  const status: any = hasBudgetNow ? "planning" : "saving";

  const [createdProject] = await db
    .insert(homeProjects)
    .values({
      ownerUserId: userId,
      userHomeId: homeId,
      title: body.title,
      description: body.description || null,
      projectType: body.projectType || null,
      status,
      estimatedCost: estimatedCost != null ? String(estimatedCost) : null,
      desiredStartAt,
      metadata: {},
      updatedAt: new Date(),
    } as any)
    .returning();

  if (!createdProject) return res.status(500).json({ message: "Failed to create project" });

  let createdPlan: any = null;

  if (!hasBudgetNow && estimatedCost != null && estimatedCost > 0) {
    let monthlyContribution: number | null = null;

    if (body.monthlySavings != null && Number(body.monthlySavings) > 0) {
      monthlyContribution = Number(body.monthlySavings);
    } else {
      const targetDate = targetBy
        ? dateToNoonUtc(targetBy)
        : desiredStartAt
          ? dateToNoonUtc(desiredStartAt)
          : null;
      if (targetDate) {
        const months = monthsBetweenInclusive(new Date(), targetDate);
        monthlyContribution = Math.ceil((estimatedCost / months) * 100) / 100;
      }
    }

    const [plan] = await db
      .insert(homeProjectPlans)
      .values({
        ownerUserId: userId,
        homeProjectId: String((createdProject as any).id),
        planType: (body.fundingSources && body.fundingSources.length
          ? "funding"
          : "savings") as any,
        targetAmount: String(estimatedCost),
        currentSaved: "0",
        targetBy: targetBy || null,
        monthlyContribution: monthlyContribution != null ? String(monthlyContribution) : null,
        fundingSources: body.fundingSources ?? [],
        notes: body.planNotes || null,
        updatedAt: new Date(),
      } as any)
      .returning();

    createdPlan = plan ?? null;
  }

  await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));

  try {
    const propertyProgramIds = await getLinkedPropertyProgramIdsForHome(homeId);
    for (const propertyProgramId of propertyProgramIds) {
      await addPropertyLifecycleEvent({
        propertyProgramId,
        actionType: "home_project_created",
        phase: "plan",
        title: body.title,
        description: body.description || null,
        occurredAt: new Date(),
        source: "user",
        status: hasBudgetNow ? "planned" : "blocked",
        costAmount: estimatedCost,
        metadata: {
          homeId,
          homeProjectId: createdProject.id,
          projectType: body.projectType || null,
          desiredStartAt,
          hasBudgetNow,
          plan: createdPlan ? { id: createdPlan.id, planType: createdPlan.planType } : null,
        },
        createdByUserId: userId,
        sourceSurface: "home_vault",
        idempotencyKey: `home:${homeId}:project:${createdProject.id}:created`,
      });
    }
  } catch (err) {
    console.error("[homes] Failed to sync project creation into property program:", err);
  }

  res.status(201).json({ project: createdProject, plan: createdPlan });
});

router.put("/api/homes/:homeId/projects/:projectId", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  const projectId = String(req.params.projectId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });
  if (!projectId) return res.status(400).json({ message: "projectId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const updates = updateHomeProjectSchema.parse(req.body ?? {});
  const desiredStartAt = parseYmdOrNull(updates.desiredStartAt);

  const patch: any = {
    updatedAt: new Date(),
  };
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined) patch.description = updates.description || null;
  if (updates.projectType !== undefined) patch.projectType = updates.projectType || null;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.estimatedCost !== undefined)
    patch.estimatedCost = updates.estimatedCost != null ? String(updates.estimatedCost) : null;
  if (updates.desiredStartAt !== undefined) patch.desiredStartAt = desiredStartAt;

  const rows = await db
    .update(homeProjects)
    .set(patch)
    .where(
      and(
        eq(homeProjects.id, projectId),
        eq(homeProjects.userHomeId, homeId),
        eq(homeProjects.ownerUserId, userId)
      )
    )
    .returning();

  const updated = rows[0];
  if (!updated) return res.status(404).json({ message: "Project not found" });

  await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));
  res.json({ project: updated });
});

router.post(
  "/api/homes/:homeId/projects/:projectId/plan",
  isAuthenticated,
  async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const homeId = String(req.params.homeId || "").trim();
    const projectId = String(req.params.projectId || "").trim();
    if (!homeId) return res.status(400).json({ message: "homeId required" });
    if (!projectId) return res.status(400).json({ message: "projectId required" });

    const home = await requireHomeOwner(userId, homeId);
    if (!home) return res.status(404).json({ message: "Home not found" });

    const [project] = await db
      .select()
      .from(homeProjects)
      .where(
        and(
          eq(homeProjects.id, projectId),
          eq(homeProjects.userHomeId, homeId),
          eq(homeProjects.ownerUserId, userId)
        )
      )
      .limit(1);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const body = upsertHomeProjectPlanSchema.parse(req.body ?? {});
    const targetBy = parseYmdOrNull(body.targetBy);

    const [existing] = await db
      .select()
      .from(homeProjectPlans)
      .where(
        and(eq(homeProjectPlans.homeProjectId, projectId), eq(homeProjectPlans.ownerUserId, userId))
      )
      .orderBy(desc(homeProjectPlans.updatedAt))
      .limit(1);

    const values: any = {
      ownerUserId: userId,
      homeProjectId: projectId,
      planType: body.planType || (existing as any)?.planType || "savings",
      targetAmount: String(body.targetAmount),
      currentSaved:
        body.currentSaved != null
          ? String(body.currentSaved)
          : (existing as any)?.currentSaved || "0",
      targetBy: targetBy || null,
      monthlyContribution:
        body.monthlyContribution != null
          ? String(body.monthlyContribution)
          : (existing as any)?.monthlyContribution || null,
      fundingSources: body.fundingSources ?? (existing as any)?.fundingSources ?? [],
      notes: body.notes ?? (existing as any)?.notes ?? null,
      updatedAt: new Date(),
    };

    let saved: any = null;
    if (existing?.id) {
      const [row] = await db
        .update(homeProjectPlans)
        .set(values)
        .where(eq(homeProjectPlans.id, (existing as any).id))
        .returning();
      saved = row ?? null;
    } else {
      const [row] = await db.insert(homeProjectPlans).values(values).returning();
      saved = row ?? null;
    }

    await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));

    res.status(201).json({ plan: saved });
  }
);

router.post("/api/homes/:homeId/maintenance-schedules", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const body = createMaintenanceScheduleSchema.parse(req.body ?? {});
  const nextDueAt = parseIsoDateOrNull(body.nextDueAt) || addDays(new Date(), body.cadenceDays);

  let assignedBusinessId: string | null = null;
  if (body.assignedBusinessSlug) {
    const [biz] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(
        and(eq(businesses.slug, body.assignedBusinessSlug), eq(businesses.status, "active" as any))
      )
      .limit(1);
    assignedBusinessId = biz?.id ?? null;
  }

  const [created] = await db
    .insert(homeMaintenanceSchedules)
    .values({
      ownerUserId: userId,
      userHomeId: homeId,
      title: body.title,
      description: body.description || null,
      category: body.category || null,
      cadenceDays: body.cadenceDays,
      nextDueAt,
      status: "active",
      assignedBusinessId,
      shareWithAssignedProvider: body.shareWithAssignedProvider === true,
      shareAddress: body.shareAddress === true,
      metadata: {},
      updatedAt: new Date(),
    } as any)
    .returning();

  await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));

  // Optional: log schedule creation to any linked property programs.
  try {
    const propertyProgramIds = await getLinkedPropertyProgramIdsForHome(homeId);
    for (const propertyProgramId of propertyProgramIds) {
      await addPropertyLifecycleEvent({
        propertyProgramId,
        actionType: "maintenance_schedule_created",
        phase: "operate",
        title: `Maintenance scheduled: ${body.title}`,
        description: body.description || null,
        occurredAt: new Date(),
        source: "user",
        status: "done",
        metadata: {
          homeId,
          maintenanceScheduleId: created?.id ?? null,
          cadenceDays: body.cadenceDays,
          nextDueAt: nextDueAt.toISOString(),
        },
        createdByUserId: userId,
        sourceSurface: "home_vault",
        idempotencyKey: `home:${homeId}:maint_sched:create:${created?.id ?? "missing"}`,
      });
    }
  } catch (err) {
    console.error("[homes] Failed to sync maintenance schedule create into property program:", err);
  }

  res.status(201).json({ schedule: created });
});

router.patch(
  "/api/homes/:homeId/maintenance-schedules/:scheduleId",
  isAuthenticated,
  async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const homeId = String(req.params.homeId || "").trim();
    const scheduleId = String(req.params.scheduleId || "").trim();
    if (!homeId) return res.status(400).json({ message: "homeId required" });
    if (!scheduleId) return res.status(400).json({ message: "scheduleId required" });

    const home = await requireHomeOwner(userId, homeId);
    if (!home) return res.status(404).json({ message: "Home not found" });

    const body = updateMaintenanceScheduleSchema.parse(req.body ?? {});
    const nextDueAt = body.nextDueAt ? parseIsoDateOrNull(body.nextDueAt) : null;
    if (body.nextDueAt && !nextDueAt) {
      return res.status(400).json({ message: "nextDueAt must be a valid ISO date" });
    }

    let assignedBusinessId: string | null | undefined = undefined;
    if (body.assignedBusinessSlug != null) {
      if (!body.assignedBusinessSlug) {
        assignedBusinessId = null;
      } else {
        const [biz] = await db
          .select({ id: businesses.id })
          .from(businesses)
          .where(
            and(
              eq(businesses.slug, body.assignedBusinessSlug),
              eq(businesses.status, "active" as any)
            )
          )
          .limit(1);
        assignedBusinessId = biz?.id ?? null;
      }
    }

    const rows = await db
      .update(homeMaintenanceSchedules)
      .set({
        ...(body.title != null ? { title: body.title } : {}),
        ...(body.description != null ? { description: body.description || null } : {}),
        ...(body.category != null ? { category: body.category || null } : {}),
        ...(body.cadenceDays != null ? { cadenceDays: body.cadenceDays } : {}),
        ...(nextDueAt ? { nextDueAt } : {}),
        ...(body.status != null ? { status: body.status } : {}),
        ...(assignedBusinessId !== undefined ? { assignedBusinessId } : {}),
        ...(body.shareWithAssignedProvider != null
          ? { shareWithAssignedProvider: body.shareWithAssignedProvider === true }
          : {}),
        ...(body.shareAddress != null ? { shareAddress: body.shareAddress === true } : {}),
        updatedAt: new Date(),
      } as any)
      .where(
        and(
          eq(homeMaintenanceSchedules.id, scheduleId),
          eq(homeMaintenanceSchedules.userHomeId, homeId),
          eq(homeMaintenanceSchedules.ownerUserId, userId)
        )
      )
      .returning();

    const updated = rows[0];
    if (!updated) return res.status(404).json({ message: "Schedule not found" });

    await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));
    res.json({ schedule: updated });
  }
);

router.post(
  "/api/homes/:homeId/maintenance-schedules/:scheduleId/complete",
  isAuthenticated,
  async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const homeId = String(req.params.homeId || "").trim();
    const scheduleId = String(req.params.scheduleId || "").trim();
    if (!homeId) return res.status(400).json({ message: "homeId required" });
    if (!scheduleId) return res.status(400).json({ message: "scheduleId required" });

    const home = await requireHomeOwner(userId, homeId);
    if (!home) return res.status(404).json({ message: "Home not found" });

    const body = completeMaintenanceScheduleSchema.parse(req.body ?? {});
    const occurredAt =
      body.occurredAt && /^\d{4}-\d{2}-\d{2}$/.test(body.occurredAt) ? body.occurredAt : null;

    const [schedule] = await db
      .select()
      .from(homeMaintenanceSchedules)
      .where(
        and(
          eq(homeMaintenanceSchedules.id, scheduleId),
          eq(homeMaintenanceSchedules.userHomeId, homeId),
          eq(homeMaintenanceSchedules.ownerUserId, userId)
        )
      )
      .limit(1);
    if (!schedule) return res.status(404).json({ message: "Schedule not found" });

    const completedAt = occurredAt ? dateToNoonUtc(occurredAt) : new Date();
    const nextDueAt = addDays(completedAt, Number(schedule.cadenceDays || 30));

    const [record] = await db
      .insert(userHomeRecords)
      .values({
        homeId,
        createdByUserId: userId,
        recordType: "maintenance",
        occurredAt,
        title: `Maintenance: ${schedule.title}`,
        details: body.notes || null,
        cost: body.cost != null ? String(body.cost) : null,
        tags: ["scheduled"],
        updatedAt: new Date(),
      } as any)
      .returning();

    const [updated] = await db
      .update(homeMaintenanceSchedules)
      .set({
        lastCompletedAt: completedAt,
        nextDueAt,
        updatedAt: new Date(),
      } as any)
      .where(eq(homeMaintenanceSchedules.id, scheduleId))
      .returning();

    await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));

    try {
      const propertyProgramIds = await getLinkedPropertyProgramIdsForHome(homeId);
      for (const propertyProgramId of propertyProgramIds) {
        await addPropertyLifecycleEvent({
          propertyProgramId,
          actionType: "home_record_maintenance",
          phase: "operate",
          title: `Maintenance: ${schedule.title}`,
          description: body.notes || null,
          occurredAt: completedAt,
          source: "user",
          status: "done",
          costAmount: body.cost ?? null,
          metadata: {
            homeId,
            homeRecordId: record?.id ?? null,
            maintenanceScheduleId: schedule.id,
            nextDueAt: nextDueAt.toISOString(),
            tags: ["scheduled"],
          },
          createdByUserId: userId,
          sourceSurface: "home_vault",
          idempotencyKey: `home:${homeId}:record:${record?.id ?? "missing"}`,
        });
      }
    } catch (err) {
      console.error("[homes] Failed to sync maintenance completion into property program:", err);
    }

    res.status(201).json({ schedule: updated, record });
  }
);

router.post("/api/homes/:homeId/records", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const body = createRecordSchema.parse(req.body ?? {});
  const occurredAt =
    body.occurredAt && /^\d{4}-\d{2}-\d{2}$/.test(body.occurredAt) ? body.occurredAt : null;

  const [created] = await db
    .insert(userHomeRecords)
    .values({
      homeId,
      createdByUserId: userId,
      recordType: body.recordType,
      occurredAt,
      title: body.title,
      details: body.details || null,
      cost: body.cost != null ? String(body.cost) : null,
      tags: body.tags ?? [],
      updatedAt: new Date(),
    })
    .returning();

  await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));

  // Auto-sync Home Vault action into any linked Property Program(s) so Scout + lifecycle
  // surfaces stay current without manual duplication.
  try {
    const propertyProgramIds = await getLinkedPropertyProgramIdsForHome(homeId);
    for (const propertyProgramId of propertyProgramIds) {
      await addPropertyLifecycleEvent({
        propertyProgramId,
        actionType: `home_record_${body.recordType}`,
        phase: "operate",
        title: body.title,
        description: body.details || null,
        occurredAt: occurredAt ? dateToNoonUtc(occurredAt) : new Date(),
        source: "user",
        status: "done",
        costAmount: body.cost ?? null,
        metadata: {
          homeId,
          homeRecordId: created?.id ?? null,
          tags: body.tags ?? [],
        },
        createdByUserId: userId,
        sourceSurface: "home_vault",
        idempotencyKey: `home:${homeId}:record:${created?.id ?? "missing"}`,
      });
    }
  } catch (err) {
    console.error("[homes] Failed to sync record into property program:", err);
  }

  res.status(201).json({ record: created });
});

router.post("/api/homes/:homeId/appliances", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const body = createApplianceSchema.parse(req.body ?? {});
  const installedAt =
    body.installedAt && /^\d{4}-\d{2}-\d{2}$/.test(body.installedAt) ? body.installedAt : null;

  const [created] = await db
    .insert(userHomeAppliances)
    .values({
      homeId,
      createdByUserId: userId,
      category: body.category,
      brand: body.brand || null,
      model: body.model || null,
      serial: body.serial || null,
      installedAt,
      notes: body.notes || null,
      updatedAt: new Date(),
    })
    .returning();

  await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));

  try {
    const propertyProgramIds = await getLinkedPropertyProgramIdsForHome(homeId);
    const label = [body.category, body.brand, body.model].filter(Boolean).join(" ").trim();
    for (const propertyProgramId of propertyProgramIds) {
      await addPropertyLifecycleEvent({
        propertyProgramId,
        actionType: "home_appliance_added",
        phase: "operate",
        title: label ? `Appliance added: ${label}` : `Appliance added: ${body.category}`,
        description: body.notes || null,
        occurredAt: installedAt ? dateToNoonUtc(installedAt) : new Date(),
        source: "user",
        status: "done",
        metadata: {
          homeId,
          applianceId: created?.id ?? null,
          category: body.category,
        },
        createdByUserId: userId,
        sourceSurface: "home_vault",
        idempotencyKey: `home:${homeId}:appliance:${created?.id ?? "missing"}`,
      });
    }
  } catch (err) {
    console.error("[homes] Failed to sync appliance into property program:", err);
  }

  res.status(201).json({ appliance: created });
});

router.post("/api/homes/:homeId/documents", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const body = addDocumentSchema.parse(req.body ?? {});

  // Optional recordId must belong to the same home.
  let recordId: string | null = null;
  if (body.recordId) {
    const [record] = await db
      .select({ id: userHomeRecords.id })
      .from(userHomeRecords)
      .where(and(eq(userHomeRecords.id, body.recordId), eq(userHomeRecords.homeId, homeId)))
      .limit(1);
    if (!record) {
      return res.status(400).json({ message: "Invalid recordId for home" });
    }
    recordId = body.recordId;
  }

  const [created] = await db
    .insert(userHomeDocuments)
    .values({
      homeId,
      recordId,
      uploadedByUserId: userId,
      documentType: body.documentType || "other",
      objectKey: body.objectKey,
      originalName: body.originalName || null,
      contentType: body.contentType || null,
      bytes: body.bytes ?? null,
    })
    .returning();

  await db.update(userHomes).set({ updatedAt: new Date() }).where(eq(userHomes.id, homeId));

  try {
    const propertyProgramIds = await getLinkedPropertyProgramIdsForHome(homeId);
    for (const propertyProgramId of propertyProgramIds) {
      await addPropertyLifecycleEvent({
        propertyProgramId,
        actionType: "home_document_added",
        phase: "operate",
        title: `Document added: ${body.documentType || "other"}`,
        description: body.originalName || null,
        occurredAt: new Date(),
        source: "user",
        status: "done",
        metadata: {
          homeId,
          homeRecordId: recordId,
          homeDocumentId: created?.id ?? null,
          documentType: body.documentType || "other",
          objectKey: body.objectKey,
        },
        createdByUserId: userId,
        sourceSurface: "home_vault",
        idempotencyKey: `home:${homeId}:document:${created?.id ?? "missing"}`,
      });
    }
  } catch (err) {
    console.error("[homes] Failed to sync document into property program:", err);
  }

  res.status(201).json({ document: created });
});

router.get(
  "/api/homes/:homeId/documents/:docId/download",
  isAuthenticated,
  async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });

    const homeId = String(req.params.homeId || "").trim();
    const docId = String(req.params.docId || "").trim();
    if (!homeId || !docId) return res.status(400).json({ message: "homeId and docId required" });

    const home = await requireHomeOwner(userId, homeId);
    if (!home) return res.status(404).json({ message: "Home not found" });

    const [doc] = await db
      .select()
      .from(userHomeDocuments)
      .where(and(eq(userHomeDocuments.id, docId), eq(userHomeDocuments.homeId, homeId)))
      .limit(1);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const objectKey = String((doc as any).objectKey || "");
    if (!objectKey) return res.status(400).json({ message: "Document is missing objectKey" });

    // If the key is already a URL (legacy/dev), redirect directly.
    if (/^https?:\/\//i.test(objectKey)) {
      return res.redirect(302, objectKey);
    }

    const useR2 = Boolean(process.env.R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID);

    if (useR2) {
      try {
        const { R2StorageService } = await import("../localStorage");
        const storageService = new R2StorageService();
        const url = await storageService.getDownloadURL(objectKey, {
          filename: typeof (doc as any).originalName === "string" ? (doc as any).originalName : "",
        });
        return res.redirect(302, url);
      } catch (err) {
        console.error("[homes] Failed to sign download URL:", err);
        return res.status(500).json({ message: "Failed to download file" });
      }
    }

    try {
      const { LocalStorageService } = await import("../localStorage");
      const storageService = new LocalStorageService();
      const filePath = await storageService.getPrivateFilePathFromObjectKey(objectKey);
      if (!filePath) return res.status(404).json({ message: "File not found" });

      const filename =
        typeof (doc as any).originalName === "string" && (doc as any).originalName.trim()
          ? (doc as any).originalName.trim()
          : "document";

      return res.download(filePath, filename);
    } catch (err) {
      console.error("[homes] Failed to download private file:", err);
      return res.status(500).json({ message: "Failed to download file" });
    }
  }
);

router.get("/api/homes/:homeId/prefill-homescout", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const homeId = String(req.params.homeId || "").trim();
  if (!homeId) return res.status(400).json({ message: "homeId required" });

  const home = await requireHomeOwner(userId, homeId);
  if (!home) return res.status(404).json({ message: "Home not found" });

  const nickname = typeof (home as any).nickname === "string" ? (home as any).nickname.trim() : "";
  const propertyType =
    typeof (home as any).propertyType === "string" ? (home as any).propertyType.trim() : "";
  const city = typeof (home as any).city === "string" ? (home as any).city.trim() : "";
  const stateCode =
    typeof (home as any).stateCode === "string" ? (home as any).stateCode.trim() : "";
  const countyFips =
    typeof (home as any).countyFips === "string" ? (home as any).countyFips.trim() : "";
  const zipCode = typeof (home as any).zipCode === "string" ? (home as any).zipCode.trim() : "";
  const address1 = typeof (home as any).address1 === "string" ? (home as any).address1.trim() : "";
  const yearBuilt = (home as any).yearBuilt != null ? Number((home as any).yearBuilt) : null;

  const titleBase =
    nickname ||
    (propertyType && city && stateCode
      ? `${propertyType} in ${city}, ${stateCode}`
      : city && stateCode
        ? `Home in ${city}, ${stateCode}`
        : "Home for sale");

  const title = titleBase.length >= 10 ? titleBase : `${titleBase} listing`;

  const descriptionLines: string[] = [];
  if (propertyType) descriptionLines.push(`Property type: ${propertyType}`);
  if (yearBuilt && Number.isFinite(yearBuilt)) descriptionLines.push(`Year built: ${yearBuilt}`);
  descriptionLines.push("");
  descriptionLines.push(
    "Records and inspection documents are tracked privately in TradeScout (Home Vault)."
  );

  return res.json({
    homeId,
    title,
    description: descriptionLines.join("\n").trim(),
    propertyType: propertyType || undefined,
    yearBuilt: yearBuilt && Number.isFinite(yearBuilt) ? yearBuilt : undefined,
    address: address1 || undefined,
    city: city || undefined,
    stateCode: stateCode || undefined,
    countyFips: countyFips || undefined,
    zipCode: zipCode || undefined,
  });
});

// Provider-side view: schedules explicitly shared with a provider's owned business listing(s).
// Intentionally minimal payload: no street address by default; homeowners control sharing.
router.get("/api/provider/maintenance-schedules", isAuthenticated, async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });

  const ownedBusinesses = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.ownerUserId, userId), eq(businesses.status, "active" as any)))
    .limit(200);

  const ownedIds = ownedBusinesses.map((b) => String(b.id)).filter(Boolean);
  if (ownedIds.length === 0) return res.json({ schedules: [] });

  const results = await db
    .select({
      schedule: homeMaintenanceSchedules,
      homeNickname: userHomes.nickname,
      homeStateCode: userHomes.stateCode,
      homeCountyFips: userHomes.countyFips,
      assignedBusinessSlug: businesses.slug,
      assignedBusinessName: businesses.name,
    })
    .from(homeMaintenanceSchedules)
    .innerJoin(businesses, eq(businesses.id, homeMaintenanceSchedules.assignedBusinessId))
    .innerJoin(userHomes, eq(userHomes.id, homeMaintenanceSchedules.userHomeId))
    .where(
      and(
        inArray(homeMaintenanceSchedules.assignedBusinessId, ownedIds as any),
        eq(homeMaintenanceSchedules.shareWithAssignedProvider, true),
        eq(homeMaintenanceSchedules.status, "active")
      )
    )
    .orderBy(desc(homeMaintenanceSchedules.nextDueAt))
    .limit(500);

  return res.json({
    schedules: results.map((r) => ({
      ...r.schedule,
      home: {
        nickname: r.homeNickname || "Home",
        stateCode: r.homeStateCode,
        countyFips: r.homeCountyFips,
        shareAddress: (r.schedule as any).shareAddress === true,
      },
      assignedBusiness: {
        name: r.assignedBusinessName,
        slug: r.assignedBusinessSlug,
      },
    })),
  });
});

export const homesRouter = router;
