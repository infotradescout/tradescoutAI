import { and, desc, eq, gt, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import {
  businessPresenceCustomerTasks as tasks,
  businessPresencePlans as plans,
  businessPresenceTaskRuntime as runtime,
  notificationPreferences,
  notifications,
} from "@shared/schema";
import {
  assertLiveEvidence,
  PresencePlanError,
  type OwnedContext,
} from "./presencePlanService";

type Task = typeof tasks.$inferSelect;
type Plan = typeof plans.$inferSelect;

const KIND = "select_site_path";
const RUNTIME_ID = "site_path";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const RETRY_MINUTES = [5, 15, 45, 120, 360] as const;

function addMs(date: Date, duration: number): Date {
  return new Date(date.getTime() + duration);
}

export function nextPresenceReminderAt(
  firstWaitAt: Date,
  lastReminderAt: Date | null,
  reminderCount: number
): Date | null {
  if (reminderCount >= 3) return null;
  return addMs(lastReminderAt ?? firstWaitAt, lastReminderAt ? 7 * DAY : DAY);
}

export function allowsPresenceInAppReminder(
  preference: Pick<typeof notificationPreferences.$inferSelect,
    "enableNotifications" | "typePreferences"> | null
): boolean {
  if (preference?.enableNotifications === false) return false;
  const reminder = preference?.typePreferences?.reminder;
  return reminder?.enabled !== false &&
    (!Array.isArray(reminder?.delivery_methods) || reminder.delivery_methods.includes("in_app"));
}

export function presenceReminderPayload(task: Pick<Task, "id" | "planHash" | "reminderCount" | "ownerUserId">) {
  const cycle = task.reminderCount + 1;
  return {
    id: `presence-site-path:${task.id}:${cycle}`,
    userId: task.ownerUserId,
    type: "reminder" as const,
    title: "Choose your website approach in TradeScout",
    message: "Your setup is waiting for your choice",
    actionUrl: "/presence/review",
    actionText: "Choose website approach",
    deliveryMethods: ["in_app"],
    groupId: `presence-site-path:${task.id}`,
    metadata: { presenceTaskId: task.id, planHash: task.planHash, reminderCycle: cycle },
  };
}

function currentTaskPlan(task: Task, plan: Plan): boolean {
  return task.planId === plan.id &&
    task.ownerUserId === plan.ownerUserId &&
    task.businessId === plan.businessId &&
    task.profileId === plan.profileId &&
    task.evidenceDigest === plan.evidenceDigest &&
    task.planHash === plan.planHash &&
    task.revision === plan.revision;
}

function taskEligible(plan: Plan, live: Awaited<ReturnType<typeof assertLiveEvidence>> | null): boolean {
  return Boolean(live && plan.sitePath === null && plan.reviewedAt === null &&
    live.sitePath.allowed.length > 0 &&
    !live.quarantinedEvidence.some((item) => item.reason === "identity_conflict"));
}

async function lockLivePlan(tx: any, candidate: Plan) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${candidate.ownerUserId}|${candidate.businessId}`}))`);
  let live: Awaited<ReturnType<typeof assertLiveEvidence>> | null = null;
  let ownershipValid = false;
  const identity: OwnedContext = {
    ownerUserId: candidate.ownerUserId,
    businessId: candidate.businessId,
    profileId: candidate.profileId,
    onboardingEvidence: null,
    externalWebsiteUrl: null,
  };
  try {
    live = await assertLiveEvidence(
      tx, identity, candidate.evidenceDigest, candidate.planHash
    );
    ownershipValid = true;
  } catch (error) {
    if (!(error instanceof PresencePlanError)) throw error;
    ownershipValid = error.code === "PRESENCE_PLAN_STALE";
  }
  const [plan] = await tx.select().from(plans).where(eq(plans.id, candidate.id)).limit(1).for("update");
  if (!plan) return { plan: null, live: null, ownershipValid: false };
  if (plan.evidenceDigest !== candidate.evidenceDigest ||
      plan.planHash !== candidate.planHash || plan.profileId !== candidate.profileId ||
      plan.revision !== candidate.revision) live = null;
  return { plan: plan as Plan, live, ownershipValid };
}

