import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import {
  propertyEventLog,
  propertyHomefaxSnapshots,
  propertyLifecycleEvents,
  propertyParticipants,
  propertyPrograms,
  propertyReadinessSnapshots,
  type InsertPropertyEventLogRow,
  type InsertPropertyHomefaxSnapshot,
  type InsertPropertyLifecycleEvent,
  type InsertPropertyProgram,
  type InsertPropertyReadinessSnapshot,
  type PropertyHomefaxSnapshot,
  type PropertyProgram,
  type PropertyReadinessSnapshot,
} from "@shared/schema";

export type PropertyProgramCreateInput = {
  ownerUserId: string;
  primaryUserId: string;
  countyFips: string;
  stateCode: string;
  mode: "build" | "existing";
  status?: "draft" | "active" | "paused" | "completed";
  addressJson?: Record<string, any>;
  userHomeId?: string | null;
  parcelId?: string | null;
  propertyType?: string | null;
  yearBuilt?: number | null;
  metadata?: Record<string, any>;
};

export type PropertyLifecycleEventCreateInput = {
  propertyProgramId: string;
  actionType: string;
  phase?: string | null;
  title: string;
  description?: string | null;
  occurredAt: Date;
  source?: "user" | "scout" | "integration" | "system";
  status?: "planned" | "in_progress" | "done" | "blocked";
  costAmount?: number | string | null;
  metadata?: Record<string, any>;
  createdByUserId?: string | null;
  sourceSurface?: string | null;
  idempotencyKey?: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeIdempotencyKey(input: string) {
  return input.trim().slice(0, 180);
}

export async function requirePropertyProgramAccess(params: {
  propertyProgramId: string;
  userId: string;
}): Promise<PropertyProgram> {
  const propertyProgramId = String(params.propertyProgramId || "").trim();
  const userId = String(params.userId || "").trim();
  if (!propertyProgramId) throw new Error("propertyProgramId required");
  if (!userId) throw new Error("userId required");

  const [program] = await db
    .select()
    .from(propertyPrograms)
    .where(eq(propertyPrograms.id, propertyProgramId))
    .limit(1);
  if (!program) throw new Error("Property program not found");

  const [participant] = await db
    .select({ id: propertyParticipants.id })
    .from(propertyParticipants)
    .where(
      and(
        eq(propertyParticipants.propertyProgramId, propertyProgramId),
        eq(propertyParticipants.userId, userId),
        eq(propertyParticipants.status, "active")
      )
    )
    .limit(1);

  const isOwnerLike =
    String(program.ownerUserId) === userId || String(program.primaryUserId) === userId;
  if (!participant && !isOwnerLike) throw new Error("Not allowed");

  return program;
}

export async function createPropertyProgram(input: PropertyProgramCreateInput): Promise<PropertyProgram> {
  const ownerUserId = String(input.ownerUserId || "").trim();
  const primaryUserId = String(input.primaryUserId || "").trim();
  if (!ownerUserId) throw new Error("ownerUserId required");
  if (!primaryUserId) throw new Error("primaryUserId required");

  const row: InsertPropertyProgram = {
    ownerUserId,
    primaryUserId,
    countyFips: String(input.countyFips || "").trim(),
    stateCode: String(input.stateCode || "").trim(),
    mode: input.mode,
    status: input.status || "draft",
    addressJson: input.addressJson || {},
    userHomeId: input.userHomeId ?? null,
    parcelId: input.parcelId ?? null,
    propertyType: input.propertyType ?? null,
    yearBuilt: input.yearBuilt ?? null,
    metadata: input.metadata || {},
    updatedAt: new Date(),
  } as any;

  const created = await db.transaction(async (tx) => {
    const [program] = await tx.insert(propertyPrograms).values(row).returning();
    if (!program) throw new Error("Failed to create property program");

    const participants = [
      { userId: ownerUserId, role: "owner" },
      { userId: primaryUserId, role: "primary" },
    ];

    for (const p of participants) {
      await tx
        .insert(propertyParticipants)
        .values({
          propertyProgramId: program.id,
          userId: p.userId,
          participantRole: p.role,
          status: "active",
          permissions: {},
          updatedAt: new Date(),
        } as any)
        .onConflictDoNothing();
    }

    return program;
  });

  return created;
}

async function emitPropertyEventLogRow(row: InsertPropertyEventLogRow): Promise<void> {
  const key = safeIdempotencyKey(String((row as any).idempotencyKey || ""));
  if (!key) return;

  // Use raw SQL so we can always rely on the unique index created in migrations.
  await db.execute(sql`
    INSERT INTO property_event_log (
      event_id,
      property_program_id,
      action_type,
      actor_user_id,
      actor_role,
      county_fips,
      state_code,
      occurred_at_utc,
      recorded_at_utc,
      timezone,
      local_date,
      status_before,
      status_after,
      cost_amount,
      time_delta_hours,
      risk_delta,
      trust_snapshot_ids,
      verification_snapshot,
      document_refs,
      source_surface,
      metadata,
      idempotency_key
    )
    VALUES (
      ${row.eventId},
      ${row.propertyProgramId},
      ${row.actionType},
      ${row.actorUserId ?? null},
      ${row.actorRole ?? null},
      ${row.countyFips ?? null},
      ${row.stateCode ?? null},
      ${row.occurredAtUtc},
      ${row.recordedAtUtc ?? new Date()},
      ${row.timezone ?? null},
      ${row.localDate ?? null},
      ${row.statusBefore ?? null},
      ${row.statusAfter ?? null},
      ${row.costAmount ?? null},
      ${row.timeDeltaHours ?? null},
      ${row.riskDelta ?? null},
      ${JSON.stringify(row.trustSnapshotIds ?? {})}::jsonb,
      ${JSON.stringify(row.verificationSnapshot ?? {})}::jsonb,
      ${JSON.stringify(row.documentRefs ?? [])}::jsonb,
      ${row.sourceSurface ?? null},
      ${JSON.stringify(row.metadata ?? {})}::jsonb,
      ${key}
    )
    ON CONFLICT (idempotency_key) DO NOTHING
  `);
}

export async function recomputePropertyHomefaxSnapshot(params: {
  propertyProgramId: string;
}): Promise<PropertyHomefaxSnapshot> {
  const propertyProgramId = String(params.propertyProgramId || "").trim();
  if (!propertyProgramId) throw new Error("propertyProgramId required");

  const events = await db
    .select()
    .from(propertyLifecycleEvents)
    .where(eq(propertyLifecycleEvents.propertyProgramId, propertyProgramId))
    .orderBy(desc(propertyLifecycleEvents.occurredAt), desc(propertyLifecycleEvents.createdAt))
    .limit(250);

  const timeline = events
    .map((e) => ({
      id: e.id,
      source: e.source,
      type: e.actionType,
      phase: e.phase || null,
      title: e.title,
      occurredAt: e.occurredAt,
      status: e.status,
      costAmount: e.costAmount ?? null,
    }))
    .slice(0, 200);

  const totalCost = events.reduce((acc, e) => acc + Number(e.costAmount ?? 0), 0);
  const blockedCount = events.filter((e) => e.status === "blocked").length;

  const summary = {
    eventCount: events.length,
    blockedCount,
    totalCost: Number.isFinite(totalCost) ? Number(totalCost.toFixed(2)) : 0,
    lastEventAt: events[0]?.occurredAt || null,
    updatedAt: new Date().toISOString(),
  };

  const payload: InsertPropertyHomefaxSnapshot = {
    propertyProgramId,
    summary,
    timeline,
    computedAt: new Date(),
    version: 1,
  } as any;

  const [created] = await db.insert(propertyHomefaxSnapshots).values(payload).returning();
  if (!created) throw new Error("Failed to compute homefax snapshot");
  return created;
}

export async function recomputePropertyReadinessSnapshot(params: {
  propertyProgramId: string;
}): Promise<PropertyReadinessSnapshot> {
  const propertyProgramId = String(params.propertyProgramId || "").trim();
  if (!propertyProgramId) throw new Error("propertyProgramId required");

  const eventAgg = (await db.execute(sql`
    SELECT
      COUNT(*)::int AS event_count,
      COUNT(*) FILTER (WHERE status = 'blocked')::int AS blocked_count
    FROM property_lifecycle_events
    WHERE property_program_id = ${propertyProgramId}
  `)) as any;

  const eventCount = Number(eventAgg?.rows?.[0]?.event_count ?? 0) || 0;
  const blockedCount = Number(eventAgg?.rows?.[0]?.blocked_count ?? 0) || 0;

  // Conservative v1 readiness: enough to drive "next step" automation without inventing facts.
  let score = 40;
  if (eventCount >= 3) score += 10;
  if (eventCount >= 10) score += 10;
  if (blockedCount > 0) score -= Math.min(20, blockedCount * 5);
  score = clamp(score, 0, 100);

  const hardBlockers: any[] = [];
  const softBlockers: any[] = [];
  const nextBestActions: any[] = [];

  if (eventCount === 0) {
    softBlockers.push({ code: "no_history", message: "No lifecycle history yet." });
    nextBestActions.push({ action: "add_first_event", message: "Add your first milestone or record." });
  }
  if (blockedCount > 0) {
    softBlockers.push({
      code: "blocked_items",
      message: "Some items are blocked. Resolve blockers to improve readiness.",
      blockedCount,
    });
    nextBestActions.push({ action: "resolve_blockers", message: "Review and resolve blocked items." });
  }

  const payload: InsertPropertyReadinessSnapshot = {
    propertyProgramId,
    readinessScore: String(score) as any,
    hardBlockers,
    softBlockers,
    nextBestActions,
    computedAt: new Date(),
    version: 1,
  } as any;

  const [created] = await db.insert(propertyReadinessSnapshots).values(payload).returning();
  if (!created) throw new Error("Failed to compute readiness snapshot");
  return created;
}

export async function getLatestPropertyHomefaxSnapshot(params: {
  propertyProgramId: string;
}): Promise<PropertyHomefaxSnapshot | null> {
  const propertyProgramId = String(params.propertyProgramId || "").trim();
  if (!propertyProgramId) return null;
  const [row] = await db
    .select()
    .from(propertyHomefaxSnapshots)
    .where(eq(propertyHomefaxSnapshots.propertyProgramId, propertyProgramId))
    .orderBy(desc(propertyHomefaxSnapshots.computedAt))
    .limit(1);
  return row ?? null;
}

export async function getLatestPropertyReadinessSnapshot(params: {
  propertyProgramId: string;
}): Promise<PropertyReadinessSnapshot | null> {
  const propertyProgramId = String(params.propertyProgramId || "").trim();
  if (!propertyProgramId) return null;
  const [row] = await db
    .select()
    .from(propertyReadinessSnapshots)
    .where(eq(propertyReadinessSnapshots.propertyProgramId, propertyProgramId))
    .orderBy(desc(propertyReadinessSnapshots.computedAt))
    .limit(1);
  return row ?? null;
}

export async function addPropertyLifecycleEvent(input: PropertyLifecycleEventCreateInput) {
  const idempotencyKeyRaw =
    input.idempotencyKey && input.idempotencyKey.trim().length > 0
      ? input.idempotencyKey
      : `property:${input.propertyProgramId}:event:${input.actionType}:${input.occurredAt.toISOString()}:${input.title}`;
  const idempotencyKey = safeIdempotencyKey(idempotencyKeyRaw);

  const created = await db.transaction(async (tx) => {
    const row: InsertPropertyLifecycleEvent = {
      propertyProgramId: input.propertyProgramId,
      actionType: String(input.actionType || "").trim().slice(0, 80),
      phase: input.phase ? String(input.phase).trim().slice(0, 80) : null,
      title: String(input.title || "").trim(),
      description: input.description ? String(input.description) : null,
      occurredAt: input.occurredAt,
      source: input.source || "system",
      status: input.status || "planned",
      costAmount: input.costAmount != null ? String(input.costAmount) : null,
      metadata: input.metadata || {},
      createdByUserId: input.createdByUserId ?? null,
      updatedAt: new Date(),
    } as any;

    const [event] = await tx.insert(propertyLifecycleEvents).values(row).returning();
    if (!event) throw new Error("Failed to create lifecycle event");

    const [program] = await tx
      .select()
      .from(propertyPrograms)
      .where(eq(propertyPrograms.id, input.propertyProgramId))
      .limit(1);
    if (!program) throw new Error("Property program not found");

    await emitPropertyEventLogRow({
      eventId: event.id,
      propertyProgramId: input.propertyProgramId,
      actionType: event.actionType,
      actorUserId: input.createdByUserId ?? null,
      actorRole: null,
      countyFips: program.countyFips,
      stateCode: program.stateCode,
      occurredAtUtc: input.occurredAt,
      recordedAtUtc: new Date(),
      timezone: null,
      localDate: null,
      statusBefore: null,
      statusAfter: event.status,
      costAmount: event.costAmount ?? null,
      timeDeltaHours: null,
      riskDelta: null,
      trustSnapshotIds: {},
      verificationSnapshot: {},
      documentRefs: [],
      sourceSurface: input.sourceSurface ?? null,
      metadata: { eventSource: event.source, phase: event.phase ?? null },
      idempotencyKey,
    } as any);

    return event;
  });

  // Auto-update snapshots for read-only UI and Scout context.
  await Promise.all([
    recomputePropertyHomefaxSnapshot({ propertyProgramId: input.propertyProgramId }),
    recomputePropertyReadinessSnapshot({ propertyProgramId: input.propertyProgramId }),
  ]);

  return created;
}