async function archiveTaskReminders(tx: any, taskIds: string[], now: Date) {
  if (!taskIds.length) return;
  await tx.update(notifications)
    .set({ isArchived: true, archivedAt: now, updatedAt: now })
    .where(inArray(notifications.groupId, taskIds.map((id) => `presence-site-path:${id}`)));
}

async function markPlanReconciled(tx: any, plan: Plan) {
  if (plan.customerTaskReconciledRevision === plan.revision &&
      plan.customerTaskReconciledSitePath === plan.sitePath) return;
  await tx.update(plans).set({
    customerTaskReconciledRevision: plan.revision,
    customerTaskReconciledSitePath: plan.sitePath,
  }).where(eq(plans.id, plan.id));
}

/** Called only after the authoritative plan transaction commits. Safe to retry. */
export async function reconcilePresenceCustomerTask(planId: string, now = new Date()): Promise<void> {
  const { db } = await import("../db");
  const [candidate] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
  if (!candidate) return;
  await db.transaction(async (tx: any) => {
    const locked = await lockLivePlan(tx, candidate);
    const plan = locked.plan;
    if (!plan) return;
    // A plan row can change profile in place. Retire even capped/terminal old
    // profile tasks, which a due-only worker would never revisit.
    const priorVersions = await tx.select({ id: tasks.id }).from(tasks).where(and(
      eq(tasks.planId, plan.id),
      inArray(tasks.status, ["waiting_customer", "retrying", "terminal_attention"]),
      sql`(${tasks.ownerUserId} <> ${plan.ownerUserId}
        OR ${tasks.businessId} <> ${plan.businessId}
        OR ${tasks.profileId} <> ${plan.profileId} OR ${tasks.planHash} <> ${plan.planHash}
        OR ${tasks.evidenceDigest} <> ${plan.evidenceDigest} OR ${tasks.revision} <> ${plan.revision})`
    )).for("update");
    if (priorVersions.length) {
      const ids = priorVersions.map((task: {id: string}) => task.id);
      await tx.update(tasks).set({
        status: locked.ownershipValid ? "stale" : "suppressed",
        nextReminderAt: null, retryAt: null, updatedAt: now,
      }).where(inArray(tasks.id, ids));
      await archiveTaskReminders(tx, ids, now);
    }
    const familyWhere = and(
      eq(tasks.ownerUserId, plan.ownerUserId),
      eq(tasks.businessId, plan.businessId),
      eq(tasks.profileId, plan.profileId),
      eq(tasks.kind, KIND)
    );
    // The latest family member carries the nudge budget across changed hashes.
    const [latest] = await tx.select().from(tasks).where(familyWhere)
      .orderBy(desc(tasks.createdAt), desc(tasks.id)).limit(1).for("update");
    const active = await tx.select({ id: tasks.id, planHash: tasks.planHash })
      .from(tasks).where(and(familyWhere, inArray(tasks.status, ["waiting_customer", "retrying", "terminal_attention"])))
      .for("update");
    const oldIds = active.filter((task: {id: string; planHash: string}) =>
      task.planHash !== plan.planHash || !taskEligible(plan, locked.live)
    ).map((task: {id: string}) => task.id);
    if (oldIds.length) {
      await tx.update(tasks).set({
        status: locked.ownershipValid ?
          (plan.sitePath && plan.reviewedAt ? "resolved" : "stale") : "suppressed",
        nextReminderAt: null,
        retryAt: null,
        updatedAt: now,
      }).where(inArray(tasks.id, oldIds));
      await archiveTaskReminders(tx, oldIds, now);
    }
    if (!taskEligible(plan, locked.live)) {
      await markPlanReconciled(tx, plan);
      return;
    }
    const [same] = await tx.select().from(tasks).where(and(familyWhere, eq(tasks.planHash, plan.planHash)))
      .limit(1).for("update");
    if (same) {
      if (["stale", "suppressed"].includes(same.status)) {
        const cadence = nextPresenceReminderAt(same.firstWaitAt, same.lastReminderAt, same.reminderCount);
        await tx.update(tasks).set({
          status: "waiting_customer",
          nextReminderAt: cadence ? new Date(Math.max(cadence.getTime(), now.getTime() + DAY)) : null,
          retryAt: null, updatedAt: now,
        }).where(eq(tasks.id, same.id));
      }
      await markPlanReconciled(tx, plan);
      return; // A selected/terminal task is never reopened by repeat reconcile.
    }
    // Start the first wait when this customer task is actually created. Plans
    // predating this feature must not receive an immediate rollout reminder.
    const firstWaitAt = latest?.firstWaitAt ?? now;
    const reminderCount = latest?.reminderCount ?? 0;
    const lastReminderAt = latest?.lastReminderAt ?? null;
    await tx.insert(tasks).values({
      ownerUserId: plan.ownerUserId,
      businessId: plan.businessId,
      profileId: plan.profileId,
      planId: plan.id,
      planHash: plan.planHash,
      evidenceDigest: plan.evidenceDigest,
      revision: plan.revision,
      kind: KIND,
      status: "waiting_customer",
      firstWaitAt,
      reminderCount,
      lastReminderAt,
      nextReminderAt: nextPresenceReminderAt(firstWaitAt, lastReminderAt, reminderCount),
    }).onConflictDoNothing({ target: [
      tasks.ownerUserId, tasks.businessId, tasks.profileId, tasks.planHash, tasks.kind
    ] });
    await markPlanReconciled(tx, plan);
  });
}

function collisionMatches(existing: typeof notifications.$inferSelect, payload: ReturnType<typeof presenceReminderPayload>) {
  return existing.userId === payload.userId && existing.type === "reminder" &&
    existing.actionUrl === payload.actionUrl && existing.groupId === payload.groupId &&
    existing.metadata?.presenceTaskId === payload.metadata.presenceTaskId &&
    existing.metadata?.planHash === payload.metadata.planHash &&
    existing.metadata?.reminderCycle === payload.metadata.reminderCycle &&
    JSON.stringify(existing.deliveryMethods) === JSON.stringify(["in_app"]);
}

async function recordTaskFailure(taskId: string, error: unknown, now: Date): Promise<void> {
  const { db } = await import("../db");
  const code = typeof error === "object" && error && "code" in error
    ? String((error as {code?: unknown}).code).slice(0, 80) : "PRESENCE_TASK_RETRY";
  await db.transaction(async (tx: any) => {
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).limit(1).for("update");
    if (!task || !["waiting_customer", "retrying"].includes(task.status)) return;
    const failureCount = Math.min(5, task.failureCount + 1);
    await tx.update(tasks).set({
      failureCount,
      status: failureCount >= 5 ? "terminal_attention" : "retrying",
      retryAt: failureCount >= 5 ? null : addMs(now, RETRY_MINUTES[failureCount - 1] * 60_000),
      nextReminderAt: failureCount >= 5 ? null : task.nextReminderAt,
      lastErrorCode: code,
      updatedAt: now,
    }).where(eq(tasks.id, taskId));
  });
}

/** Server-only scheduler entry point. Never invoke from a customer route. */
export async function processDuePresenceTask(taskId: string, now = new Date(), authority?: {isImpersonating?: boolean}): Promise<"sent" | "skipped"> {
  if (authority?.isImpersonating) throw new Error("Impersonation cannot run Presence tasks");
  const { db } = await import("../db");
  const [candidate] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!candidate) return "skipped";
  const [planCandidate] = await db.select().from(plans).where(eq(plans.id, candidate.planId)).limit(1);
  if (!planCandidate) return "skipped";
  try {
    return await db.transaction(async (tx: any): Promise<"sent" | "skipped"> => {
      const locked = await lockLivePlan(tx, planCandidate);
      const plan = locked.plan;
      if (!plan) return "skipped";
      const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId))
        .limit(1).for("update", { skipLocked: true });
      if (!task || !["waiting_customer", "retrying"].includes(task.status)) return "skipped";
      const invalid = !locked.ownershipValid || !currentTaskPlan(task, plan) ||
        !taskEligible(plan, locked.live);
      if (invalid) {
        await tx.update(tasks).set({
          status: locked.ownershipValid ?
            (plan.sitePath && plan.reviewedAt ? "resolved" : "stale") : "suppressed",
          nextReminderAt: null, retryAt: null, updatedAt: now,
        }).where(eq(tasks.id, taskId));
        await archiveTaskReminders(tx, [taskId], now);
        return "skipped";
      }
      const due = task.status === "retrying" ? task.retryAt : task.nextReminderAt;
      if (!due || due > now || task.reminderCount >= 3) return "skipped";
      const [preference] = await tx.select().from(notificationPreferences)
        .where(eq(notificationPreferences.userId, task.ownerUserId)).limit(1).for("share");
      if (!allowsPresenceInAppReminder(preference ?? null)) {
        // Poll weekly during opt-out; no count advances and re-opt-in cannot burst.
        await tx.update(tasks).set({
          status: "waiting_customer", retryAt: null,
          nextReminderAt: addMs(now, 7 * DAY), updatedAt: now,
        }).where(eq(tasks.id, taskId));
        return "skipped";
      }
      const payload = presenceReminderPayload(task);
      const [inserted] = await tx.insert(notifications).values({
        ...payload, sentAt: now, deliveredAt: now,
      }).onConflictDoNothing({ target: notifications.id }).returning();
      if (!inserted) {
        const [existing] = await tx.select().from(notifications)
          .where(eq(notifications.id, payload.id)).limit(1).for("update");
        if (!existing || !collisionMatches(existing, payload)) {
          throw Object.assign(new Error("Presence notification identity conflict"), {
            code: "PRESENCE_NOTIFICATION_IDENTITY_CONFLICT",
          });
        }
      }
      const reminderCount = task.reminderCount + 1;
      await tx.update(tasks).set({
        status: "waiting_customer", reminderCount, lastReminderAt: now,
        nextReminderAt: nextPresenceReminderAt(task.firstWaitAt, now, reminderCount),
        failureCount: 0, retryAt: null, lastErrorCode: null, updatedAt: now,
      }).where(eq(tasks.id, taskId));
      return inserted ? "sent" : "skipped";
    });
  } catch (error) {
    try { await recordTaskFailure(taskId, error, now); }
    catch (recordError) { console.error("[presence.customer-task] retry record failed", recordError); throw error; }
    return "skipped";
  }
}

async function sweepPlanPage(now: Date): Promise<{scanned: number; failed: number}> {
  const { db } = await import("../db");
  const [state] = await db.select().from(runtime).where(eq(runtime.id, RUNTIME_ID)).limit(1);
  if (!state) throw new Error("Presence task runtime migration missing");
  const pending = sql<boolean>`(${plans.customerTaskReconciledRevision} IS DISTINCT FROM ${plans.revision}
    OR ${plans.customerTaskReconciledSitePath} IS DISTINCT FROM ${plans.sitePath})`;
  const audited = sql<boolean>`(${plans.customerTaskReconciledRevision} IS NOT DISTINCT FROM ${plans.revision}
    AND ${plans.customerTaskReconciledSitePath} IS NOT DISTINCT FROM ${plans.sitePath})`;
  let priorityPage = await db.select({ id: plans.id }).from(plans)
    .where(and(pending, state.pendingCursor ? gt(plans.id, state.pendingCursor) : undefined))
    .orderBy(plans.id).limit(200);
  if (!priorityPage.length && state.pendingCursor) {
    priorityPage = await db.select({ id: plans.id }).from(plans)
      .where(pending).orderBy(plans.id).limit(200);
  }
  // Full keyset audit catches source changes that did not call plan refresh,
  // including capped tasks with no due reminder. Healthy rows remain read-only.
  let auditPage = await db.select({ id: plans.id }).from(plans)
    .where(and(audited, state.sweepCursor ? gt(plans.id, state.sweepCursor) : undefined))
    .orderBy(plans.id).limit(1000);
  if (!auditPage.length && state.sweepCursor) {
    auditPage = await db.select({ id: plans.id }).from(plans)
      .where(audited).orderBy(plans.id).limit(1000);
  }
  let failed = 0;
  const ids = [...new Set([...priorityPage, ...auditPage].map((plan) => plan.id))];
  for (const id of ids) {
    try { await reconcilePresenceCustomerTask(id, now); }
    catch (error) { failed++; console.error("[presence.customer-task] sweep plan failed", {planId: id, error}); }
  }
  await db.update(runtime).set({
    pendingCursor: priorityPage.at(-1)?.id ?? null,
    sweepCursor: auditPage.at(-1)?.id ?? null,
  })
    .where(eq(runtime.id, RUNTIME_ID));
  return { scanned: ids.length, failed };
}

/** Bounded recovery sweep plus due processing; the scheduler owns the single runner lock. */
export async function runPresenceCustomerTaskTick(now = new Date(), authority?: {isImpersonating?: boolean}) {
  if (authority?.isImpersonating) throw new Error("Impersonation cannot run Presence tasks");
  const { db } = await import("../db");
  await db.update(runtime).set({ lastAttemptAt: now }).where(eq(runtime.id, RUNTIME_ID));
  try {
    const sweep = await sweepPlanPage(now);
    const due = await db.select({ id: tasks.id }).from(tasks).where(or(
      and(eq(tasks.status, "waiting_customer"), isNotNull(tasks.nextReminderAt), lte(tasks.nextReminderAt, now)),
      and(eq(tasks.status, "retrying"), isNotNull(tasks.retryAt), lte(tasks.retryAt, now))
    )).orderBy(tasks.nextReminderAt, tasks.id).limit(200);
    let sent = 0;
    for (const item of due) {
      if (await processDuePresenceTask(item.id, now, authority) === "sent") sent++;
    }
    if (sweep.failed) throw new Error(`Presence task sweep failed for ${sweep.failed} plans`);
    await db.update(runtime).set({lastSuccessfulTickAt: now, lastErrorCode: null})
      .where(eq(runtime.id, RUNTIME_ID));
    return { scanned: sweep.scanned, due: due.length, sent };
  } catch (error) {
    await db.update(runtime).set({
      lastFailureAt: now,
      lastErrorCode: "PRESENCE_TASK_TICK_FAILED",
    }).where(eq(runtime.id, RUNTIME_ID));
    throw error;
  }
}

/** Aggregate only: no customer facts or per-business operator queue. */
export async function presenceCustomerTaskHealth() {
  const { db } = await import("../db");
  const [state] = await db.select().from(runtime).where(eq(runtime.id, RUNTIME_ID)).limit(1);
  if (!state) throw new Error("Presence task runtime unavailable");
  const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(tasks)
    .where(eq(tasks.status, "terminal_attention"));
  const [backlog] = await db.select({
    total: sql<number>`count(*)::int`,
    oldestDueAt: sql<Date | null>`min(coalesce(${tasks.retryAt}, ${tasks.nextReminderAt}))`,
  }).from(tasks).where(or(
    and(eq(tasks.status, "waiting_customer"), isNotNull(tasks.nextReminderAt), lte(tasks.nextReminderAt, new Date())),
    and(eq(tasks.status, "retrying"), isNotNull(tasks.retryAt), lte(tasks.retryAt, new Date()))
  ));
  return { terminalAttentionCount: count.total, lastAttemptAt: state.lastAttemptAt,
    lastSuccessfulTickAt: state.lastSuccessfulTickAt, lastFailureAt: state.lastFailureAt,
    lastErrorCode: state.lastErrorCode,
    dueBacklogCount: backlog.total,
    oldestDueAt: backlog.oldestDueAt };
}
